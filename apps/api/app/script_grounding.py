"""Script grounding service for LineupCast API.

Ported from ``packages/ai-script/src/grounding.ts``.  For each sentence in a
generated script, this module traces which prediction/lineup input fields were
referenced and assigns a confidence score.  Results are persisted to the
``script_groundings`` SQLite table.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime

from .db import get_db

# ---------------------------------------------------------------------------
# Types
# ---------------------------------------------------------------------------

# Source types mirror the TypeScript SourceType union
SOURCE_TYPES: dict[str, str] = {
    "match": "form",
    "lineups": "lineup",
    "prediction": "prediction",
    "goalScorers": "stats",
    "cardRisks": "stats",
    "style": "form",
    "duration": "form",
    "language": "form",
    "audience": "form",
}

# Provider names for each top-level data category
PROVIDER_MAP: dict[str, str] = {
    "match": "match-provider",
    "lineups": "lineup-provider",
    "prediction": "prediction-model",
    "goalScorers": "scorer-model",
    "cardRisks": "discipline-model",
    "style": "user-config",
    "duration": "user-config",
    "language": "user-config",
    "audience": "user-config",
}

# Section-to-field-path mapping (mirrors SECTION_FIELD_MAP in grounding.ts)
SECTION_FIELD_MAP: dict[str, list[str]] = {
    "opening": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "match.league",
        "style",
        "duration",
    ],
    "lineupIntro": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "lineups.home.formation",
        "lineups.away.formation",
        "lineups.home.players",
        "lineups.away.players",
    ],
    "tacticalBattle": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "lineups.home.formation",
        "lineups.away.formation",
        "lineups.home.players",
        "lineups.away.players",
    ],
    "predictionBrief": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "prediction.homeWin",
        "prediction.draw",
        "prediction.awayWin",
        "prediction.expectedHomeGoals",
        "prediction.expectedAwayGoals",
        "prediction.confidence",
    ],
    "playerFocus": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "lineups.home.players",
        "lineups.away.players",
        "goalScorers",
    ],
    "disciplineRisk": [
        "cardRisks",
    ],
    "shortVideoCaption": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "prediction.homeWin",
        "prediction.awayWin",
        "goalScorers",
    ],
    "teleprompterText": [
        "lineups.home.teamName",
        "lineups.away.teamName",
        "lineups.home.formation",
        "lineups.away.formation",
        "lineups.home.players",
        "lineups.away.players",
        "match.league",
        "prediction.homeWin",
        "prediction.draw",
        "prediction.awayWin",
        "prediction.expectedHomeGoals",
        "prediction.expectedAwayGoals",
        "prediction.confidence",
        "goalScorers",
        "cardRisks",
        "style",
        "duration",
    ],
}

# Numeric claim patterns — sentences matching these must have a source
_NUMERIC_PATTERNS: list[re.Pattern[str]] = [
    re.compile(r"\d+%"),                          # percentages
    re.compile(r"\d+\.\d+"),                       # decimals (e.g. xG values)
    re.compile(r"(?:win|draw|loss)\s+(?:chance|probability)", re.IGNORECASE),
    re.compile(r"expected\s+(?:goals|xG)", re.IGNORECASE),
    re.compile(r"(?:home|away)\s*(?:Win|win)", re.IGNORECASE),
]

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


@dataclass
class SourceRef:
    """A single source reference attached to a sentence."""

    type: str           # e.g. "prediction", "lineup", "stats", "form"
    path: str           # dot-separated field path, e.g. "prediction.homeWin"
    value: object = None
    provider: str = "unknown"
    confidence: float = 1.0


@dataclass
class SentenceGrounding:
    """Grounding information for a single sentence."""

    sentence_index: int
    sentence: str
    source_refs: list[SourceRef] = field(default_factory=list)
    confidence: float = 0.0
    flagged: bool = False       # True when a numeric claim lacks a source


@dataclass
class GroundingReport:
    """Full grounding report for a script."""

    script_id: str
    sentences: list[SentenceGrounding] = field(default_factory=list)
    total_sentences: int = 0
    avg_confidence: float = 0.0
    fully_grounded: int = 0
    partially_grounded: int = 0
    ungrounded: int = 0
    unsourced_claims: int = 0
    unique_fields: list[str] = field(default_factory=list)
    generated_at: str = ""


# ---------------------------------------------------------------------------
# Sentence splitting
# ---------------------------------------------------------------------------

_SENTENCE_SPLIT = re.compile(r"(?<=[。！？；.!?;])\s*|\n\n+")


def _split_into_sentences(text: str) -> list[str]:
    """Split text into individual sentences.

    Handles both Chinese and English sentence-ending punctuation as well as
    paragraph breaks.
    """
    parts = _SENTENCE_SPLIT.split(text)
    return [s.strip() for s in parts if s.strip()]


# ---------------------------------------------------------------------------
# Nested value extraction
# ---------------------------------------------------------------------------


def _get_nested(data: dict, path: str) -> object:
    """Traverse *data* using a dot-separated *path*."""
    parts = path.split(".")
    current: object = data
    for part in parts:
        if not isinstance(current, dict):
            return None
        current = current.get(part)
    return current


def _extract_display_values(path: str, data: dict) -> list[tuple[object, str | None]]:
    """Return ``(raw_value, display_value)`` pairs for a field path.

    *display_value* is the string that would appear in the generated script
    text.  ``None`` means the field does not appear verbatim.
    """
    results: list[tuple[object, str | None]] = []
    top_key = path.split(".")[0]

    if path in (
        "lineups.home.teamName",
        "lineups.away.teamName",
        "lineups.home.formation",
        "lineups.away.formation",
        "match.league",
    ):
        val = _get_nested(data, path)
        if val is not None:
            results.append((val, str(val)))

    elif path == "prediction.homeWin":
        val = _get_nested(data, path)
        if val is not None:
            pct = round(float(val) * 100)
            results.append((val, f"{pct}%"))

    elif path == "prediction.draw":
        val = _get_nested(data, path)
        if val is not None:
            pct = round(float(val) * 100)
            results.append((val, f"{pct}%"))

    elif path == "prediction.awayWin":
        val = _get_nested(data, path)
        if val is not None:
            pct = round(float(val) * 100)
            results.append((val, f"{pct}%"))

    elif path in ("prediction.expectedHomeGoals", "prediction.expectedAwayGoals"):
        val = _get_nested(data, path)
        if val is not None:
            results.append((val, f"{float(val):.1f}"))

    elif path == "prediction.confidence":
        val = _get_nested(data, path)
        if val is not None:
            results.append((val, str(val)))

    elif path in ("lineups.home.players", "lineups.away.players"):
        players = _get_nested(data, path)
        if isinstance(players, list):
            for p in players:
                if isinstance(p, dict):
                    name = p.get("name", "")
                    if name:
                        results.append((p, name))

    elif path == "goalScorers":
        scorers = _get_nested(data, path)
        if isinstance(scorers, list):
            for gs in scorers:
                if isinstance(gs, dict):
                    player = gs.get("player", "")
                    if player:
                        results.append((gs, player))
                    prob = gs.get("probability")
                    if prob is not None:
                        results.append((gs, f"{prob}%"))

    elif path == "cardRisks":
        risks = _get_nested(data, path)
        if isinstance(risks, list):
            for cr in risks:
                if isinstance(cr, dict):
                    player = cr.get("player", "")
                    if player:
                        results.append((cr, player))
                    yr = cr.get("yellowRisk")
                    if yr is not None:
                        results.append((cr, str(yr)))

    elif path in ("style", "duration"):
        val = _get_nested(data, path)
        results.append((val, None))

    return results


# ---------------------------------------------------------------------------
# Source resolution
# ---------------------------------------------------------------------------


def _sentence_contains(sentence: str, value: str) -> bool:
    if not value:
        return False
    return value in sentence


def _is_referenced(sentence: str, value: object) -> bool:
    """Heuristic check: does *value* appear in *sentence*?"""
    if isinstance(value, list):
        for item in value:
            if isinstance(item, dict):
                for key in ("name", "player", "team"):
                    name = item.get(key)
                    if name and str(name) in sentence:
                        return True
        return False
    if isinstance(value, dict):
        for key in ("name", "player"):
            name = value.get(key)
            if name and str(name) in sentence:
                return True
        return False
    if isinstance(value, str):
        return value in sentence
    if isinstance(value, (int, float)):
        return str(value) in sentence
    return False


def _resolve_provider(path: str) -> str:
    top_key = path.split(".")[0]
    return PROVIDER_MAP.get(top_key, "unknown")


def _resolve_source_type(path: str) -> str:
    top_key = path.split(".")[0]
    return SOURCE_TYPES.get(top_key, "form")


def _resolve_sources(
    field_paths: list[str],
    prediction_data: dict,
    sentence: str,
) -> list[SourceRef]:
    """Resolve which input fields are referenced by *sentence*."""
    sources: list[SourceRef] = []
    seen: set[str] = set()

    for path in field_paths:
        display_pairs = _extract_display_values(path, prediction_data)
        matched = False

        for raw_val, display_val in display_pairs:
            if display_val is not None and _sentence_contains(sentence, display_val):
                key = f"{path}:{display_val}"
                if key not in seen:
                    seen.add(key)
                    sources.append(
                        SourceRef(
                            type=_resolve_source_type(path),
                            path=path,
                            value=raw_val,
                            provider=_resolve_provider(path),
                        )
                    )
                    matched = True

        # Fallback: heuristic matching for arrays / complex objects
        if not matched and not any(s.path == path for s in sources):
            field_val = _get_nested(prediction_data, path)
            if field_val is not None and _is_referenced(sentence, field_val):
                if path not in seen:
                    seen.add(path)
                    sources.append(
                        SourceRef(
                            type=_resolve_source_type(path),
                            path=path,
                            value=field_val,
                            provider=_resolve_provider(path),
                        )
                    )

    # If nothing matched, mark as template-only
    if not sources:
        sources.append(
            SourceRef(
                type="template",
                path="(template)",
                value=None,
                provider="template",
                confidence=0.2,
            )
        )

    return sources


# ---------------------------------------------------------------------------
# Confidence scoring
# ---------------------------------------------------------------------------


def _display_values_from_source(source: SourceRef) -> list[str]:
    """Extract display strings from a source's value for confidence calc."""
    values: list[str] = []
    val = source.value
    if val is None:
        return values
    if isinstance(val, dict):
        for key in ("name", "player", "team", "formation", "teamName"):
            v = val.get(key)
            if v is not None:
                values.append(str(v))
        for key in ("probability", "yellowRisk"):
            v = val.get(key)
            if v is not None:
                values.append(f"{v}%" if key == "probability" else str(v))
    else:
        values.append(str(val))
    return values


