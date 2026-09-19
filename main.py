from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, update
from datetime import datetime
import os

from database import init_db, get_db, SessionLocal
from models import Challenge, User
from routes_auth import router as auth_router
from routes_users import router as users_router
from routes_challenges import router as challenges_router
from connection_manager import manager
from challenge_service import complete_challenge, VALID_RESULT_SOURCES

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

# Health check
@app.get("/api/health")
def health_check():
    return {"status": "Server is running"}

from fastapi import WebSocket

@app.websocket("/ws/{user_id}")
async def websocket_endpoint(user_id: int, websocket: WebSocket):
    """WebSocket endpoint for real-time features"""
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            event_type = data.get("type")

            if event_type == "user_online":
                # User came online
                print(f"User {user_id} is online")

            elif event_type == "send_challenge":
                # Send challenge to defender
                challenger_id = data.get("challenger_id")
                defender_id = data.get("defender_id")
                challenger_service = data.get("challenger_service")
                defender_service = data.get("defender_service")

                # Create challenge in database
                db = SessionLocal()
                challenge = Challenge(
                    challenger_id=challenger_id,
                    defender_id=defender_id,
                    challenger_service=challenger_service,
                    defender_service=defender_service,
                    status="pending"
                )
                db.add(challenge)
                db.commit()
                db.refresh(challenge)
                db.close()

                # Send notification to defender
                await manager.send_to_user(
                    defender_id,
                    {
                        "type": "challenge_received",
                        "challenge_id": challenge.id,
                        "challenger_id": challenger_id,
                        "challenger_name": data.get("challenger_name"),
                        "challenger_service": challenger_service,
                        "defender_service": defender_service
                    }
                )

            elif event_type == "accept_challenge":
                # Challenge accepted
                challenge_id = data.get("challenge_id")
                
                db = SessionLocal()
                challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                if challenge:
                    challenge.status = "accepted"
                    challenge.accepted_at = datetime.utcnow()
                    db.commit()

                    # Notify challenger
                    await manager.send_to_user(
                        challenge.challenger_id,
                        {
                            "type": "challenge_accepted",
                            "challenge_id": challenge_id
                        }
                    )
                    
                    # Notify defender
                    await manager.send_to_user(
                        challenge.defender_id,
                        {
                            "type": "challenge_accepted",
                            "challenge_id": challenge_id
                        }
                    )
                db.close()

            elif event_type == "deny_challenge":
                # Challenge denied
                challenge_id = data.get("challenge_id")
                
                db = SessionLocal()
                challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                if challenge:
                    challenge.status = "rejected"
                    db.commit()

                    # Notify challenger
                    await manager.send_to_user(
                        challenge.challenger_id,
                        {
                            "type": "challenge_denied",
                            "challenge_id": challenge_id
                        }
                    )
                db.close()

            elif event_type == "game_move":
                # Game move
                challenge_id = data.get("challenge_id")
                move = data.get("move")
                player_id = data.get("player_id")

                # Broadcast move to both players
                await manager.broadcast(
                    {
                        "type": "game_move",
                        "challenge_id": challenge_id,
                        "player_id": player_id,
                        "move": move
                    }
                )

            elif event_type == "game_end":
                # Game finished - transfer password to winner
                challenge_id = data.get("challenge_id")
                winner_id = data.get("winner_id")
                # "auto" = matched via the Chess.com API, "self_reported" = players
                # confirmed the result themselves (the default, for backward compatibility)
                source = data.get("source", "self_reported")

                if source not in VALID_RESULT_SOURCES:
                    await manager.send_to_user(user_id, {
                        "type": "error",
                        "message": f"Invalid result source: {source}"
                    })
                    continue

                db = SessionLocal()
                challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()

                if challenge:
                    try:
                        complete_challenge(db, challenge, winner_id, source)
                    except ValueError as e:
                        db.close()
                        await manager.send_to_user(user_id, {
                            "type": "error",
                            "message": str(e)
                        })
                    else:
                        # Notify just the two players, not every connected user
                        await manager.send_to_user(
                            challenge.challenger_id,
                            {
                                "type": "game_ended",
                                "challenge_id": challenge_id,
                                "winner_id": winner_id,
                                "source": source
                            }
                        )
                        await manager.send_to_user(
                            challenge.defender_id,
                            {
                                "type": "game_ended",
                                "challenge_id": challenge_id,
                                "winner_id": winner_id,
                                "source": source
                            }
                        )
                        db.close()
                else:
                    db.close()

    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)