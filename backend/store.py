"""Tiny JSON-file persistence layer.

Data is stored in a single JSON file on disk (default: backend/data.json).
Every mutation re-reads, applies, and atomically writes the file, so data
survives server restarts. Override the file location with BABY_DATA_FILE.
"""
import json
import os
import threading
import uuid
from pathlib import Path
from typing import Any, Callable, Dict

DATA_FILE = Path(
    os.environ.get("BABY_DATA_FILE", str(Path(__file__).parent / "data.json"))
)

_lock = threading.Lock()

DEFAULT: Dict[str, Any] = {
    "baby": {"birthday": None, "sex": None},
    "feedings": [],
    "sleeps": [],
    "eliminations": [],
    "supplements": [],
    "vitaminD": {},  # kept for back-compat
}


def _load() -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    if DATA_FILE.exists():
        try:
            with open(DATA_FILE, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception:
            data = {}
    merged = json.loads(json.dumps(DEFAULT))  # deep copy of defaults
    merged.update(data)
    return merged


def _save(data: Dict[str, Any]) -> None:
    tmp = DATA_FILE.with_suffix(".tmp")
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)
    os.replace(tmp, DATA_FILE)


def read() -> Dict[str, Any]:
    with _lock:
        return _load()


def write(mutator: Callable[[Dict[str, Any]], None]) -> Dict[str, Any]:
    """Apply `mutator` to the data under the lock, then persist."""
    with _lock:
        data = _load()
        mutator(data)
        _save(data)
        return data


def new_id() -> str:
    return uuid.uuid4().hex[:12]
