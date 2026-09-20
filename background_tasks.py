"""
Background poller that automatically resolves accepted challenges by
checking Chess.com for a finished, decisive game between the two linked
accounts - so players don't have to manually trigger auto-resolve. Also
expires stale pending challenges so an unanswered invite doesn't block the
challenger's offering from being deleted or reused forever.
"""
import asyncio
from datetime import datetime, timedelta

from starlette.concurrency import run_in_threadpool

from database import SessionLocal
from models import Challenge
from chess_api import find_game_result
from challenge_service import complete_challenge
from connection_manager import manager

POLL_INTERVAL_SECONDS = 45
PENDING_CHALLENGE_TTL = timedelta(hours=1)
ACCEPTED_CHALLENGE_TTL = timedelta(minutes=30)


async def _check_challenge(db, challenge: Challenge):
    challenger = challenge.challenger
    defender = challenge.defender

    if not challenger.chess_username or not challenger.chess_verified_at:
        return
    if not defender.chess_username or not defender.chess_verified_at:
        return

    if challenge.id % 2 == 0:
        expected_white = challenger.chess_username
        expected_black = defender.chess_username
    else:
        expected_white = defender.chess_username
        expected_black = challenger.chess_username

    # find_game_result uses `requests` (blocking) - run it off the event
    # loop so a slow Chess.com response doesn't freeze active websockets.
    result = await run_in_threadpool(
        find_game_result,
        expected_white,
        expected_black,
        challenge.accepted_at,
    )
    if not result:
        return

    outcome = result.get("outcome")
    
    if outcome == "aborted":
        challenge.status = "void"
        db.commit()
        for uid in (challenge.challenger_id, challenge.defender_id):
            await manager.send_to_user(uid, {"type": "challenge_voided", "challenge_id": challenge.id})
        return
        
    if outcome == "draw":
        challenge.status = "draw"
        challenge.completed_at = datetime.utcnow()
        db.commit()
        for uid in (challenge.challenger_id, challenge.defender_id):
            # Send game_ended so UI refreshes, but without a winner
            await manager.send_to_user(uid, {"type": "game_ended", "challenge_id": challenge.id, "source": "auto"})
        return

    winner_username = result["winner_username"].lower()
    winner_id = (
        challenger.id if winner_username == challenger.chess_username.lower() else defender.id
    )

    try:
        complete_challenge(db, challenge, winner_id, source="auto")
    except ValueError as e:
        # Data-integrity problem (e.g. missing offering) - log and move on,
        # don't crash the whole poll loop over one bad challenge.
        print(f"[poller] failed to complete challenge {challenge.id}: {e}")
        return

    for uid in (challenge.challenger_id, challenge.defender_id):
        await manager.send_to_user(
            uid,
            {
                "type": "game_ended",
                "challenge_id": challenge.id,
                "winner_id": winner_id,
                "source": "auto",
            },
        )


async def _expire_stale_pending_challenges(db):
    """Pending challenges older than the TTL auto-expire, so an unanswered
    invite doesn't block the challenger's offering from being deleted or
    reused forever."""
    from sqlalchemy import func
    cutoff = func.now() - PENDING_CHALLENGE_TTL
    stale = db.query(Challenge).filter(
        Challenge.status == "pending",
        Challenge.created_at < cutoff,
    ).all()

    for challenge in stale:
        challenge.status = "expired"
        db.commit()

        for uid in (challenge.challenger_id, challenge.defender_id):
            await manager.send_to_user(
                uid,
                {
                    "type": "challenge_expired",
                    "challenge_id": challenge.id,
                },
            )


async def _expire_stale_accepted_challenges(db):
    """Accepted challenges older than 30 minutes auto-expire, so an aborted
    game doesn't lock the passwords in an 'in progress' state forever."""
    from sqlalchemy import func
    cutoff = func.now() - ACCEPTED_CHALLENGE_TTL
    stale = db.query(Challenge).filter(
        Challenge.status == "accepted",
        Challenge.accepted_at < cutoff,
    ).all()

    for challenge in stale:
        challenge.status = "void"
        challenge.result_source = "auto"
        challenge.completed_at = datetime.utcnow()
        db.commit()

        for uid in (challenge.challenger_id, challenge.defender_id):
            await manager.send_to_user(
                uid,
                {
                    "type": "challenge_voided",
                    "challenge_id": challenge.id,
                },
            )


async def poll_accepted_challenges():
    """Runs forever: resolves accepted challenges via Chess.com, and expires
    stale pending ones."""
    while True:
        db = SessionLocal()
        try:
            challenges = db.query(Challenge).filter(Challenge.status == "accepted").all()
            for challenge in challenges:
                try:
                    await _check_challenge(db, challenge)
                except Exception as e:
                    print(f"[poller] error checking challenge {challenge.id}: {e}")

            try:
                await _expire_stale_pending_challenges(db)
                await _expire_stale_accepted_challenges(db)
            except Exception as e:
                print(f"[poller] error expiring stale challenges: {e}")
        finally:
            db.close()

        await asyncio.sleep(POLL_INTERVAL_SECONDS)