def _compute_confidence(sentence: str, sources: list[SourceRef]) -> float:
    """Compute 0-1 confidence: ratio of data characters to total characters.

    Mirrors the TypeScript ``computeConfidence`` heuristic.
    """
    if not sources:
        return 0.0
    if len(sources) == 1 and sources[0].path == "(template)":
        return 0.2

    data_chars = 0
    counted: set[str] = set()

    for src in sources:
        for dv in _display_values_from_source(src):
            if dv not in counted and dv in sentence:
                data_chars += len(dv)
                counted.add(dv)

    total = len(sentence)
    if total == 0:
        return 0.0

    ratio = data_chars / total
    # Scale: even 20% data coverage is decent for broadcast scripts
    return min(1.0, max(0.1, ratio * 2.5))


# ---------------------------------------------------------------------------
# Numeric claim validation
# ---------------------------------------------------------------------------


def _has_numeric_claim(sentence: str) -> bool:
    """Return True if *sentence* contains a numeric claim that requires a source."""
    return any(p.search(sentence) for p in _NUMERIC_PATTERNS)


def _has_real_source(sources: list[SourceRef]) -> bool:
    """Return True if at least one source is not template-only."""
    return any(s.path != "(template)" for s in sources)


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_grounding_report(
    script_id: str,
    script_content: str,
    prediction_data: dict,
) -> GroundingReport:
    """Generate a grounding report for *script_content*.

    For each sentence, traces which prediction/lineup fields are referenced,
    assigns a confidence score, and flags unsourced numeric claims.

    The result is deterministic -- same inputs always produce the same report.

    Args:
        script_id: Identifier of the script being grounded.
        script_content: Full text of the generated script.
        prediction_data: The ``ScriptGenerationInput``-shaped dict containing
            match, lineups, prediction, goalScorers, cardRisks, etc.

    Returns:
        A ``GroundingReport`` with per-sentence detail and summary stats.
    """
    sentences = _split_into_sentences(script_content)
    groundings: list[SentenceGrounding] = []

    # Gather all field paths from the section map (union of all sections)
    all_field_paths: list[str] = []
    seen_paths: set[str] = set()
    for paths in SECTION_FIELD_MAP.values():
        for p in paths:
            if p not in seen_paths:
                seen_paths.add(p)
                all_field_paths.append(p)

    unique_fields_set: set[str] = set()

    for idx, sentence in enumerate(sentences):
        sources = _resolve_sources(all_field_paths, prediction_data, sentence)
        confidence = _compute_confidence(sentence, sources)

        # Flag sentences with numeric claims that have no real source
        flagged = _has_numeric_claim(sentence) and not _has_real_source(sources)

        for src in sources:
            unique_fields_set.add(src.path)

        groundings.append(
            SentenceGrounding(
                sentence_index=idx,
                sentence=sentence,
                source_refs=sources,
                confidence=round(confidence, 4),
                flagged=flagged,
            )
        )

    # Summary stats
    total = len(groundings)
    avg_conf = (
        round(sum(g.confidence for g in groundings) / total, 4) if total else 0.0
    )
    fully = sum(1 for g in groundings if _has_real_source(g.source_refs) and g.confidence >= 0.6)
    partially = sum(
        1 for g in groundings if _has_real_source(g.source_refs) and g.confidence < 0.6
    )
    ungrounded = sum(1 for g in groundings if not _has_real_source(g.source_refs))
    unsourced = sum(1 for g in groundings if g.flagged)

    report = GroundingReport(
        script_id=script_id,
        sentences=groundings,
        total_sentences=total,
        avg_confidence=avg_conf,
        fully_grounded=fully,
        partially_grounded=partially,
        ungrounded=ungrounded,
        unsourced_claims=unsourced,
        unique_fields=sorted(unique_fields_set),
        generated_at=datetime.now(UTC).isoformat(),
    )

    # Persist each sentence grounding to SQLite
    _persist_grounding(report)

    return report


