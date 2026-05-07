"""File-based JSON storage for historical match snapshots.

Snapshots are stored under ``data/snapshots/{provider}/{league}/{season}/{match_id}.json``
relative to the project root.  All writes are atomic (write to a temp file in the
same directory, then ``os.replace``) so concurrent readers never see partial JSON.
"""

from __future__ import annotations

import json
import os
import tempfile
import threading
from pathlib import Path
from typing import Any

# Resolve the data directory relative to this file's location so it works
# regardless of the process working directory.
_DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "snapshots"


class StorageBackend:
    """File-system backed JSON store organised by provider / league / season."""

    def __init__(self, root: Path | None = None) -> None:
        self._root = root or _DATA_DIR
        self._lock = threading.Lock()

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _snapshot_path(
        self, provider: str, league: str, season: str, match_id: str
    ) -> Path:
        return self._root / provider / league / season / f"{match_id}.json"

    @staticmethod
    def _atomic_write(path: Path, data: dict[str, Any]) -> None:
        """Write *data* as JSON to *path* atomically.

        A temporary file is created in the same directory so that
        ``os.replace`` is guaranteed to be on the same filesystem.
        """
        path.parent.mkdir(parents=True, exist_ok=True)
        fd, tmp = tempfile.mkstemp(
            dir=str(path.parent), suffix=".tmp", prefix=".snap_"
        )
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as fh:
                json.dump(data, fh, ensure_ascii=False, indent=2, default=str)
            os.replace(tmp, path)
        except BaseException:
            # Clean up the temp file on failure.
            try:
                os.unlink(tmp)
            except OSError:
                pass
            raise

    @staticmethod
    def _read_json(path: Path) -> dict[str, Any]:
        with open(path, encoding="utf-8") as fh:
            return json.load(fh)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def save_snapshot(
        self,
        match_id: str,
        provider: str,
        league: str,
        season: str,
        data: dict[str, Any],
    ) -> Path:
        """Persist a match snapshot and return the file path.

        Parameters
        ----------
        match_id:
            Unique match identifier.
        provider:
            Data provider id (e.g. ``statsbomb-open-data``).
        league:
            League / competition slug (e.g. ``premier-league``).
        season:
            Season string (e.g. ``2025-2026``).
        data:
            Arbitrary JSON-serialisable match payload.
        """
        path = self._snapshot_path(provider, league, season, match_id)
        with self._lock:
            self._atomic_write(path, data)
        return path

    def load_snapshot(
        self,
        match_id: str,
        provider: str,
        league: str,
        season: str,
    ) -> dict[str, Any]:
        """Load a single snapshot by its coordinates.

        Raises ``FileNotFoundError`` when the snapshot does not exist.
        """
        path = self._snapshot_path(provider, league, season, match_id)
        if not path.is_file():
            raise FileNotFoundError(
                f"Snapshot not found: provider={provider} league={league} "
                f"season={season} match_id={match_id}"
            )
        with self._lock:
            return self._read_json(path)

    def list_snapshots(
        self,
        provider: str | None = None,
        league: str | None = None,
        season: str | None = None,
    ) -> list[dict[str, str]]:
        """Return metadata for every stored snapshot, optionally filtered.

        Each entry contains ``match_id``, ``provider``, ``league``, ``season``,
        and ``path`` keys.
        """
        results: list[dict[str, str]] = []
        if not self._root.is_dir():
            return results

        providers = [provider] if provider else sorted(
            d.name for d in self._root.iterdir() if d.is_dir()
        )
        for prov in providers:
            prov_dir = self._root / prov
            if not prov_dir.is_dir():
                continue
            leagues = [league] if league else sorted(
                d.name for d in prov_dir.iterdir() if d.is_dir()
            )
            for lg in leagues:
                lg_dir = prov_dir / lg
                if not lg_dir.is_dir():
                    continue
                seasons = [season] if season else sorted(
                    d.name for d in lg_dir.iterdir() if d.is_dir()
                )
                for seas in seasons:
                    seas_dir = lg_dir / seas
                    if not seas_dir.is_dir():
                        continue
                    for f in sorted(seas_dir.glob("*.json")):
                        results.append(
                            {
                                "match_id": f.stem,
                                "provider": prov,
                                "league": lg,
                                "season": seas,
                                "path": str(f),
                            }
                        )
        return results

    def delete_snapshot(
        self,
        match_id: str,
        provider: str,
        league: str,
        season: str,
    ) -> bool:
        """Delete a snapshot. Returns ``True`` if it existed, ``False`` otherwise."""
        path = self._snapshot_path(provider, league, season, match_id)
        with self._lock:
            if path.is_file():
                path.unlink()
                return True
        return False


# Module-level singleton used by the service layer.
storage = StorageBackend()
