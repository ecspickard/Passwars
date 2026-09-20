"""
Helpers for talking to Chess.com's public API.

This API is unauthenticated and read-only - see
https://www.chess.com/news/view/published-data-api for the schema. There is
no OAuth/ownership proof built into it, so "verifying" a linked username here
means two separate things:

1. `chess_user_exists` - the username is real (used when a user first links it).
2. `verify_ownership_via_location` - the user actually controls that account,
   proven by asking them to temporarily paste a one-time code into their
   Chess.com profile's "Location" field, which the public API exposes.

`find_game_result` is used for auto-resolving a challenge: it searches the
challenger's monthly game archives for a decisive, completed game against the
defender that finished at or after the challenge's `accepted_at` timestamp.
"""
import requests
from datetime import datetime, timezone, timedelta
from typing import Optional

CHESS_API_BASE = "https://api.chess.com/pub"
REQUEST_HEADERS = {"User-Agent": "Passwars/1.0 (contact: admin@passwars.app)"}
REQUEST_TIMEOUT = 10


def chess_user_exists(username: str) -> bool:
    """Check whether a Chess.com username exists."""
    resp = requests.get(
        f"{CHESS_API_BASE}/player/{username}",
        headers=REQUEST_HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    return resp.status_code == 200


def get_chess_player_profile(username: str) -> Optional[dict]:
    """Fetch a Chess.com player's public profile, or None if it doesn't exist."""
    resp = requests.get(
        f"{CHESS_API_BASE}/player/{username}",
        headers=REQUEST_HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def get_chess_player_stats(username: str) -> Optional[dict]:
    """Fetch a Chess.com player's stats (ELO, etc.), or None if it doesn't exist."""
    resp = requests.get(
        f"{CHESS_API_BASE}/player/{username}/stats",
        headers=REQUEST_HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code != 200:
        return None
    return resp.json()


def verify_ownership_via_location(username: str, code: str) -> bool:
    """
    Ownership check: the user was asked to temporarily put `code` somewhere
    in the "Location" field of their Chess.com profile. Confirm it's there.
    """
    profile = get_chess_player_profile(username)
    if not profile:
        return False
    location = profile.get("location") or ""
    return code in location


def _archive_urls_since(username: str, since: datetime) -> list:
    """Return this player's monthly archive URLs from `since`'s month onward."""
    resp = requests.get(
        f"{CHESS_API_BASE}/player/{username}/games/archives",
        headers=REQUEST_HEADERS,
        timeout=REQUEST_TIMEOUT,
    )
    if resp.status_code != 200:
        return []

    archives = resp.json().get("archives", [])
    since_key = since.strftime("%Y/%m")
    # Archive URLs end in .../games/YYYY/MM - a plain string compare on that
    # suffix sorts correctly since both are zero-padded.
    return [url for url in archives if url[-7:] >= since_key]


def find_game_result(expected_white_username: str, expected_black_username: str, since: datetime) -> Optional[dict]:
    """
    Search Chess.com's public archives for a completed, decisive game between
    the two players that finished at or after `since` (normally the
    challenge's `accepted_at` time). Returns the most recent qualifying
    game's result, or None if nothing matches yet.

    Return shape: {"winner_username": str, "outcome": str, "end_time": datetime, "url": str}
    """
    if since.tzinfo is None:
        since = since.replace(tzinfo=timezone.utc)

    # 60-second grace window to handle clock drift between servers
    since_with_grace = since - timedelta(seconds=60)

    expected_white = expected_white_username.lower()
    expected_black = expected_black_username.lower()

    matches = []
    seen_urls = set()
    archive_urls = set(
        _archive_urls_since(expected_white_username, since_with_grace)
        + _archive_urls_since(expected_black_username, since_with_grace)
    )

    for url in archive_urls:
        resp = requests.get(url, headers=REQUEST_HEADERS, timeout=REQUEST_TIMEOUT + 5)
        if resp.status_code != 200:
            continue

        for game in resp.json().get("games", []):
            game_url = game.get("url")
            if game_url and game_url in seen_urls:
                continue
            if game_url:
                seen_urls.add(game_url)

            end_time = datetime.fromtimestamp(game.get("end_time", 0), tz=timezone.utc)
            if end_time < since_with_grace:
                continue

            # Enforce Fair Play Rules (rated or unrated both count)
            if game.get("rules") != "chess":
                continue
            if game.get("time_class") not in ("blitz", "rapid"):
                continue

            white = game.get("white", {})
            black = game.get("black", {})
            white_username = (white.get("username") or "").lower()
            black_username = (black.get("username") or "").lower()

            if white_username != expected_white or black_username != expected_black:
                continue

            white_result = white.get("result")
            black_result = black.get("result")

            if white_result == "win":
                winner_username = white_username
                outcome = "win"
            elif black_result == "win":
                winner_username = black_username
                outcome = "win"
            elif white_result in ("abandoned", "aborted") or black_result in ("abandoned", "aborted"):
                winner_username = None
                outcome = "aborted"
            else:
                # Everything else (agreed, repetition, stalemate, etc.)
                winner_username = None
                outcome = "draw"

            matches.append({
                "winner_username": winner_username,
                "outcome": outcome,
                "end_time": end_time,
                "url": game_url,
            })

    if not matches:
        return None

    return max(matches, key=lambda m: m["end_time"])
