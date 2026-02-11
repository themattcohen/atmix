"""
Sync state persistence for GHL -> Baserow sync operations.
Tracks last sync times, cursors, and error states.
"""

import json
from datetime import datetime
from typing import Optional, Dict, Any
from pathlib import Path

STATE_FILE = Path(__file__).parent.parent.parent / "data" / "sync_state.json"


class SyncState:
    """Manages sync state persistence."""

    def __init__(self, state_file: Path = STATE_FILE):
        self.state_file = state_file
        self.state = self._load()

    def _load(self) -> Dict[str, Any]:
        """Load state from file or initialize."""
        if self.state_file.exists():
            with open(self.state_file, "r") as f:
                return json.load(f)
        return self._default_state()

    def _default_state(self) -> Dict[str, Any]:
        """Return default state structure."""
        return {
            "contacts": {
                "last_sync": None,
                "last_cursor": None,
                "total_synced": 0,
                "last_error": None,
            },
            "opportunities": {
                "last_sync": None,
                "last_cursor": None,
                "total_synced": 0,
                "last_error": None,
            },
            "newsletters": {
                "last_sync": None,
                "total_synced": 0,
                "last_error": None,
            },
            "errors": [],
        }

    def save(self) -> None:
        """Persist state to file."""
        self.state_file.parent.mkdir(parents=True, exist_ok=True)
        with open(self.state_file, "w") as f:
            json.dump(self.state, f, indent=2, default=str)

    def get_last_sync(self, entity: str) -> Optional[str]:
        """Get last sync timestamp for entity."""
        return self.state.get(entity, {}).get("last_sync")

    def set_last_sync(self, entity: str, timestamp: Optional[str] = None) -> None:
        """Update last sync timestamp."""
        if entity not in self.state:
            self.state[entity] = {}
        self.state[entity]["last_sync"] = (
            timestamp or datetime.utcnow().isoformat() + "Z"
        )
        self.save()

    def get_cursor(self, entity: str) -> Optional[str]:
        """Get last cursor for entity (for pagination)."""
        return self.state.get(entity, {}).get("last_cursor")

    def set_cursor(self, entity: str, cursor: Optional[str]) -> None:
        """Update cursor for entity."""
        if entity not in self.state:
            self.state[entity] = {}
        self.state[entity]["last_cursor"] = cursor
        self.save()

    def increment_synced(self, entity: str, count: int = 1) -> None:
        """Increment total synced count."""
        if entity not in self.state:
            self.state[entity] = {"total_synced": 0}
        self.state[entity]["total_synced"] = (
            self.state[entity].get("total_synced", 0) + count
        )
        self.save()

    def get_total_synced(self, entity: str) -> int:
        """Get total synced count for entity."""
        return self.state.get(entity, {}).get("total_synced", 0)

    def record_error(
        self, entity: str, error: str, context: Optional[Dict[str, Any]] = None
    ) -> None:
        """Record an error with context."""
        error_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "entity": entity,
            "error": str(error),
            "context": context or {},
        }
        if "errors" not in self.state:
            self.state["errors"] = []
        self.state["errors"].append(error_entry)
        if entity not in self.state:
            self.state[entity] = {}
        self.state[entity]["last_error"] = error_entry
        # Keep only last 100 errors
        self.state["errors"] = self.state["errors"][-100:]
        self.save()

    def clear_error(self, entity: str) -> None:
        """Clear last error for entity."""
        if entity in self.state:
            self.state[entity]["last_error"] = None
            self.save()

    def has_error(self, entity: str) -> bool:
        """Check if entity has an uncleared error."""
        return self.state.get(entity, {}).get("last_error") is not None

    def get_errors(self, limit: int = 10) -> list:
        """Get recent errors."""
        return self.state.get("errors", [])[-limit:]

    def get_summary(self) -> Dict[str, Any]:
        """Get sync state summary."""
        return {
            entity: {
                "last_sync": data.get("last_sync"),
                "total_synced": data.get("total_synced", 0),
                "has_error": data.get("last_error") is not None,
            }
            for entity, data in self.state.items()
            if entity != "errors"
        }

    def reset_entity(self, entity: str) -> None:
        """Reset state for a specific entity."""
        if entity in self.state:
            self.state[entity] = {
                "last_sync": None,
                "last_cursor": None,
                "total_synced": 0,
                "last_error": None,
            }
            self.save()

    def reset_all(self) -> None:
        """Reset all state to defaults."""
        self.state = self._default_state()
        self.save()
