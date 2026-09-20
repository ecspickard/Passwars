"""
Shared logic for finalizing a Challenge - used by both the WebSocket
`game_end` event (self-reported results) and the REST auto-resolve endpoint
(Chess.com-verified results), so the two paths can't drift out of sync.
"""
from datetime import datetime
from sqlalchemy.orm import Session

from models import Challenge, PasswordBank, UserPassword

VALID_RESULT_SOURCES = ("auto", "self_reported")


def complete_challenge(db: Session, challenge: Challenge, winner_id: int, source: str) -> PasswordBank:
    """
    Mark a challenge completed, transfer the loser's wagered secret into the
    winner's password bank, and record how the result was determined.

    The secret is copied over still-encrypted (both tables use the same
    at-rest encryption key), so this never touches plaintext.

    Raises ValueError if `source` isn't valid, the challenge isn't in
    'accepted' status, or the loser's offering can't be found (which would
    indicate a data-integrity problem, since an accepted challenge should
    always have a matching offering).
    """
    if source not in VALID_RESULT_SOURCES:
        raise ValueError(f"Invalid result source: {source!r}")

    if challenge.status != "accepted":
        raise ValueError(f"Challenge {challenge.id} is not in 'accepted' status (currently {challenge.status!r})")

    loser_id = challenge.defender_id if winner_id == challenge.challenger_id else challenge.challenger_id
    loser_service = challenge.defender_service if winner_id == challenge.challenger_id else challenge.challenger_service

    loser_offering = db.query(UserPassword).filter(
        UserPassword.user_id == loser_id,
        UserPassword.service_name == loser_service
    ).first()

    if not loser_offering:
        raise ValueError(
            f"No offering found for user {loser_id} / service {loser_service!r} - "
            "cannot transfer secret"
        )

    password_bank = db.query(PasswordBank).filter(
        PasswordBank.user_id == winner_id,
        PasswordBank.service_name == loser_service,
        PasswordBank.collected_from == loser_id
    ).first()

    if password_bank:
        password_bank.secret_value = loser_offering.secret_value
        password_bank.collected_from = loser_id
        password_bank.collected_at = datetime.utcnow()
    else:
        password_bank = PasswordBank(
            user_id=winner_id,
            service_name=loser_service,
            secret_value=loser_offering.secret_value,
            collected_from=loser_id
        )
        db.add(password_bank)

    challenge.winner_id = winner_id
    challenge.status = "completed"
    challenge.completed_at = datetime.utcnow()
    challenge.result_source = source

    db.commit()
    db.refresh(password_bank)
    return password_bank
