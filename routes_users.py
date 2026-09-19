from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func, exc
from typing import List
from database import get_db
from models import User, UserPassword, PasswordBank
from schemas import (
    PasswordAddRequest, PasswordResponse, PasswordBankResponse,
    PlayerResponse, LeaderboardResponse, UserResponse
)
from utils import decode_token

router = APIRouter(prefix="/api/users", tags=["users"])

def get_current_user(token: str, db: Session = Depends(get_db)) -> User:
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
    authorization: str = None,
    db: Session = Depends(get_db)
):
    """Add a password offering"""
    
    current_user = get_current_user(authorization, db)
    
    try:
        new_password = UserPassword(
            user_id=current_user.id,
            service_name=request.service_name
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
    authorization: str = None,
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
    authorization: str = None,
    db: Session = Depends(get_db)
):
    """Get current user information"""
    
    current_user = get_current_user(authorization, db)
    return UserResponse.from_orm(current_user)