def get_grounding_report(script_id: str) -> GroundingReport | None:
    """Retrieve a persisted grounding report by *script_id*.

    Returns ``None`` if no grounding data exists for the given script.
    """
    db = get_db()
    rows = db.list_script_groundings(script_id)
    if not rows:
        return None

    sentences: list[SentenceGrounding] = []
    unique_fields_set: set[str] = set()

    for row in rows:
        src_refs_raw: list[dict] = json.loads(row["source_refs"]) if row["source_refs"] else []
        source_refs = [
            SourceRef(
                type=s.get("type", "form"),
                path=s.get("path", "(unknown)"),
                value=s.get("value"),
                provider=s.get("provider", "unknown"),
                confidence=s.get("confidence", 1.0),
            )
            for s in src_refs_raw
        ]
        for s in source_refs:
            unique_fields_set.add(s.path)

        sentences.append(
            SentenceGrounding(
                sentence_index=row.get("sentence_index", 0),
                sentence=row["sentence"],
                source_refs=source_refs,
                confidence=row.get("confidence", 0.0),
                flagged=row.get("flagged", False),
            )
        )

    total = len(sentences)
    avg_conf = (
        round(sum(g.confidence for g in sentences) / total, 4) if total else 0.0
    )
    fully = sum(1 for g in sentences if _has_real_source(g.source_refs) and g.confidence >= 0.6)
    partially = sum(
        1 for g in sentences if _has_real_source(g.source_refs) and g.confidence < 0.6
    )
    ungrounded = sum(1 for g in sentences if not _has_real_source(g.source_refs))
    unsourced = sum(1 for g in sentences if g.flagged)

    return GroundingReport(
        script_id=script_id,
        sentences=sentences,
        total_sentences=total,
        avg_confidence=avg_conf,
        fully_grounded=fully,
        partially_grounded=partially,
        ungrounded=ungrounded,
        unsourced_claims=unsourced,
        unique_fields=sorted(unique_fields_set),
        generated_at=sentences[0].sentence if sentences else "",
    )


