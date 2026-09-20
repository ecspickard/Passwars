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

    # Chess.com account link
    chess_username = Column(String(50), nullable=True, index=True)
    chess_verification_code = Column(String(20), nullable=True)
    chess_verified_at = Column(DateTime, nullable=True)

    # Relationships - specify foreign_keys for PasswordBank since it has two FK to users
    password_offerings = relationship("UserPassword", back_populates="user", cascade="all, delete-orphan")
    password_bank = relationship("PasswordBank", back_populates="user", foreign_keys="PasswordBank.user_id", cascade="all, delete-orphan")
    challenges_as_challenger = relationship("Challenge", foreign_keys="Challenge.challenger_id", cascade="all, delete-orphan")
    challenges_as_defender = relationship("Challenge", foreign_keys="Challenge.defender_id", cascade="all, delete-orphan")

    def __repr__(self):
        return f"<User(id={self.id}, username={self.username})>"


class UserPassword(Base):
    __tablename__ = "user_passwords"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(100), nullable=False)
    secret_value = Column(String(255), nullable=False)
    created_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint('user_id', 'service_name', name='unique_user_service'),)

    user = relationship("User", back_populates="password_offerings")

    def __repr__(self):
        return f"<UserPassword(user_id={self.user_id}, service={self.service_name})>"


class PasswordBank(Base):
    __tablename__ = "password_bank"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    service_name = Column(String(100), nullable=False)
    secret_value = Column(String(255), nullable=False)
    collected_from = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    collected_at = Column(DateTime, server_default=func.now())

    __table_args__ = (UniqueConstraint('user_id', 'service_name', 'collected_from', name='unique_user_collected_service'),)

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
    status = Column(String(20), default="pending")
    accepted_at = Column(DateTime, nullable=True)
    result_source = Column(String(20), nullable=True)
    winner_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, server_default=func.now())
    completed_at = Column(DateTime, nullable=True)

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

    challenge = relationship("Challenge", back_populates="game_moves")

    def __repr__(self):
        return f"<GameMove(challenge_id={self.challenge_id}, move={self.move})>"


class PasswordAuditLog(Base):
    __tablename__ = "password_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    password_id = Column(Integer, ForeignKey("password_bank.id", ondelete="CASCADE"), nullable=False)
    action = Column(String(50), nullable=False)  # "viewed", "revealed", "collected"
    ip_address = Column(String(50), nullable=True)
    accessed_at = Column(DateTime, server_default=func.now())

    # Relationships
    user = relationship("User")
    password_bank = relationship("PasswordBank")

    def __repr__(self):
        return f"<PasswordAuditLog(user_id={self.user_id}, action={self.action})>"
    