import jwt
import bcrypt
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
import os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

load_dotenv()

JWT_SECRET = os.getenv("JWT_SECRET")
JWT_ALGORITHM = os.getenv("JWT_ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 10080))
ENCRYPTION_KEY = os.getenv("ENCRYPTION_KEY", "").encode()

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

def encrypt_password(plaintext: str) -> str:
    """Encrypt a password using AES-256-GCM"""
    if not ENCRYPTION_KEY or len(ENCRYPTION_KEY) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (256 bits)")
    
    nonce = os.urandom(12)  # 96-bit nonce
    cipher = AESGCM(ENCRYPTION_KEY)
    ciphertext = cipher.encrypt(nonce, plaintext.encode('utf-8'), None)
    # Return nonce + ciphertext as hex string
    return (nonce + ciphertext).hex()

def decrypt_password(encrypted: str) -> str:
    """Decrypt a password using AES-256-GCM"""
    if not ENCRYPTION_KEY or len(ENCRYPTION_KEY) != 32:
        raise ValueError("ENCRYPTION_KEY must be 32 bytes (256 bits)")
    
    data = bytes.fromhex(encrypted)
    nonce = data[:12]  # First 12 bytes are nonce
    ciphertext = data[12:]  # Rest is ciphertext
    cipher = AESGCM(ENCRYPTION_KEY)
    plaintext = cipher.decrypt(nonce, ciphertext, None)
    return plaintext.decode('utf-8')
