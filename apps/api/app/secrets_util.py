"""Secret management: masking, hashing, and simple encryption for API keys."""

from __future__ import annotations

import hashlib
import hmac
import os
from base64 import b64decode, b64encode


def mask_api_key(key: str | None) -> str:
    """Return a masked version of an API key, e.g. 'sk-****abcd'."""
    if not key:
        return ""
    if len(key) <= 8:
        return "****"
    return f"{key[:3]}****{key[-4:]}"


def derive_encryption_key(secret: str | None = None) -> bytes:
    """Derive a 32-byte key from a secret string using SHA-256."""
    material = secret or os.getenv("LINEUPCAST_ENCRYPTION_SECRET", "lineupcast-dev-key-not-for-prod")
    return hashlib.sha256(material.encode()).digest()


def encrypt_value(plaintext: str, secret: str | None = None) -> str:
    """Simple XOR-based encryption for API keys.

    Returns base64-encoded ciphertext. For production, use a proper KMS.
    """
    key = derive_encryption_key(secret)
    key_stream = (key * (len(plaintext) // len(key) + 1))[: len(plaintext)]
    encrypted = bytes(a ^ b for a, b in zip(plaintext.encode(), key_stream))
    return b64encode(encrypted).decode()


def decrypt_value(ciphertext_b64: str, secret: str | None = None) -> str:
    """Decrypt a value encrypted by ``encrypt_value``."""
    key = derive_encryption_key(secret)
    encrypted = b64decode(ciphertext_b64)
    key_stream = (key * (len(encrypted) // len(key) + 1))[: len(encrypted)]
    return bytes(a ^ b for a, b in zip(encrypted, key_stream)).decode()


def constant_time_compare(a: str, b: str) -> bool:
    """Compare two strings in constant time."""
    return hmac.compare_digest(a.encode(), b.encode())