# ---------------------------------------------------------------------------
# Persistence helpers
# ---------------------------------------------------------------------------


def _persist_grounding(report: GroundingReport) -> None:
    """Write grounding rows to the ``script_groundings`` table."""
    db = get_db()
    now = datetime.now(UTC).isoformat()

    for g in report.sentences:
        src_json = json.dumps(
            [
                {
                    "type": s.type,
                    "path": s.path,
                    "value": _serialise_value(s.value),
                    "provider": s.provider,
                    "confidence": s.confidence,
                }
                for s in g.source_refs
            ],
            default=str,
        )
        db.save_script_grounding(
            script_id=report.script_id,
            sentence=g.sentence,
            sentence_index=g.sentence_index,
            source_refs=src_json,
            confidence=g.confidence,
            flagged=g.flagged,
            created_at=now,
        )


def _serialise_value(val: object) -> object:
    """Best-effort JSON-safe value extraction."""
    if val is None:
        return None
    if isinstance(val, (str, int, float, bool)):
        return val
    if isinstance(val, dict):
        # Only keep display-relevant keys for large objects
        summary: dict = {}
        for key in ("name", "player", "team", "probability", "yellowRisk",
                     "formation", "teamName", "number"):
            if key in val:
                summary[key] = val[key]
        return summary if summary else str(val)
    if isinstance(val, list):
        return [_serialise_value(v) for v in val[:5]]  # cap at 5 items
    return str(val)
