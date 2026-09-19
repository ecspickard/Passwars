import asyncio
from datetime import datetime
from typing import Dict, Optional

from fastapi import FastAPI, WebSocket
from fastapi.middleware.cors import CORSMiddleware
from starlette.concurrency import run_in_threadpool

from database import init_db, SessionLocal
from models import Challenge
from routes_auth import router as auth_router
from routes_users import router as users_router
from routes_challenges import router as challenges_router
from connection_manager import manager  # shared with background_tasks.py
from background_tasks import poll_accepted_challenges
from challenge_service import complete_challenge
from chess_api import find_game_result

# Initialize database
init_db()

app = FastAPI(title="Passwars API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(users_router)
app.include_router(challenges_router)


@app.on_event("startup")
async def start_background_poller():
    # Resolves accepted challenges from Chess.com and expires stale pending ones.
    asyncio.create_task(poll_accepted_challenges())


# Health check
@app.get("/api/health")
def health_check():
    return {"status": "Server is running"}


# Manual self-reports awaiting the opponent's matching report:
# challenge_id -> {user_id: reported winner id, or None for a draw}.
# In memory only: a server restart clears them and players simply report again.
pending_reports: Dict[int, Dict[int, Optional[int]]] = {}


def _has_verified_chess(user) -> bool:
    return bool(user.chess_username and user.chess_verified_at)


@app.websocket("/ws/{user_id}")
async def websocket_endpoint(user_id: int, websocket: WebSocket):
    """WebSocket endpoint for real-time features"""
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "user_online":
                print(f"User {user_id} is online")

            elif event_type == "send_challenge":
                challenger_id = data.get("challenger_id")
                defender_id = data.get("defender_id")
                challenger_service = data.get("challenger_service")
                defender_service = data.get("defender_service")

                db = SessionLocal()
                try:
                    challenge = Challenge(
                        challenger_id=challenger_id,
                        defender_id=defender_id,
                        challenger_service=challenger_service,
                        defender_service=defender_service,
                        status="pending",
                    )
                    db.add(challenge)
                    db.commit()
                    db.refresh(challenge)
                    challenge_id = challenge.id
                finally:
                    db.close()

                await manager.send_to_user(
                    defender_id,
                    {
                        "type": "challenge_received",
                        "challenge_id": challenge_id,
                        "challenger_id": challenger_id,
                        "challenger_name": data.get("challenger_name"),
                        "challenger_service": challenger_service,
                        "defender_service": defender_service,
                    },
                )

            elif event_type == "accept_challenge":
                challenge_id = data.get("challenge_id")

                db = SessionLocal()
                try:
                    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                    # Only the defender can accept, and only while it's pending.
                    if not challenge or challenge.defender_id != user_id or challenge.status != "pending":
                        continue

                    challenge.status = "accepted"
                    # Games only count if they finish after this moment.
                    challenge.accepted_at = datetime.utcnow()
                    db.commit()

                    challenger, defender = challenge.challenger, challenge.defender
                    challenger_id, defender_id = challenge.challenger_id, challenge.defender_id
                    # Each player is told their opponent's Chess.com handle.
                    for uid, opponent in ((challenger_id, defender), (defender_id, challenger)):
                        await manager.send_to_user(
                            uid,
                            {
                                "type": "challenge_accepted",
                                "challenge_id": challenge_id,
                                "opponent_chess_username": (
                                    opponent.chess_username if _has_verified_chess(opponent) else None
                                ),
                            },
                        )
                finally:
                    db.close()

            elif event_type == "deny_challenge":
                challenge_id = data.get("challenge_id")

                db = SessionLocal()
                try:
                    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                    if not challenge or challenge.defender_id != user_id or challenge.status != "pending":
                        continue

                    challenge.status = "rejected"
                    db.commit()
                    challenger_id = challenge.challenger_id
                finally:
                    db.close()

                await manager.send_to_user(
                    challenger_id,
                    {"type": "challenge_denied", "challenge_id": challenge_id},
                )

            elif event_type == "game_move":
                await manager.broadcast(
                    {
                        "type": "game_move",
                        "challenge_id": data.get("challenge_id"),
                        "player_id": data.get("player_id"),
                        "move": data.get("move"),
                    }
                )

            elif event_type == "game_end":
                # A client reports a Chess.com-detected result. The claim is
                # re-verified against Chess.com here, and complete_challenge
                # refuses anything that isn't still 'accepted', so duplicate
                # events (both players' browsers, or the poller) are harmless.
                challenge_id = data.get("challenge_id")
                winner_id = data.get("winner_id")

                db = SessionLocal()
                try:
                    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                    if not challenge or challenge.status != "accepted":
                        continue
                    ids = (challenge.challenger_id, challenge.defender_id)
                    if user_id not in ids or winner_id not in ids:
                        continue

                    challenger, defender = challenge.challenger, challenge.defender
                    if not (
                        _has_verified_chess(challenger)
                        and _has_verified_chess(defender)
                        and challenge.accepted_at
                    ):
                        continue

                    result = await run_in_threadpool(
                        find_game_result,
                        challenger.chess_username,
                        defender.chess_username,
                        challenge.accepted_at,
                    )
                    if not result:
                        continue

                    verified_winner = (
                        challenger
                        if result["winner_username"].lower() == challenger.chess_username.lower()
                        else defender
                    )
                    if verified_winner.id != winner_id:
                        continue

                    try:
                        complete_challenge(db, challenge, winner_id, source="auto")
                    except ValueError as e:
                        print(f"[ws] game_end rejected for challenge {challenge_id}: {e}")
                        continue

                    pending_reports.pop(challenge.id, None)
                    for uid in ids:
                        await manager.send_to_user(
                            uid,
                            {
                                "type": "game_ended",
                                "challenge_id": challenge.id,
                                "winner_id": winner_id,
                                "source": "auto",
                            },
                        )
                finally:
                    db.close()

            elif event_type == "report_result":
                # Manual fallback: each player reports independently, and the
                # result is only applied when both reports agree.
                # winner_id is a participant id, or None for a draw.
                challenge_id = data.get("challenge_id")
                reported = data.get("winner_id")

                db = SessionLocal()
                try:
                    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                    if not challenge or challenge.status != "accepted":
                        continue
                    ids = (challenge.challenger_id, challenge.defender_id)
                    if user_id not in ids or (reported is not None and reported not in ids):
                        continue

                    other_id = (
                        challenge.defender_id if user_id == challenge.challenger_id else challenge.challenger_id
                    )
                    reports = pending_reports.setdefault(challenge.id, {})
                    reports[user_id] = reported  # a repeat report replaces the old one

                    if other_id not in reports:
                        await manager.send_to_user(
                            other_id,
                            {"type": "opponent_reported", "challenge_id": challenge.id},
                        )

                    elif reports[other_id] != reported:
                        pending_reports.pop(challenge.id, None)
                        for uid in ids:
                            await manager.send_to_user(
                                uid,
                                {"type": "result_mismatch", "challenge_id": challenge.id},
                            )

                    elif reported is None:
                        # Agreed draw: void the challenge, nothing transfers.
                        pending_reports.pop(challenge.id, None)
                        challenge.status = "void"
                        challenge.result_source = "self_reported"
                        challenge.completed_at = datetime.utcnow()
                        db.commit()
                        for uid in ids:
                            await manager.send_to_user(
                                uid,
                                {"type": "challenge_voided", "challenge_id": challenge.id},
                            )

                    else:
                        pending_reports.pop(challenge.id, None)
                        try:
                            complete_challenge(db, challenge, reported, source="self_reported")
                        except ValueError as e:
                            print(f"[ws] report_result failed for challenge {challenge_id}: {e}")
                            continue
                        for uid in ids:
                            await manager.send_to_user(
                                uid,
                                {
                                    "type": "game_ended",
                                    "challenge_id": challenge.id,
                                    "winner_id": reported,
                                    "source": "self_reported",
                                },
                            )
                finally:
                    db.close()

    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
