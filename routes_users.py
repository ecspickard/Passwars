from fastapi import APIRouter, Depends, HTTPException, status, Request, Header
from sqlalchemy.orm import Session
from sqlalchemy import func, exc
from typing import List
from pydantic import BaseModel
from database import get_db
from models import User, UserPassword, PasswordBank, PasswordAuditLog
from schemas import (
    PasswordAddRequest, PasswordUpdateRequest, PasswordResponse, PasswordBankResponse,
    PlayerResponse, LeaderboardResponse, UserResponse, UserProfileUpdateRequest,
    AccountDeleteRequest, PasswordRevealResponse
)
from utils import decode_token, encrypt_password, decrypt_password, verify_password, hash_password
from chess_api import chess_user_exists, verify_ownership_via_location
import traceback
import uuid
from datetime import datetime

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

def log_password_access(db: Session, user_id: int, password_id: int, action: str, ip_address: str = None):
    """Log password access for audit trail"""
    audit_log = PasswordAuditLog(
        user_id=user_id,
        password_id=password_id,
        action=action,
        ip_address=ip_address
    )
    db.add(audit_log)
    db.commit()

@router.post("/passwords", response_model=PasswordResponse, status_code=status.HTTP_201_CREATED)
def add_password(
    request: PasswordAddRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Add a password offering"""
    import json
    current_user = get_current_user(authorization, db)
    
    try:
        data = {"username": request.username or "", "password": request.password_value}
        new_password = UserPassword(
            user_id=current_user.id,
            service_name=request.service_name,
            secret_value=encrypt_password(json.dumps(data))
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
def get_passwords(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    current_user = get_current_user(authorization, db)
    return db.query(UserPassword).filter(UserPassword.user_id == current_user.id).all()

@router.patch("/passwords/{password_id}", response_model=PasswordResponse)
def update_password(
    password_id: int,
    request: PasswordUpdateRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    import json
    current_user = get_current_user(authorization, db)
    pwd = db.query(UserPassword).filter(UserPassword.id == password_id, UserPassword.user_id == current_user.id).first()
    if not pwd:
        raise HTTPException(status_code=404, detail="Password not found")
    
    if request.service_name is not None:
        pwd.service_name = request.service_name
        
    if request.secret_value is not None or request.username is not None:
        plaintext = decrypt_password(pwd.secret_value)
        try:
            data = json.loads(plaintext)
        except json.JSONDecodeError:
            data = {"username": "", "password": plaintext}
            
        if request.secret_value is not None:
            data["password"] = request.secret_value
        if request.username is not None:
            data["username"] = request.username
            
        pwd.secret_value = encrypt_password(json.dumps(data))
        
    db.commit()
    db.refresh(pwd)
    return pwd

@router.delete("/passwords/{password_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_password(
    password_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    current_user = get_current_user(authorization, db)
    pwd = db.query(UserPassword).filter(UserPassword.id == password_id, UserPassword.user_id == current_user.id).first()
    if not pwd:
        raise HTTPException(status_code=404, detail="Password not found")
    db.delete(pwd)
    db.commit()
    return None

@router.get("/passwords/{password_id}/reveal", response_model=PasswordRevealResponse)
def reveal_own_password(
    password_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    import json
    current_user = get_current_user(authorization, db)
    pwd = db.query(UserPassword).filter(UserPassword.id == password_id, UserPassword.user_id == current_user.id).first()
    if not pwd:
        raise HTTPException(status_code=404, detail="Password not found")
    
    plaintext = decrypt_password(pwd.secret_value)
    try:
        data = json.loads(plaintext)
        username = data.get("username", "")
        password_value = data.get("password", "")
    except json.JSONDecodeError:
        username = ""
        password_value = plaintext

    return {
        "id": pwd.id,
        "service_name": pwd.service_name,
        "username": username,
        "password_value": password_value
    }

@router.get("/players", response_model=List[PlayerResponse])
def get_players(db: Session = Depends(get_db)):
    """Get all players with their password offerings"""
    
    users = db.query(User).all()
    players = []
    
    for user in users:
        services = [p.service_name for p in user.password_offerings]
        chess_name = user.chess_username if user.chess_verified_at else None
        players.append(PlayerResponse(id=user.id, username=user.username, services=services, chess_username=chess_name))
    
    return sorted(players, key=lambda x: x.username)

@router.get("/password-bank", response_model=List[PasswordBankResponse])
def get_password_bank(
    authorization: str = Header(None),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Get current user's collected password bank (encrypted)"""
    
    current_user = get_current_user(authorization, db)
    
    passwords = db.query(PasswordBank).filter(
        PasswordBank.user_id == current_user.id
    ).order_by(PasswordBank.collected_at.desc()).all()
    
    # Log access to password bank
    ip_address = request.client.host if request else None
    for pwd in passwords:
        log_password_access(db, current_user.id, pwd.id, "viewed", ip_address)
    
    return [PasswordBankResponse.from_orm(p) for p in passwords]


@router.get("/password-bank/{password_id}/reveal", response_model=PasswordRevealResponse)
def reveal_password(
    password_id: int,
    authorization: str = Header(None),
    request: Request = None,
    db: Session = Depends(get_db)
):
    """Reveal/decrypt a collected password (secure endpoint)"""
    import json
    current_user = get_current_user(authorization, db)
    
    pwd = db.query(PasswordBank).filter(PasswordBank.id == password_id).first()
    
    if not pwd:
        raise HTTPException(status_code=404, detail="Password not found")
    
    # CRITICAL: Only owner can view
    if pwd.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    # Log the reveal action
    ip_address = request.client.host if request else None
    log_password_access(db, current_user.id, password_id, "revealed", ip_address)
    
    try:
        plaintext = decrypt_password(pwd.secret_value)
    except Exception:
        print(f"[reveal_password] decrypt failed for bank entry {password_id} "
              f"(secret_value length: {len(pwd.secret_value or '')})")
        traceback.print_exc()
        raise HTTPException(status_code=500, detail="Failed to decrypt password")

    try:
        data = json.loads(plaintext)
        username = data.get("username", "")
        password_value = data.get("password", "")
    except json.JSONDecodeError:
        username = ""
        password_value = plaintext

    return {
        "id": pwd.id,
        "service_name": pwd.service_name,
        "username": username,
        "password_value": password_value,
        "collected_from": pwd.collected_from,
        "collected_at": pwd.collected_at,
    }

@router.get("/leaderboard", response_model=List[LeaderboardResponse])
def get_leaderboard(db: Session = Depends(get_db), limit: int = 50):
    """Get top players by password count"""
    
    results = db.query(
        User.id,
        User.username,
        func.count(PasswordBank.id).label("password_count")
    ).outerjoin(PasswordBank, PasswordBank.user_id == User.id).group_by(User.id, User.username).order_by(
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

from schemas import UserProfileResponse

@router.get("/profile/{user_id}", response_model=UserProfileResponse)
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

    chess_username = user.chess_username if user.chess_verified_at else None
    chess_avatar = None
    chess_stats = None
    
    if chess_username:
        try:
            from chess_api import get_chess_player_profile, get_chess_player_stats
            chess_profile = get_chess_player_profile(chess_username)
            if chess_profile:
                chess_avatar = chess_profile.get("avatar")
            
            stats = get_chess_player_stats(chess_username)
            if stats:
                chess_stats = {}
                for k, v in stats.items():
                    if isinstance(v, dict) and "last" in v:
                        chess_stats[k] = v["last"]["rating"]
        except Exception as e:
            print(f"Error fetching chess info for {chess_username}: {e}")

    # Fetch passwords won (join PasswordBank with User on collected_from)
    from sqlalchemy.orm import aliased
    Victim = aliased(User)
    won_entries = db.query(PasswordBank.service_name, Victim.username).join(
        Victim, PasswordBank.collected_from == Victim.id
    ).filter(
        PasswordBank.user_id == user_id,
        PasswordBank.collected_from.isnot(None)
    ).all()
    
    passwords_won = [
        {"service": e.service_name, "player_username": e.username}
        for e in won_entries
    ]
    
    return {
        "id": user.id,
        "username": user.username,
        "created_at": user.created_at,
        "chess_username": chess_username,
        "chess_avatar": chess_avatar,
        "chess_stats": chess_stats,
        "offerings": offerings,
        "passwords_collected": password_count,
        "passwords_won": passwords_won,
    }

@router.get("/me", response_model=UserResponse)
def get_current_user_info(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get current user information"""
    
    current_user = get_current_user(authorization, db)
    return UserResponse.from_orm(current_user)


@router.put("/profile", response_model=UserResponse, status_code=status.HTTP_200_OK)
def update_profile(
    request: UserProfileUpdateRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Update current user's profile (username and/or email)"""
    
    current_user = get_current_user(authorization, db)
    
    # Check if new username already exists (if provided and different)
    if request.username and request.username != current_user.username:
        existing = db.query(User).filter(User.username == request.username).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Username already taken"
            )
        current_user.username = request.username
    
    # Check if new email already exists (if provided and different)
    if request.email and request.email != current_user.email:
        existing = db.query(User).filter(User.email == request.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already in use"
            )
        current_user.email = request.email
    
    db.commit()
    db.refresh(current_user)
    
    return UserResponse.from_orm(current_user)


@router.delete("/account", status_code=status.HTTP_204_NO_CONTENT)
def delete_account(
    request: AccountDeleteRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Delete current user's account (requires password confirmation)"""
    
    current_user = get_current_user(authorization, db)
    
    # Verify password for security
    if not verify_password(request.password, current_user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid password"
        )
    
    # Delete user (cascades to all related data via ondelete="CASCADE")
    db.delete(current_user)
    db.commit()
    
    return None

class ChessStartRequest(BaseModel):
    chess_username: str

@router.post("/chess-username/start")
def start_chess_link(
    request: ChessStartRequest,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Start linking a chess account"""
    current_user = get_current_user(authorization, db)
    
    if not chess_user_exists(request.chess_username):
        raise HTTPException(status_code=400, detail="Chess.com user not found")
        
    code = f"PW-{str(uuid.uuid4())[:8].upper()}"
    
    current_user.chess_username = request.chess_username
    current_user.chess_verification_code = code
    current_user.chess_verified_at = None
    db.commit()
    
    return {
        "chess_username": request.chess_username,
        "verification_code": code,
        "instructions": "Add this code to the 'Location' field of your Chess.com profile."
    }

@router.post("/chess-username/verify")
def verify_chess_link(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Verify the chess account link"""
    current_user = get_current_user(authorization, db)
    
    if not current_user.chess_username or not current_user.chess_verification_code:
        raise HTTPException(status_code=400, detail="No chess link in progress")
        
    is_verified = verify_ownership_via_location(current_user.chess_username, current_user.chess_verification_code)
    
    if is_verified:
        current_user.chess_verified_at = datetime.utcnow()
        db.commit()
        return {
            "chess_username": current_user.chess_username,
            "verified": True,
            "verified_at": current_user.chess_verified_at
        }
    else:
        return {
            "chess_username": current_user.chess_username,
            "verified": False,
            "verified_at": None
        }

@router.delete("/chess-username", status_code=status.HTTP_204_NO_CONTENT)
def unlink_chess_account(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Unlink chess account"""
    current_user = get_current_user(authorization, db)
    current_user.chess_username = None
    current_user.chess_verification_code = None
    current_user.chess_verified_at = None
    db.commit()
    return None