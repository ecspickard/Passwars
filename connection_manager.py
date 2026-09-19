from typing import Dict
from fastapi import WebSocket


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[int, WebSocket] = {}

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


# Singleton shared by the WebSocket endpoint (main.py) and REST routes that
# need to push a live update (e.g. the Chess.com auto-resolve endpoint).
# Notifications sent through this manager are live-only: if the target user
# isn't connected right now, the message is dropped. Persisting them so a
# refresh or an offline recipient can catch up later would need a
# notifications table - that's a Phase 2 item, not built here.
manager = ConnectionManager()
