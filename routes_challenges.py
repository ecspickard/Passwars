from fastapi import APIRouter, Depends, HTTPException, status, Header
from sqlalchemy.orm import Session

from database import get_db
from models import Challenge
from schemas import ChallengeResponse
from routes_users import get_current_user
from connection_manager import manager
from chess_api import find_game_result
from challenge_service import complete_challenge

router = APIRouter(prefix="/api/challenges", tags=["challenges"])


@router.post("/{challenge_id}/auto-resolve", response_model=ChallengeResponse)
async def auto_resolve_challenge(
    challenge_id: int,
    authorization: str = Header(None),
    db: Session = Depends(get_db)
):
    """
    Look for a completed, decisive Chess.com game between the two linked
    accounts that finished after the challenge was accepted, and resolve
    the challenge automatically (source="auto") if one is found.
    """
    current_user = get_current_user(authorization, db)

    challenge = db.query(Challenge).filter(Challenge.id == challenge_id).first()
    if not challenge:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Challenge not found")

    if current_user.id not in (challenge.challenger_id, challenge.defender_id):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Not a participant in this challenge")

    if challenge.status != "accepted" or not challenge.accepted_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenge must be accepted before it can be auto-resolved"
        )

    challenger = challenge.challenger
    defender = challenge.defender

    if not challenger.chess_username or not challenger.chess_verified_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Challenger has no verified Chess.com account linked"
        )
    if not defender.chess_username or not defender.chess_verified_at:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Defender has no verified Chess.com account linked"
        )

    result = find_game_result(challenger.chess_username, defender.chess_username, challenge.accepted_at)

    if not result:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No completed Chess.com game found between these players since the challenge was accepted"
        )

    winner_username = result["winner_username"].lower()
    winner_id = challenger.id if winner_username == challenger.chess_username.lower() else defender.id

    try:
        complete_challenge(db, challenge, winner_id, source="auto")
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    # Live-only notification: if a player isn't connected right now, this is
    # simply dropped. Surviving a refresh/offline gap would need a
    # notifications table - a Phase 2 item, not built here.
    await manager.send_to_user(challenge.challenger_id, {
        "type": "game_ended",
        "challenge_id": challenge.id,
        "winner_id": winner_id,
        "source": "auto"
    })
    await manager.send_to_user(challenge.defender_id, {
        "type": "game_ended",
        "challenge_id": challenge.id,
        "winner_id": winner_id,
        "source": "auto"
    })

    db.refresh(challenge)
    return ChallengeResponse.from_orm(challenge)
