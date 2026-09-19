from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from sqlalchemy import func, update
from datetime import datetime
import os

from database import init_db, get_db, SessionLocal
from models import Challenge, PasswordBank, User
from routes_auth import router as auth_router
from routes_users import router as users_router

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

# Health check
@app.get("/api/health")
def health_check():
    return {"status": "Server is running"}

# WebSocket connection manager
from typing import List, Dict
from fastapi import WebSocket

class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}
        self.active_games: Dict[int, dict] = {}

    async def connect(self, user_id: int, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket

    def disconnect(self, user_id: int):
        if user_id in self.active_connections:
            del self.active_connections[user_id]

    async def send_to_user(self, user_id: int, message: dict):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception as e:
                print(f"Error sending message to user {user_id}: {e}")

    async def broadcast(self, message: dict):
        for connection in self.active_connections.values():
            try:
                await connection.send_json(message)
            except Exception as e:
                print(f"Error broadcasting message: {e}")

manager = ConnectionManager()

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

                db = SessionLocal()
                challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
                
                if challenge:
                    loser_id = challenge.defender_id if winner_id == challenge.challenger_id else challenge.challenger_id
                    loser_service = challenge.defender_service if winner_id == challenge.challenger_id else challenge.challenger_service

                    # Add password to winner's bank
                    password_bank = PasswordBank(
                        user_id=winner_id,
                        service_name=loser_service,
                        collected_from=loser_id
                    )
                    db.add(password_bank)

                    # Update challenge
                    challenge.winner_id = winner_id
                    challenge.status = "completed"
                    challenge.completed_at = datetime.utcnow()
                    
                    db.commit()

                    # Notify both players
                    await manager.broadcast(
                        {
                            "type": "game_ended",
                            "challenge_id": challenge_id,
                            "winner_id": winner_id
                        }
                    )

                db.close()

    except Exception as e:
        print(f"WebSocket error for user {user_id}: {e}")
    finally:
        manager.disconnect(user_id)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
