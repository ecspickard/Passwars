import jwt
import bcrypt
import secrets
import string
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from cryptography.fernet import Fernet, InvalidToken
import os

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))

# Fernet key for at-rest encryption of wagered secrets (UserPassword.secret_value,
# PasswordBank.secret_value). Generate one with:
#   python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
# and put it in .env as ENCRYPTION_KEY. Losing/rotating this key makes
# previously stored secrets permanently unreadable, so treat it like a
# production credential - back it up, don't commit it.
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY")

def hash_password(password: str) -> str:
    """Hash a password using bcrypt"""
    salt = bcrypt.gensalt()
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(password: str, password_hash: str) -> bool:
    """Verify a password against its hash"""
    return bcrypt.checkpw(password.encode('utf-8'), password_hash.encode('utf-8'))

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    """Create a JWT access token"""
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt

def decode_token(token: str) -> Optional[dict]:
    """Decode a JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


def _get_fernet() -> Fernet:
    if not ENCRYPTION_KEY:
        raise RuntimeError(
            "ENCRYPTION_KEY is not set. Generate one with "
            "Fernet.generate_key() and add it to your .env file."
        )
    key = ENCRYPTION_KEY.encode("utf-8") if isinstance(ENCRYPTION_KEY, str) else ENCRYPTION_KEY
    return Fernet(key)


def encrypt_secret(plaintext: str) -> str:
    """Encrypt a wagered secret (e.g. an offered password) before it's stored."""
    return _get_fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt_secret(ciphertext: str) -> str:
    """Decrypt a stored secret for reveal-on-demand display. Raises ValueError
    if the ciphertext can't be decrypted with the current key."""
    try:
        return _get_fernet().decrypt(ciphertext.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        raise ValueError("Unable to decrypt secret - invalid key or corrupted data")


def generate_verification_code(length: int = 10) -> str:
    """One-time code a user pastes into their Chess.com profile Location field
    to prove they control that account (see chess_api.verify_ownership_via_location)."""
    alphabet = string.ascii_uppercase + string.digits
    return "PSW-" + "".join(secrets.choice(alphabet) for _ in range(length))