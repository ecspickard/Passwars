from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, List

# Auth Schemas
class UserSignupRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class UserLoginRequest(BaseModel):
    username: str
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    user: "UserResponse"

# User Schemas
class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    created_at: datetime
    chess_username: Optional[str] = None
    chess_verified_at: Optional[datetime] = None

    class Config:
        from_attributes = True

from typing import Any, Dict

class PasswordWonItem(BaseModel):
    service: str
    player_username: str

class UserProfileResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    chess_username: Optional[str] = None
    chess_avatar: Optional[str] = None
    chess_stats: Optional[Dict[str, int]] = None
    offerings: List[str]
    passwords_collected: int
    passwords_won: List[PasswordWonItem] = []

    class Config:
        from_attributes = True

class UserProfileUpdateRequest(BaseModel):
    username: Optional[str] = None
    email: Optional[EmailStr] = None

class AccountDeleteRequest(BaseModel):
    password: str  # Require password confirmation for deletion

# Password Schemas
class PasswordAddRequest(BaseModel):
    service_name: str
    password_value: str
    username: Optional[str] = None

class PasswordUpdateRequest(BaseModel):
    service_name: Optional[str] = None
    secret_value: Optional[str] = None
    username: Optional[str] = None

class PasswordResponse(BaseModel):
    id: int
    user_id: int
    service_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class PasswordRevealResponse(BaseModel):
    id: int
    service_name: str
    username: str
    password_value: str
    collected_from: Optional[int] = None
    collected_at: Optional[datetime] = None

class PasswordBankResponse(BaseModel):
    id: int
    service_name: str
    collected_from: Optional[int]
    collected_at: datetime

    class Config:
        from_attributes = True

# Player List Schemas
class PlayerResponse(BaseModel):
    id: int
    username: str
    services: List[str]
    chess_username: Optional[str] = None

class LeaderboardResponse(BaseModel):
    id: int
    username: str
    password_count: int

    class Config:
        from_attributes = True

# Challenge Schemas
class ChallengeRequest(BaseModel):
    defender_id: int
    challenger_service: str
    defender_service: str

class ChallengeResponse(BaseModel):
    id: int
    challenger_id: int
    defender_id: int
    challenger_service: str
    defender_service: str
    status: str
    winner_id: Optional[int]
    created_at: datetime
    accepted_at: Optional[datetime] = None
    result_source: Optional[str] = None
    challenger_name: Optional[str] = None
    defender_name: Optional[str] = None

    class Config:
        from_attributes = True

class ChallengeAcceptRequest(BaseModel):
    challenge_id: int

class ChallengeDenyRequest(BaseModel):
    challenge_id: int

# Game Move Schemas
class GameMoveRequest(BaseModel):
    challenge_id: int
    move: str

class GameMoveResponse(BaseModel):
    id: int
    challenge_id: int
    move_number: int
    player_id: int
    move: str
    created_at: datetime

    class Config:
        from_attributes = True

class GameResultRequest(BaseModel):
    challenge_id: int
    winner_id: int

# Chess Schemas
class ChessStartRequest(BaseModel):
    chess_username: str
    