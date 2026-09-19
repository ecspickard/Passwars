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

class UserProfileResponse(BaseModel):
    id: int
    username: str
    created_at: datetime
    offerings: List[str]
    passwords_collected: int

    class Config:
        from_attributes = True

# Password Schemas
class PasswordAddRequest(BaseModel):
    service_name: str
    secret_value: str  # the actual wagered secret; encrypted before storage

class PasswordUpdateRequest(BaseModel):
    """Both fields optional - PATCH sends only what changed. A blank/omitted
    secret_value means "keep the existing secret"; the frontend enforces
    this by only including the field when the user typed a new one."""
    service_name: Optional[str] = None
    secret_value: Optional[str] = None

class PasswordResponse(BaseModel):
    id: int
    user_id: int
    service_name: str
    created_at: datetime

    class Config:
        from_attributes = True

class PasswordBankResponse(BaseModel):
    id: int
    service_name: str
    collected_from: Optional[int]
    collected_at: datetime

    class Config:
        from_attributes = True

class SecretRevealResponse(BaseModel):
    """Returned only by the reveal-on-demand endpoints - never embedded in
    the plain list/bank responses above."""
    id: int
    service_name: str
    secret_value: str

# Player List Schemas
class PlayerResponse(BaseModel):
    id: int
    username: str
    services: List[str]

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
    result_source: Optional[str]
    created_at: datetime
    accepted_at: Optional[datetime]
    completed_at: Optional[datetime]

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

# Chess.com Account Linking Schemas
class ChessUsernameStartRequest(BaseModel):
    chess_username: str

class ChessUsernameStartResponse(BaseModel):
    chess_username: str
    verification_code: str
    instructions: str

class ChessUsernameVerifyResponse(BaseModel):
    chess_username: str
    verified: bool
    verified_at: Optional[datetime]
