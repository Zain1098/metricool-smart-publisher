"""Database layer for ZCodeDev Social Publisher.

Provides persistent SQLite storage with WAL mode, transactions, schema migrations,
and indices for job queues and duplicate tracking.
"""

from contextlib import contextmanager
from datetime import datetime, timezone
import os
import sqlite3
from typing import Any, Dict, List, Optional
from src.logging_setup import setup_logger

logger = setup_logger("zcodedev_database")

DEFAULT_DB_PATH = os.path.join("data", "publisher.db")

SCHEMA_SQL = """
PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;
PRAGMA busy_timeout=5000;

CREATE TABLE IF NOT EXISTS jobs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_uid TEXT NOT NULL UNIQUE,
    video_path TEXT NOT NULL,
    video_hash TEXT NOT NULL,
    platform TEXT NOT NULL,
    title TEXT,
    caption TEXT,
    hashtags TEXT,
    privacy TEXT DEFAULT 'private',
    scheduled_time_utc TEXT NOT NULL,
    scheduled_time_local TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN (
        'DRAFT', 'PENDING', 'READY', 'UPLOADING', 'PROCESSING',
        'PUBLISHED', 'FAILED', 'CANCELLED', 'UNKNOWN_OUTCOME'
    )),
    attempts INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3,
    remote_post_id TEXT,
    remote_url TEXT,
    error_message TEXT,
    last_attempt_at TEXT,
    thumbnail_path TEXT,
    thumb_offset_ms INTEGER,
    platform_settings TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_sched ON jobs (status, scheduled_time_utc);
CREATE INDEX IF NOT EXISTS idx_jobs_hash_platform ON jobs (video_hash, platform);
CREATE INDEX IF NOT EXISTS idx_jobs_uid ON jobs (job_uid);

CREATE TABLE IF NOT EXISTS duplicate_registry (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    video_hash TEXT NOT NULL,
    platform TEXT NOT NULL,
    job_uid TEXT NOT NULL,
    first_uploaded_at TEXT NOT NULL,
    UNIQUE(video_hash, platform)
);

CREATE INDEX IF NOT EXISTS idx_duplicate_hash_plat ON duplicate_registry (video_hash, platform);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL
);
"""


