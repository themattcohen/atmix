"""SQLite state management for blog-engine pipeline runs."""

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path

ENGINE_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_DB_PATH = ENGINE_ROOT / "data" / "pipeline.db"

STEP_NAMES = ["nlp_input", "research", "write", "review"]


def _connect(db_path: str | Path | None = None) -> sqlite3.Connection:
    path = str(db_path or DEFAULT_DB_PATH)
    conn = sqlite3.connect(path)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def _row_to_dict(row: sqlite3.Row | None) -> dict | None:
    if row is None:
        return None
    return dict(row)


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def init_db(db_path: str | Path | None = None) -> str:
    """Create tables if they don't exist. Returns the db path used."""
    path = str(db_path or DEFAULT_DB_PATH)
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    conn = _connect(path)
    try:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS runs (
                id TEXT PRIMARY KEY,
                config_name TEXT NOT NULL,
                keyword TEXT NOT NULL,
                slug TEXT NOT NULL,
                secondary_keywords TEXT DEFAULT '[]',
                current_step INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                created_at TEXT,
                updated_at TEXT
            );
            CREATE TABLE IF NOT EXISTS steps (
                id TEXT PRIMARY KEY,
                run_id TEXT NOT NULL REFERENCES runs(id),
                step_index INTEGER NOT NULL,
                step_name TEXT NOT NULL,
                status TEXT DEFAULT 'pending',
                output_json TEXT,
                screenshots TEXT,
                user_notes TEXT,
                started_at TEXT,
                completed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_steps_run ON steps(run_id, step_index);
        """)
        # Migration: add secondary_keywords to existing DBs
        try:
            conn.execute("ALTER TABLE runs ADD COLUMN secondary_keywords TEXT DEFAULT '[]'")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists
        # Migration: add error column to steps
        try:
            conn.execute("ALTER TABLE steps ADD COLUMN error TEXT")
            conn.commit()
        except sqlite3.OperationalError:
            pass  # Column already exists
        conn.commit()
    finally:
        conn.close()
    return path


def create_run(config_name: str, keyword: str, slug: str, secondary_keywords: str = "[]") -> str:
    """Create a new pipeline run with pre-created step rows. Returns run_id."""
    run_id = uuid.uuid4().hex
    now = _now()
    conn = _connect()
    try:
        conn.execute(
            "INSERT INTO runs (id, config_name, keyword, slug, secondary_keywords, current_step, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, 0, 'active', ?, ?)",
            (run_id, config_name, keyword, slug, secondary_keywords, now, now),
        )
        for i, name in enumerate(STEP_NAMES):
            step_id = uuid.uuid4().hex
            conn.execute(
                "INSERT INTO steps (id, run_id, step_index, step_name, status) VALUES (?, ?, ?, ?, 'pending')",
                (step_id, run_id, i, name),
            )
        conn.commit()
    finally:
        conn.close()
    return run_id


def get_run(run_id: str) -> dict | None:
    conn = _connect()
    try:
        row = conn.execute("SELECT * FROM runs WHERE id = ?", (run_id,)).fetchone()
        return _row_to_dict(row)
    finally:
        conn.close()


def list_runs(status: str | None = None) -> list[dict]:
    conn = _connect()
    try:
        if status:
            rows = conn.execute("SELECT * FROM runs WHERE status = ? ORDER BY created_at DESC", (status,)).fetchall()
        else:
            rows = conn.execute("SELECT * FROM runs ORDER BY created_at DESC").fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def update_run(run_id: str, **kwargs) -> None:
    kwargs["updated_at"] = _now()
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [run_id]
    conn = _connect()
    try:
        conn.execute(f"UPDATE runs SET {sets} WHERE id = ?", vals)
        conn.commit()
    finally:
        conn.close()


def get_step(run_id: str, step_index: int) -> dict | None:
    conn = _connect()
    try:
        row = conn.execute(
            "SELECT * FROM steps WHERE run_id = ? AND step_index = ?",
            (run_id, step_index),
        ).fetchone()
        return _row_to_dict(row)
    finally:
        conn.close()


def get_steps(run_id: str) -> list[dict]:
    conn = _connect()
    try:
        rows = conn.execute(
            "SELECT * FROM steps WHERE run_id = ? ORDER BY step_index",
            (run_id,),
        ).fetchall()
        return [dict(r) for r in rows]
    finally:
        conn.close()


def delete_run(run_id: str) -> None:
    """Delete a run and its associated steps."""
    conn = _connect()
    try:
        conn.execute("DELETE FROM steps WHERE run_id = ?", (run_id,))
        conn.execute("DELETE FROM runs WHERE id = ?", (run_id,))
        conn.commit()
    finally:
        conn.close()


def update_step(run_id: str, step_index: int, **kwargs) -> None:
    sets = ", ".join(f"{k} = ?" for k in kwargs)
    vals = list(kwargs.values()) + [run_id, step_index]
    conn = _connect()
    try:
        conn.execute(
            f"UPDATE steps SET {sets} WHERE run_id = ? AND step_index = ?",
            vals,
        )
        conn.commit()
    finally:
        conn.close()
