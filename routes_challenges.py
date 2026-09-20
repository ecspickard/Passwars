from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session
from sqlalchemy import or_
from starlette.concurrency import run_in_threadpool
from typing import List
from database import get_db
from models import Challenge, User
from schemas import ChallengeResponse
from routes_users import get_current_user
from chess_api import find_game_result
from challenge_service import complete_challenge
from connection_manager import manager

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


@router.post("/{challenge_id}/check-game")
async def check_challenge_game(
    challenge_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Manually trigger an API check against Chess.com for this challenge.
    Searches both rated and unrated games, detects wins, losses, and draws.
    """
    current_user = get_current_user(authorization, db)

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Challenge not found"
        )

    if challenge.challenger_id != current_user.id and challenge.defender_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied"
        )

    # If already resolved:
    if challenge.status in ["completed", "draw", "void", "rejected", "expired"]:
        return {
            "status": "already_resolved",
            "challenge_status": challenge.status,
            "winner_id": challenge.winner_id,
            "message": f"Challenge is already {challenge.status}."
        }

    if challenge.status != "accepted":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Challenge is in status '{challenge.status}'. Only 'accepted' challenges can be checked on Chess.com."
        )

    challenger = challenge.challenger
    defender = challenge.defender

    if not challenger.chess_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenger does not have a linked Chess.com username."
        )
    if not defender.chess_username:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Defender does not have a linked Chess.com username."
        )

    if challenge.id % 2 == 0:
        expected_white = challenger.chess_username
        expected_black = defender.chess_username
    else:
        expected_white = defender.chess_username
        expected_black = challenger.chess_username

    result = await run_in_threadpool(
        find_game_result,
        expected_white,
        expected_black,
        challenge.accepted_at or challenge.created_at,
    )

    if not result:
        return {
            "status": "not_found",
            "message": f"No finished game found on Chess.com yet between @{expected_white} (White) and @{expected_black} (Black) after {challenge.accepted_at} UTC.",
            "searched_players": [expected_white, expected_black],
            "since": str(challenge.accepted_at),
        }

    ids = (challenge.challenger_id, challenge.defender_id)
    outcome = result.get("outcome")

    if outcome == "aborted":
        challenge.status = "void"
        challenge.completed_at = datetime.utcnow()
        challenge.result_source = "auto"
        db.commit()
        for uid in ids:
            await manager.send_to_user(
                uid,
                {
                    "type": "challenge_voided",
                    "challenge_id": challenge.id,
                    "source": "auto",
                },
            )
        return {
            "status": "resolved",
            "outcome": "aborted",
            "message": "Game was aborted on Chess.com. Challenge cancelled.",
            "url": result.get("url"),
            "end_time": str(result.get("end_time")),
        }

    if outcome == "draw":
        challenge.status = "draw"
        challenge.completed_at = datetime.utcnow()
        challenge.result_source = "auto"
        db.commit()
        for uid in ids:
            await manager.send_to_user(
                uid,
                {
                    "type": "game_ended",
                    "challenge_id": challenge.id,
                    "source": "auto",
                },
            )
        return {
            "status": "resolved",
            "outcome": "draw",
            "message": "Draw detected on Chess.com! Match resolved as a draw.",
            "url": result.get("url"),
            "end_time": str(result.get("end_time")),
        }

    winner_username = (result["winner_username"] or "").lower()
    verified_winner = (
        challenger
        if winner_username == challenger.chess_username.lower()
        else defender
    )

    complete_challenge(db, challenge, verified_winner.id, source="auto")

    for uid in ids:
        await manager.send_to_user(
            uid,
            {
                "type": "game_ended",
                "challenge_id": challenge.id,
                "winner_id": verified_winner.id,
                "source": "auto",
            },
        )

    return {
        "status": "resolved",
        "outcome": "win",
        "winner_id": verified_winner.id,
        "winner_username": result["winner_username"],
        "message": f"Game finished on Chess.com! Winner: @{result['winner_username']}.",
        "url": result.get("url"),
        "end_time": str(result.get("end_time")),
    }
