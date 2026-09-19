from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
from typing import List
from database import get_db
from models import Challenge, User
from schemas import ChallengeResponse
from routes_users import get_current_user

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


def _to_response(challenge: Challenge) -> ChallengeResponse:
    """ChallengeResponse with challenger_name and defender_name filled in."""
    data = ChallengeResponse.from_orm(challenge).dict()
    data["challenger_name"] = challenge.challenger.username if challenge.challenger else None
    data["defender_name"] = challenge.defender.username if challenge.defender else None
    return ChallengeResponse(**data)

@router.get("/recent", response_model=List[ChallengeResponse])
def get_recent_challenges(db: Session = Depends(get_db)):
    """
    Get the most recently completed challenges globally for the public feed.
    """
    challenges = db.query(Challenge).filter(
        Challenge.status == "completed"
    ).order_by(Challenge.completed_at.desc()).limit(15).all()

    return [_to_response(c) for c in challenges]


@router.get("/mine", response_model=List[ChallengeResponse])
def list_my_challenges(
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Get current user's pending and accepted challenges.
    These are the active challenges that need attention.
    Completed/rejected/expired/void challenges aren't included since they're resolved.
    """
    current_user = get_current_user(authorization, db)

    challenges = db.query(Challenge).filter(
        or_(
            Challenge.challenger_id == current_user.id,
            Challenge.defender_id == current_user.id
        ),
        Challenge.status.in_(["pending", "accepted"])
    ).order_by(Challenge.created_at.desc()).all()

    return [_to_response(c) for c in challenges]


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

    return _to_response(challenge)


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

    # Update status. accepted_at marks when the game window opens: only games
    # that finish after it count toward auto-resolution.
    challenge.status = "accepted"
    challenge.accepted_at = datetime.utcnow()
    db.commit()
    db.refresh(challenge)

    return _to_response(challenge)


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

    return _to_response(challenge)
