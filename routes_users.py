from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, exc
from typing import List
from datetime import datetime
from database import get_db
from models import User, UserPassword, PasswordBank
from schemas import (
    PasswordAddRequest, PasswordUpdateRequest, PasswordResponse, PasswordBankResponse,
    PlayerResponse, LeaderboardResponse, UserResponse, SecretRevealResponse,
    ChessUsernameStartRequest, ChessUsernameStartResponse, ChessUsernameVerifyResponse
)
from utils import decode_token, encrypt_secret, decrypt_secret, generate_verification_code
from chess_api import chess_user_exists, verify_ownership_via_location

router = APIRouter(prefix="/api/users", tags=["users"])

def get_current_user(token: str = Header(None, alias="Authorization"), db: Session = Depends(get_db)) -> User:
    """Get current user from JWT token"""
    if not token or not token.startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No token provided"
        )
    
    token_str = token.split(" ")[1]
    payload = decode_token(token_str)
    
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token"
        )
    
    user_id = int(payload.get("sub"))
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found"
        )
    
    return user

@router.post("/passwords", response_model=PasswordResponse, status_code=status.HTTP_201_CREATED)
def add_password(
    request: PasswordAddRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Add a password offering. The secret is encrypted before it touches the database."""
    
    current_user = get_current_user(authorization, db)
    
    try:
        new_password = UserPassword(
            user_id=current_user.id,
            service_name=request.service_name,
            secret_value=encrypt_secret(request.secret_value)
        )
        db.add(new_password)
        db.commit()
        db.refresh(new_password)
        return PasswordResponse.from_orm(new_password)
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already offering this service"
        )

@router.get("/passwords", response_model=List[PasswordResponse])
def list_passwords(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """List the current user's own password offerings (vault view). Never
    returns secret_value - that only ever comes back from the reveal
    endpoint below, fetched fresh and on demand."""

    current_user = get_current_user(authorization, db)

    offerings = db.query(UserPassword).filter(
        UserPassword.user_id == current_user.id
    ).order_by(UserPassword.created_at.desc()).all()

    return [PasswordResponse.from_orm(p) for p in offerings]

@router.patch("/passwords/{password_id}", response_model=PasswordResponse)
def update_password(
    password_id: int,
    request: PasswordUpdateRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Rename a service and/or rotate its stored secret. Both fields are
    optional on the request - send only what changed. A new secret_value is
    re-encrypted before storage, same as on creation."""

    current_user = get_current_user(authorization, db)

    offering = db.query(UserPassword).filter(
        UserPassword.id == password_id,
        UserPassword.user_id == current_user.id
    ).first()

    if not offering:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offering not found")

    if request.service_name is not None:
        offering.service_name = request.service_name
    if request.secret_value is not None:
        offering.secret_value = encrypt_secret(request.secret_value)

    try:
        db.commit()
        db.refresh(offering)
    except exc.IntegrityError:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Already offering this service"
        )

    return PasswordResponse.from_orm(offering)