class Database:
    """Manages SQLite connections and queries for the social publisher."""

    def __init__(self, db_path: str = DEFAULT_DB_PATH):
        self.db_path = db_path
        os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
        self.init_db()

    def get_connection(self) -> sqlite3.Connection:
        """Returns a connection with sqlite3.Row row_factory enabled."""
        conn = sqlite3.connect(self.db_path, timeout=10.0)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL;")
        conn.execute("PRAGMA foreign_keys=ON;")
        conn.execute("PRAGMA busy_timeout=5000;")
        return conn

    @contextmanager
    def transaction(self):
        """Context manager for atomic database transactions."""
        conn = self.get_connection()
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error(f"Transaction rolled back due to error: {e}")
            raise
        finally:
            conn.close()

    def init_db(self) -> None:
        """Initializes tables, indices, and applies column migrations."""
        try:
            with self.transaction() as conn:
                conn.executescript(SCHEMA_SQL)
                # Check for column migrations on existing database
                cursor = conn.execute("PRAGMA table_info(jobs)")
                existing_cols = {row["name"] for row in cursor.fetchall()}
                if "thumbnail_path" not in existing_cols:
                    conn.execute("ALTER TABLE jobs ADD COLUMN thumbnail_path TEXT")
                if "thumb_offset_ms" not in existing_cols:
                    conn.execute("ALTER TABLE jobs ADD COLUMN thumb_offset_ms INTEGER")
                if "platform_settings" not in existing_cols:
                    conn.execute("ALTER TABLE jobs ADD COLUMN platform_settings TEXT")
            logger.info(f"Database successfully initialized at {self.db_path}")
        except Exception as e:
            logger.critical(f"Failed to initialize database: {e}")
            raise

    # ---------------- Job Operations ----------------

    def create_job(self, job_data: Dict[str, Any]) -> int:
        """Inserts a new job into the queue."""
        now_iso = datetime.now(timezone.utc).isoformat()
        sql = """
        INSERT INTO jobs (
            job_uid, video_path, video_hash, platform, title, caption, hashtags,
            privacy, scheduled_time_utc, scheduled_time_local, status,
            attempts, max_attempts, thumbnail_path, thumb_offset_ms, platform_settings, created_at, updated_at
        ) VALUES (
            :job_uid, :video_path, :video_hash, :platform, :title, :caption, :hashtags,
            :privacy, :scheduled_time_utc, :scheduled_time_local, :status,
            :attempts, :max_attempts, :thumbnail_path, :thumb_offset_ms, :platform_settings, :created_at, :updated_at
        )
        """
        payload = {
            "title": "",
            "caption": "",
            "hashtags": "",
            "attempts": 0,
            "max_attempts": 3,
            "privacy": "private",
            "status": "PENDING",
            "thumbnail_path": None,
            "thumb_offset_ms": None,
            "platform_settings": None,
            "created_at": now_iso,
            "updated_at": now_iso,
            **job_data,
        }
        with self.transaction() as conn:
            cursor = conn.execute(sql, payload)
            job_id = cursor.lastrowid
            logger.info(f"Created job id={job_id} uid={payload['job_uid']} for {payload['platform']}")
            return job_id

    def get_job_by_uid(self, job_uid: str) -> Optional[Dict[str, Any]]:
        """Retrieves a single job by its unique UUID."""
        with self.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM jobs WHERE job_uid = ?", (job_uid,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def get_job_by_id(self, job_id: int) -> Optional[Dict[str, Any]]:
        """Retrieves a single job by its primary key ID."""
        with self.get_connection() as conn:
            cursor = conn.execute("SELECT * FROM jobs WHERE id = ?", (job_id,))
            row = cursor.fetchone()
            return dict(row) if row else None

    def update_job_status(
        self,
        job_uid: str,
        status: str,
        error_message: Optional[str] = None,
        remote_post_id: Optional[str] = None,
        remote_url: Optional[str] = None,
        increment_attempt: bool = False,
    ) -> bool:
        """Updates job status, outcome, and timestamps atomically."""
        now_iso = datetime.now(timezone.utc).isoformat()
        updates = ["status = ?", "updated_at = ?"]
        params: List[Any] = [status, now_iso]

        if error_message is not None:
            updates.append("error_message = ?")
            params.append(error_message)
        if remote_post_id is not None:
            updates.append("remote_post_id = ?")
            params.append(remote_post_id)
        if remote_url is not None:
            updates.append("remote_url = ?")
            params.append(remote_url)
        if increment_attempt:
            updates.append("attempts = attempts + 1")
            updates.append("last_attempt_at = ?")
            params.append(now_iso)

        params.append(job_uid)
        sql = f"UPDATE jobs SET {', '.join(updates)} WHERE job_uid = ?"

        with self.transaction() as conn:
            cursor = conn.execute(sql, params)
            updated = cursor.rowcount > 0
            if updated:
                logger.info(f"Updated job {job_uid} status -> {status}")
            return updated

    def list_jobs(
        self,
        status: Optional[str] = None,
        platform: Optional[str] = None,
        limit: int = 100,
        offset: int = 0,
    ) -> List[Dict[str, Any]]:
        """Fetches a list of jobs filtered by status/platform."""
        where_clauses = []
        params: List[Any] = []

        if status:
            where_clauses.append("status = ?")
            params.append(status)
        if platform:
            where_clauses.append("platform = ?")
            params.append(platform)

        where_sql = f"WHERE {' AND '.join(where_clauses)}" if where_clauses else ""
        sql = f"SELECT * FROM jobs {where_sql} ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, offset])

        with self.get_connection() as conn:
            cursor = conn.execute(sql, params)
            return [dict(row) for row in cursor.fetchall()]

    def get_pending_due_jobs(self, current_utc_iso: str) -> List[Dict[str, Any]]:
        """Fetches jobs that are in PENDING or READY status and due for publishing."""
        sql = """
        SELECT * FROM jobs
        WHERE status IN ('PENDING', 'READY')
          AND scheduled_time_utc <= ?
        ORDER BY scheduled_time_utc ASC
        """
        with self.get_connection() as conn:
            cursor = conn.execute(sql, (current_utc_iso,))
            return [dict(row) for row in cursor.fetchall()]

    # ---------------- Duplicate Registry ----------------

    def is_duplicate_upload(self, video_hash: str, platform: str) -> bool:
        """Checks if a video hash has already been successfully published to the platform."""
        sql = "SELECT 1 FROM duplicate_registry WHERE video_hash = ? AND platform = ?"
        with self.get_connection() as conn:
            cursor = conn.execute(sql, (video_hash, platform.lower()))
            return cursor.fetchone() is not None

    def register_successful_upload(self, video_hash: str, platform: str, job_uid: str) -> None:
        """Registers a successfully published video to prevent accidental re-uploads."""
        now_iso = datetime.now(timezone.utc).isoformat()
        sql = """
        INSERT OR IGNORE INTO duplicate_registry (video_hash, platform, job_uid, first_uploaded_at)
        VALUES (?, ?, ?, ?)
        """
        with self.transaction() as conn:
            conn.execute(sql, (video_hash, platform.lower(), job_uid, now_iso))
            logger.info(f"Registered successful upload hash={video_hash[:10]}... for platform={platform}")
