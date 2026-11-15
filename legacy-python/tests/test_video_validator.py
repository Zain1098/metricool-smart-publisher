"""Tests for Video Validator and Duplicate Checker."""

import os
import tempfile
import pytest
from src.database import Database
from src.duplicate_checker import DuplicateChecker, DuplicateVideoError
from src.video_validator import VideoMetadata, VideoValidationError, inspect_video, validate_for_platform


@pytest.fixture
def sample_video_file():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00isommp42")
        temp_path = f.name
    yield temp_path
    if os.path.exists(temp_path):
        os.remove(temp_path)


def test_video_metadata_aspect_ratio():
    # 9:16 vertical video (1080x1920)
    meta_vertical = VideoMetadata(file_path="dummy.mp4", size_bytes=1000, width=1080, height=1920, duration_sec=30.0)
    assert meta_vertical.aspect_ratio_str == "9:16"
    assert meta_vertical.is_vertical is True

    # 16:9 horizontal video (1920x1080)
    meta_horizontal = VideoMetadata(file_path="dummy.mp4", size_bytes=1000, width=1920, height=1080, duration_sec=30.0)
    assert meta_horizontal.aspect_ratio_str == "16:9"
    assert meta_horizontal.is_vertical is False


def test_validate_platform_rules():
    # Compliant 9:16 30s video
    good_meta = VideoMetadata(file_path="dummy.mp4", size_bytes=5 * 1024 * 1024, width=1080, height=1920, duration_sec=30.0)
    assert validate_for_platform(good_meta, "instagram") == []
    assert validate_for_platform(good_meta, "youtube") == []

    # Non-compliant landscape video
    bad_meta = VideoMetadata(file_path="dummy.mp4", size_bytes=5 * 1024 * 1024, width=1920, height=1080, duration_sec=30.0)
    issues = validate_for_platform(bad_meta, "instagram")
    assert len(issues) > 0
    assert "landscape" in issues[0].lower()


def test_duplicate_checker(sample_video_file):
    with tempfile.NamedTemporaryFile(suffix=".db", delete=False) as f:
        db_path = f.name
    db = Database(db_path)
    checker = DuplicateChecker(db)

    # Initial check should pass
    is_dup, vhash = checker.check_duplicate(sample_video_file, "youtube")
    assert is_dup is False
    assert len(vhash) == 64  # SHA-256 hex string

    # Register as published
    db.register_successful_upload(vhash, "youtube", "job_1")

    # Second check should raise DuplicateVideoError unless allow_repost=True
    with pytest.raises(DuplicateVideoError):
        checker.check_duplicate(sample_video_file, "youtube", allow_repost=False)

    # With allow_repost=True it should return is_dup=True without exception
    is_dup2, _ = checker.check_duplicate(sample_video_file, "youtube", allow_repost=True)
    assert is_dup2 is True

    try:
        if os.path.exists(db_path):
            os.remove(db_path)
    except OSError:
        pass
