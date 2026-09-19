from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, UniqueConstraint, func
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, nullable=False, index=True)
    email = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Chess.com account link. chess_verification_code holds the one-time code
    # issued during linking and is cleared once verified; chess_verified_at
    # is null until the ownership check (see chess_api.py) succeeds.
    chess_username = Column(String(50), nullable=True, index=True)
    chess_verification_code = Column(String(20), nullable=True)
    chess_verified_at = Column(DateTime, nullable=True)

    # Relationships
    password_offerings = relationship("UserPassword", back_populates="user")
    password_bank = relationship("PasswordBank", back_populates="user")
    challenges_as_challenger = relationship("Challenge", foreign_keys="Challenge.challenger_id")
    challenges_as_defender = relationship("Challenge", foreign_keys="Challenge.defender_id")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class UserPassword(Base):
    __tablename__ = "user_passwords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(100), nullable=False)
    # Encrypted at rest (see utils.encrypt_secret/decrypt_secret) - only ever
    # decrypted on-demand via the reveal endpoint, never returned as plaintext
    # by default in any response.
    secret_value = Column(String(500), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Unique constraint: user can only offer each service once
    __table_args__ = (UniqueConstraint('user_id', 'service_name', name='unique_user_service'),)

    # Relationships
    user = relationship("User", back_populates="password_offerings")

    def __repr__(self):
        return f"<UserPassword(user_id={self.user_id}, service={self.service_name})>"


class PasswordBank(Base):
    __tablename__ = "password_bank"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(100), nullable=False)
    # Copied (still encrypted) from the loser's UserPassword.secret_value at
    # the moment the challenge completes - see challenge_service.py.
    secret_value = Column(String(500), nullable=False)
    collected_from = Column(Integer, ForeignKey("users.id"), nullable=True)
    collected_at = Column(DateTime, server_default=func.now())

    # Unique constraint: user can only have each service once
    __table_args__ = (UniqueConstraint('user_id', 'service_name', name='unique_user_collected_service'),)

    # Relationships
    user = relationship("User", back_populates="password_bank", foreign_keys=[user_id])

    def __repr__(self):
        return f"<PasswordBank(user_id={self.user_id}, service={self.service_name})>"


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    challenger_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    defender_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    challenger_service = Column(String(100), nullable=False)
    defender_service = Column(String(100), nullable=False)
    status = Column(String(20), default="pending")  # pending, accepted, rejected, completed
    accepted_at = Column(DateTime, nullable=True)  # bounds the Chess.com game search window
    # How the challenge's result was determined: "auto" (matched to a
    # Chess.com game via the public API) or "self_reported" (players
    # confirmed the outcome themselves). Null until completed.
    result_source = Column(String(20), nullable=True)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

    # Relationships
    challenger = relationship("User", foreign_keys=[challenger_id])
    defender = relationship("User", foreign_keys=[defender_id])
    game_moves = relationship("GameMove", back_populates="challenge")

    def __repr__(self):
        return f"<Challenge(id={self.id}, challenger={self.challenger_id}, defender={self.defender_id})>"


class GameMove(Base):
    __tablename__ = "game_moves"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id", ondelete="CASCADE"), nullable=False)
    move_number = Column(Integer, nullable=False)
    player_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    move = Column(String(10), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    # Relationships
    challenge = relationship("Challenge", back_populates="game_moves")

    def __repr__(self):
        return f"<GameMove(challenge_id={self.challenge_id}, move={self.move})>"