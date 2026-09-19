from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from database import get_db
from models import Challenge, User
from schemas import ChallengeResponse
from routes_users import get_current_user

router = APIRouter(prefix="/api/challenges", tags=["challenges"])

@router.get("/mine", response_model=List[ChallengeResponse])
def list_my_challenges(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get current user's pending and accepted challenges.
    These are the active challenges that need attention.
    Completed/rejected/expired challenges aren't included since they're resolved.
    """
    current_user = get_current_user(authorization, db)

    challenges = db.query(Challenge).filter(
        or_(
            Challenge.challenger_id == current_user.id,
            Challenge.defender_id == current_user.id
        ),
        Challenge.status.in_(["pending", "accepted"])
    ).order_by(Challenge.created_at.desc()).all()

    responses = []
    for c in challenges:
        c_dict = ChallengeResponse.from_orm(c).dict()
        c_dict["challenger_name"] = c.challenger.username
        responses.append(ChallengeResponse(**c_dict))

    return responses


@router.get("/{challenge_id}", response_model=ChallengeResponse)
def get_challenge(
    challenge_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Get a specific challenge by ID"""
    current_user = get_current_user(authorization, db)
    
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )
    
    # Only show challenge to challenger or defender
    if challenge.challenger_id != current_user.id and challenge.defender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )
    
    return ChallengeResponse.from_orm(challenge)


@router.post("/{challenge_id}/accept", status_code=status.HTTP_200_OK)
def accept_challenge(
    challenge_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Accept a pending challenge"""
    current_user = get_current_user(authorization, db)
    
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )
    
    # Only defender can accept
    if challenge.defender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the defender can accept this challenge"
        )
    
    # Can only accept pending challenges
    if challenge.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot accept a {challenge.status} challenge"
        )
    
    # Update status
    challenge.status = "accepted"
    db.commit()
    db.refresh(challenge)
    
    return ChallengeResponse.from_orm(challenge)


@router.post("/{challenge_id}/deny", status_code=status.HTTP_200_OK)
def deny_challenge(
    challenge_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """Deny/reject a pending challenge"""
    current_user = get_current_user(authorization, db)
    
    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )
    
    # Only defender can deny
    if challenge.defender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the defender can deny this challenge"
        )
    
    # Can only deny pending challenges
    if challenge.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot deny a {challenge.status} challenge"
        )
    
    # Update status
    challenge.status = "rejected"
    db.commit()
    db.refresh(challenge)
    
    return ChallengeResponse.from_orm(challenge)
