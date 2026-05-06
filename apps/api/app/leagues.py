"""League registry for multi-league support."""

from __future__ import annotations

LEAGUES: list[dict] = [
    {
        "id": "premier-league",
        "name": "Premier League",
        "shortName": "EPL",
        "country": "England",
        "countryFlag": "🏴󠁧󠁢󠁥󠁮󠁧󠁿",
        "season": "2025-26",
        "isActive": True,
    },
    {
        "id": "la-liga",
        "name": "La Liga",
        "shortName": "LL",
        "country": "Spain",
        "countryFlag": "🇪🇸",
        "season": "2025-26",
        "isActive": True,
    },
    {
        "id": "bundesliga",
        "name": "Bundesliga",
        "shortName": "BL",
        "country": "Germany",
        "countryFlag": "🇩🇪",
        "season": "2025-26",
        "isActive": True,
    },
    {
        "id": "serie-a",
        "name": "Serie A",
        "shortName": "SA",
        "country": "Italy",
        "countryFlag": "🇮🇹",
        "season": "2025-26",
        "isActive": True,
    },
    {
        "id": "ligue-1",
        "name": "Ligue 1",
        "shortName": "L1",
        "country": "France",
        "countryFlag": "🇫🇷",
        "season": "2025-26",
        "isActive": True,
    },
    {
        "id": "chinese-super-league",
        "name": "Chinese Super League",
        "shortName": "CSL",
        "country": "China",
        "countryFlag": "🇨🇳",
        "season": "2025",
        "isActive": True,
    },
    {
        "id": "champions-league",
        "name": "UEFA Champions League",
        "shortName": "UCL",
        "country": "Europe",
        "countryFlag": "🇪🇺",
        "season": "2025-26",
        "isActive": True,
    },
]


def get_leagues() -> list[dict]:
    return LEAGUES


def get_league_by_id(league_id: str) -> dict | None:
    return next((l for l in LEAGUES if l["id"] == league_id), None)