@router.delete("/passwords/{password_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_password(
    password_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Remove one of the current user's own password offerings.

    TODO(product): this doesn't yet check whether the service is currently
    wagered in a pending/accepted Challenge. challenge_service.py looks up
    the loser's UserPassword by (user_id, service_name) at resolution time,
    so deleting a staked entry could make an in-flight challenge
    unresolvable. Needs a "can't delete a staked service" rule (or a
    snapshot of the secret at challenge-accept time) before this ships -
    out of scope for the vault CRUD work itself.
    """

    current_user = get_current_user(authorization, db)

    offering = db.query(UserPassword).filter(
        UserPassword.id == password_id,
        UserPassword.user_id == current_user.id
    ).first()

    if not offering:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offering not found")

    db.delete(offering)
    db.commit()

@router.get("/players", response_model=List[PlayerResponse])
def get_players(db: Session = Depends(get_db)):
    """Get all players with their password offerings"""
    
    users = db.query(User).all()
    players = []
    
    for user in users:
        services = [p.service_name for p in user.password_offerings]
        players.append(PlayerResponse(id=user.id, username=user.username, services=services))
    
    return sorted(players, key=lambda x: x.username)

@router.get("/password-bank", response_model=List[PasswordBankResponse])
def get_password_bank(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get current user's collected password bank"""
    
    current_user = get_current_user(authorization, db)
    
    passwords = db.query(PasswordBank).filter(
        PasswordBank.user_id == current_user.id
    ).order_by(PasswordBank.collected_at.desc()).all()
    
    return [PasswordBankResponse.from_orm(p) for p in passwords]

@router.get("/leaderboard", response_model=List[LeaderboardResponse])
def get_leaderboard(db: Session = Depends(get_db), limit: int = 50):
    """Get top players by password count"""
    
    results = db.query(
        User.id,
        User.username,
        func.count(PasswordBank.id).label("password_count")
    ).outerjoin(PasswordBank).group_by(User.id, User.username).order_by(
        func.count(PasswordBank.id).desc()
    ).limit(limit).all()
    
    leaderboard = [
        LeaderboardResponse(
            id=r[0],
            username=r[1],
            password_count=r[2] or 0
        )
        for r in results
    ]
    
    return leaderboard

@router.get("/profile/{user_id}", response_model=dict)
def get_user_profile(user_id: int, db: Session = Depends(get_db)):
    """Get user profile with offerings and password count"""
    
    user = db.query(User).filter(User.id == user_id).first()
    
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found"
        )
    
    offerings = [p.service_name for p in user.password_offerings]
    password_count = db.query(func.count(PasswordBank.id)).filter(
        PasswordBank.user_id == user_id
    ).scalar() or 0
    
    return {
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at,
        "offerings": offerings,
        "passwords_collected": password_count
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    
    current_user = get_current_user(authorization, db)
    return UserResponse.from_orm(current_user)


@router.get("/passwords/{password_id}/reveal", response_model=SecretRevealResponse)
def reveal_offering_secret(
    password_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Decrypt and return one of the current user's own offered secrets."""

    current_user = get_current_user(authorization, db)

    offering = db.query(UserPassword).filter(
        UserPassword.id == password_id,
        UserPassword.user_id == current_user.id
    ).first()

    if not offering:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Offering not found")

    return SecretRevealResponse(
        id=offering.id,
        service_name=offering.service_name,
        secret_value=decrypt_secret(offering.secret_value)
    )


@router.get("/password-bank/{entry_id}/reveal", response_model=SecretRevealResponse)
def reveal_bank_secret(
    entry_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Decrypt and return a secret the current user has won into their bank."""

    current_user = get_current_user(authorization, db)

    entry = db.query(PasswordBank).filter(
        PasswordBank.id == entry_id,
        PasswordBank.user_id == current_user.id
    ).first()

    if not entry:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Password bank entry not found")

    return SecretRevealResponse(
        id=entry.id,
        service_name=entry.service_name,
        secret_value=decrypt_secret(entry.secret_value)
    )


@router.post("/chess-username/start", response_model=ChessUsernameStartResponse)
def start_chess_username_verification(
    request: ChessUsernameStartRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Step 1 of linking a Chess.com account: confirm the username exists, then
    hand back a one-time code for the user to paste into their Chess.com
    profile's "Location" field so ownership can be confirmed in step 2.
    """

    current_user = get_current_user(authorization, db)

    if not chess_user_exists(request.chess_username):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No Chess.com account found with that username"
        )

    code = generate_verification_code()
    current_user.chess_username = request.chess_username
    current_user.chess_verification_code = code
    current_user.chess_verified_at = None
    db.commit()

    return ChessUsernameStartResponse(
        chess_username=request.chess_username,
        verification_code=code,
        instructions=(
            f"Paste '{code}' into the Location field of your Chess.com profile, "
            "then call /chess-username/verify. You can remove it afterward."
        )
    )


@router.post("/chess-username/verify", response_model=ChessUsernameVerifyResponse)
def verify_chess_username(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Step 2: confirm the verification code is present on the linked Chess.com profile."""

    current_user = get_current_user(authorization, db)

    if not current_user.chess_username or not current_user.chess_verification_code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Start chess-username verification first"
        )

    verified = verify_ownership_via_location(
        current_user.chess_username, current_user.chess_verification_code
    )

    if verified:
        current_user.chess_verified_at = datetime.utcnow()
        current_user.chess_verification_code = None
        db.commit()

    return ChessUsernameVerifyResponse(
        chess_username=current_user.chess_username,
        verified=verified,
        verified_at=current_user.chess_verified_at
    )


@router.delete("/chess-username", status_code=status.HTTP_204_NO_CONTENT)
def unlink_chess_username(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Remove the linked Chess.com account entirely (whether or not it was
    verified). A fresh start()/verify() is required to link again — nothing
    carries over.
    """
    current_user = get_current_user(authorization, db)

    current_user.chess_username = None
    current_user.chess_verification_code = None
    current_user.chess_verified_at = None
    db.commit()
