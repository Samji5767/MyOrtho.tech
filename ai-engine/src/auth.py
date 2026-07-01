"""
AI Engine authentication and authorization middleware.

Every endpoint except /health and /ready requires:
  Authorization: Bearer <jwt>
  X-Internal-Token: <INTERNAL_API_SECRET>   (service-to-service only)

JWT is verified using the same JWT_SECRET as the backend (HS256 only).
Uses stdlib hmac/hashlib to avoid dependency on the system cryptography package.
Rate limiting is enforced per (org_id, endpoint) using a simple in-memory token bucket.
Every request produces a structured audit log entry.
"""

import base64
import hashlib
import hmac
import json
import logging
import os
import time
import uuid
from typing import Optional

from fastapi import HTTPException, Request

logger = logging.getLogger("ai-engine.auth")

# ── Configuration ─────────────────────────────────────────────────────────────

JWT_SECRET = os.getenv("JWT_SECRET", "")
INTERNAL_TOKEN = os.getenv("INTERNAL_API_SECRET", "")
# Max body size: 50 MB (enforced separately in ASGI middleware)
MAX_UPLOAD_BYTES = 50 * 1024 * 1024

# ── Rate limit store ──────────────────────────────────────────────────────────
# Simple token-bucket per (ip + endpoint), in-memory.
# slowapi is the proper solution but this provides a baseline without extra deps.

_rate_buckets: dict = {}   # key -> (count, window_start)
RATE_WINDOW_SEC = 60
RATE_LIMIT_DEFAULT = 30    # requests per minute per IP


def _rate_check(key: str, limit: int = RATE_LIMIT_DEFAULT) -> bool:
    """Returns True if request is allowed, False if rate-limited."""
    now = time.monotonic()
    count, window = _rate_buckets.get(key, (0, now))
    if now - window > RATE_WINDOW_SEC:
        count, window = 0, now
    count += 1
    _rate_buckets[key] = (count, window)
    return count <= limit


# ── Audit log ─────────────────────────────────────────────────────────────────

def audit(
    request: Request,
    *,
    action: str,
    org_id: Optional[str] = None,
    user_id: Optional[str] = None,
    outcome: str = "allow",
    detail: Optional[str] = None,
) -> None:
    entry = {
        "ts": time.time(),
        "trace_id": getattr(request.state, "trace_id", None),
        "ip": request.client.host if request.client else "unknown",
        "method": request.method,
        "path": request.url.path,
        "action": action,
        "org_id": org_id,
        "user_id": user_id,
        "outcome": outcome,
        "detail": detail,
    }
    logger.info(json.dumps(entry))


# ── JWT verification (stdlib only, HS256) ─────────────────────────────────────

def _b64url_decode(segment: str) -> bytes:
    """Base64url decode with padding."""
    pad = 4 - len(segment) % 4
    if pad != 4:
        segment += "=" * pad
    return base64.urlsafe_b64decode(segment)


def _verify_jwt(token: str) -> dict:
    """
    Decode and verify a HS256 JWT using stdlib hmac/hashlib.

    Validates:
      - Three-part structure
      - alg == HS256
      - HMAC-SHA256 signature
      - exp claim (if present)

    Returns the payload dict on success.
    """
    if not JWT_SECRET:
        raise HTTPException(
            status_code=500,
            detail="JWT_SECRET not configured on AI engine",
        )
    parts = token.split(".")
    if len(parts) != 3:
        raise HTTPException(status_code=401, detail="Invalid token structure")

    header_b64, payload_b64, sig_b64 = parts

    try:
        header = json.loads(_b64url_decode(header_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token header")

    if header.get("alg") != "HS256":
        raise HTTPException(
            status_code=401,
            detail=f"Unsupported algorithm: {header.get('alg')}. Only HS256 is accepted.",
        )

    # Verify signature
    signing_input = f"{header_b64}.{payload_b64}".encode()
    expected_sig = hmac.new(
        JWT_SECRET.encode(),
        signing_input,
        hashlib.sha256,
    ).digest()
    try:
        actual_sig = _b64url_decode(sig_b64)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token signature encoding")

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise HTTPException(status_code=401, detail="Invalid token signature")

    try:
        payload = json.loads(_b64url_decode(payload_b64))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token payload")

    # Check expiry
    exp = payload.get("exp")
    if exp is not None and time.time() > exp:
        raise HTTPException(status_code=401, detail="Token expired")

    return payload


# ── FastAPI dependencies ───────────────────────────────────────────────────────

async def require_auth(request: Request) -> dict:
    """
    Dependency that validates JWT or internal token.
    Returns the decoded JWT payload (or a synthetic payload for internal calls).
    """
    # Attach trace ID to every request
    request.state.trace_id = str(uuid.uuid4())

    # Internal service-to-service auth (backend → AI engine)
    internal = request.headers.get("X-Internal-Token", "")
    if internal:
        if not INTERNAL_TOKEN:
            audit(request, action="internal_auth", outcome="deny",
                  detail="INTERNAL_API_SECRET not configured")
            raise HTTPException(status_code=401, detail="Internal auth not configured")
        if internal != INTERNAL_TOKEN:
            audit(request, action="internal_auth", outcome="deny",
                  detail="invalid internal token")
            raise HTTPException(status_code=401, detail="Invalid internal token")
        audit(request, action="internal_auth", outcome="allow")
        return {"sub": "backend-service", "orgId": None, "role": "service"}

    # Bearer JWT auth
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        audit(request, action="jwt_auth", outcome="deny", detail="missing Authorization header")
        raise HTTPException(status_code=401, detail="Authorization header required")

    token = auth_header[7:]
    payload = _verify_jwt(token)

    org_id = payload.get("orgId") or payload.get("org_id")
    user_id = payload.get("sub")
    role = payload.get("role", "unknown")

    # Rate limiting per (org_id, endpoint)
    rate_key = f"{org_id or 'anon'}:{request.url.path}"
    if not _rate_check(rate_key):
        audit(request, action="rate_limit", org_id=org_id, user_id=user_id,
              outcome="deny", detail="rate limit exceeded")
        raise HTTPException(status_code=429, detail="Rate limit exceeded")

    audit(request, action="jwt_auth", org_id=org_id, user_id=user_id, outcome="allow")
    return {"sub": user_id, "orgId": org_id, "role": role}


async def require_upload_size(request: Request) -> None:
    """Reject requests over MAX_UPLOAD_BYTES early."""
    content_length = request.headers.get("content-length")
    if content_length and int(content_length) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Request body too large (max {MAX_UPLOAD_BYTES // (1024*1024)} MB)",
        )


def get_trace_id(request: Request) -> str:
    return getattr(request.state, "trace_id", "none")
