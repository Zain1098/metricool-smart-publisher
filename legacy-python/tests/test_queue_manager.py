"""Tests for QueueManager state machine and transitions."""

import os
import tempfile
import pytest
from src.database import Database
from src.queue_manager import QueueError, QueueManager


@pytest.fixture
def queue_env():
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00isommp42")
        video_path = f.name

    db = Database(db_path)
    qm = QueueManager(db)
    yield qm, video_path

    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except OSError:
        pass
    try:
        if os.path.exists(video_path):
            os.remove(video_path)
    except OSError:
        pass


def test_enqueue_and_transitions(queue_env):
    qm, video_path = queue_env

    # Enqueue
    job = qm.enqueue_video(
        video_path=video_path,
        platform="youtube",
        scheduled_local_str="2026-10-15 15:30:00",
        title="Test Reel",
        validate_specs=False,
    )
    uid = job["job_uid"]
    assert job["status"] == "PENDING"

    # Transition PENDING -> UPLOADING
    qm.transition_status(uid, "UPLOADING")
    fetched = qm.db.get_job_by_uid(uid)
    assert fetched["status"] == "UPLOADING"

    # Transition UPLOADING -> PUBLISHED
    qm.transition_status(uid, "PUBLISHED", remote_post_id="yt_123", remote_url="https://youtu.be/123")
    fetched = qm.db.get_job_by_uid(uid)
    assert fetched["status"] == "PUBLISHED"
    assert fetched["remote_post_id"] == "yt_123"

    # Invalid transition from PUBLISHED should raise QueueError
    with pytest.raises(QueueError):
        qm.transition_status(uid, "UPLOADING")


def test_cancel_and_retry(queue_env):
    qm, video_path = queue_env

    job = qm.enqueue_video(
        video_path=video_path,
        platform="tiktok",
        scheduled_local_str="2026-10-15 15:30:00",
        validate_specs=False,
    )
    uid = job["job_uid"]

    # Cancel pending job
    qm.cancel_job(uid)
    fetched = qm.db.get_job_by_uid(uid)
    assert fetched["status"] == "CANCELLED"

    # Cannot retry a cancelled job (only FAILED or UNKNOWN_OUTCOME)
    with pytest.raises(QueueError):
        qm.retry_job(uid)
