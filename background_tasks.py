"""
Background poller that automatically resolves accepted challenges by
checking Chess.com for a finished, decisive game between the two linked
accounts - so players don't have to manually trigger auto-resolve.
"""
import asyncio

from starlette.concurrency import run_in_threadpool

from database import SessionLocal
from models import Challenge
from chess_api import find_game_result
from challenge_service import complete_challenge
from connection_manager import manager

POLL_INTERVAL_SECONDS = 45


async def _check_challenge(db, challenge: Challenge):
    challenger = challenge.challenger
    defender = challenge.defender

    if not challenger.chess_username or not challenger.chess_verified_at:
        return
    if not defender.chess_username or not defender.chess_verified_at:
        return

    # find_game_result uses `requests` (blocking) - run it off the event
    # loop so a slow Chess.com response doesn't freeze active websockets.
    result = await run_in_threadpool(
        find_game_result,
        challenger.chess_username,
        defender.chess_username,
        challenge.accepted_at,
    )
    if not result:
        return

    winner_username = result["winner_username"].lower()
    winner_id = (
        challenger.id if winner_username == challenger.chess_username.lower() else defender.id
    )

    try:
        complete_challenge(db, challenge, winner_id, source="auto")
    except ValueError as e:
        # Data-integrity problem (e.g. missing offering) - log and move on,
        # don't crash the whole poll loop over one bad challenge.
        print(f"[poller] failed to complete challenge {challenge.id}: {e}")
        return

    for uid in (challenge.challenger_id, challenge.defender_id):
        await manager.send_to_user(
            uid,
            {
                "type": "game_ended",
                "challenge_id": challenge.id,
                "winner_id": winner_id,
                "source": "auto",
            },
        )


async def poll_accepted_challenges():
    """Runs forever, checking every accepted challenge on each interval."""
    while True:
        db = SessionLocal()
        try:
            challenges = db.query(Challenge).filter(Challenge.status == "accepted").all()
            for challenge in challenges:
                try:
                    await _check_challenge(db, challenge)
                except Exception as e:
                    print(f"[poller] error checking challenge {challenge.id}: {e}")
        finally:
            db.close()

        await asyncio.sleep(POLL_INTERVAL_SECONDS)