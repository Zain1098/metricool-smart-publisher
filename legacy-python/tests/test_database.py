"""Tests for SQLite database operations in ZCodeDev Social Publisher."""

import os
import tempfile
import pytest
from src.database import Database


@pytest.fixture
def temp_db():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        temp_path = f.name
    db = Database(temp_path)
    yield db
    try:
        if os.path.exists(temp_path):
            os.remove(temp_path)
    except OSError:
        pass


def test_db_initialization(temp_db):
    with temp_db.get_connection() as conn:
        cursor = conn.execute("SELECT name FROM sqlite_master WHERE type='table'")
        tables = [row["name"] for row in cursor.fetchall()]
        assert "jobs" in tables
        assert "duplicate_registry" in tables
        assert "settings" in tables


def test_create_and_get_job(temp_db):
    job_payload = {
        "job_uid": "test_uid_101",
        "video_path": "C:\\videos\\sample.mp4",
        "video_hash": "a1b2c3d4e5f6",
        "platform": "youtube",
        "title": "My Short",
        "caption": "Cool caption",
        "hashtags": "#shorts #ai",
        "scheduled_time_utc": "2026-10-15T12:00:00Z",
        "scheduled_time_local": "2026-10-15 17:00:00 (PKT)",
        "status": "PENDING",
    }
    job_id = temp_db.create_job(job_payload)
    assert job_id > 0

    fetched = temp_db.get_job_by_uid("test_uid_101")
    assert fetched is not None
    assert fetched["title"] == "My Short"
    assert fetched["platform"] == "youtube"
    assert fetched["status"] == "PENDING"


def test_update_job_status(temp_db):
    job_payload = {
        "job_uid": "test_uid_202",
        "video_path": "C:\\videos\\sample.mp4",
        "video_hash": "hash202",
        "platform": "instagram",
        "title": "Reel",
        "scheduled_time_utc": "2026-10-15T12:00:00Z",
        "scheduled_time_local": "2026-10-15 17:00:00 (PKT)",
        "status": "PENDING",
    }
    temp_db.create_job(job_payload)

    updated = temp_db.update_job_status(
        job_uid="test_uid_202",
        status="PUBLISHED",
        remote_post_id="ig_media_999",
        remote_url="https://instagram.com/reel/999",
    )
    assert updated is True

    fetched = temp_db.get_job_by_uid("test_uid_202")
    assert fetched["status"] == "PUBLISHED"
    assert fetched["remote_post_id"] == "ig_media_999"


def test_duplicate_registry(temp_db):
    assert temp_db.is_duplicate_upload("hash_abc", "facebook") is False
    temp_db.register_successful_upload("hash_abc", "facebook", "job_1")
    assert temp_db.is_duplicate_upload("hash_abc", "facebook") is True
    # Different platform should not be duplicate
    assert temp_db.is_duplicate_upload("hash_abc", "youtube") is False
