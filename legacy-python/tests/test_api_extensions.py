"""Direct unit tests for advanced features: Batch scheduling, Platform details, and Meta Auto-Connect."""

from datetime import datetime
import os
import tempfile
from unittest.mock import MagicMock, patch
import pytest
from app import BatchScheduleRequest, batch_schedule_jobs, get_platforms_details, MetaSmartConnectRequest, smart_connect_meta
from src.meta_helper import auto_connect_meta


@pytest.fixture
def sample_video():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        # Minimal mp4 header
        f.write(b"\x00\x00\x00\x20ftypmp42\x00\x00\x00\x00isommp42" + b"\x00" * 500)
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


def test_get_platforms_details():
    details = get_platforms_details()
    assert isinstance(details, dict)
    assert "youtube" in details
    assert "facebook" in details
    assert "instagram" in details
    assert "tiktok" in details


def test_batch_schedule_jobs_direct(sample_video):
    req = BatchScheduleRequest(
        video_paths=[sample_video, sample_video],
        platforms=["youtube"],
        start_time="2026-10-16 18:00:00",
        stagger_interval_hours=24.0,
        title_template="Episode {n} Video",
        caption="Awesome batch reel",
        hashtags="#viral #reels",
        privacy="private",
        allow_repost=True,
    )

    data = batch_schedule_jobs(req)
    assert data["success"] is True
    assert data["total_scheduled"] == 2
    assert len(data["created"]) == 2
    assert data["created"][0]["title"] == "Episode 1 Video"
    assert data["created"][1]["title"] == "Episode 2 Video"

    t1 = data["created"][0]["scheduled_time_local"]
    t2 = data["created"][1]["scheduled_time_local"]
    assert "2026-10-16 18:00:00" in t1
    assert "2026-10-17 18:00:00" in t2


def test_meta_auto_connect_mock():
    with patch("requests.get") as mock_get, patch("src.meta_helper.CredentialManager.save_credentials"):
        mock_res = MagicMock()
        mock_res.json.return_value = {
            "data": [
                {
                    "id": "page_999",
                    "name": "My Tech Brand",
                    "access_token": "EAA_test_page_token",
                    "instagram_business_account": {
                        "id": "ig_biz_888",
                        "username": "mytechbrand_official",
                        "name": "My Tech Brand IG",
                    },
                }
            ]
        }
        mock_get.return_value = mock_res

        data = auto_connect_meta(token="EAA_short_lived_user_token")
        assert data["success"] is True
        assert data["facebook_connected"] is True
        assert data["page_name"] == "My Tech Brand"
        assert data["instagram_connected"] is True
        assert data["instagram_username"] == "mytechbrand_official"


def test_capture_thumbnail():
    import base64
    from app import CaptureThumbnailRequest, capture_thumbnail

    # 1x1 white jpeg
    fake_b64 = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA="
    req = CaptureThumbnailRequest(data_url=fake_b64, offset_ms=2500)
    res = capture_thumbnail(req)

    assert res["success"] is True
    assert res["thumb_offset_ms"] == 2500
    assert os.path.exists(res["thumbnail_path"])
    assert os.path.getsize(res["thumbnail_path"]) > 0

    # Cleanup
    if os.path.exists(res["thumbnail_path"]):
        os.remove(res["thumbnail_path"])


def test_upload_thumbnail():
    import asyncio
    from io import BytesIO
    from fastapi import UploadFile
    from app import upload_thumbnail

    fake_file = UploadFile(filename="custom_cover.png", file=BytesIO(b"\x89PNG\r\n\x1a\nfakeimagecontent"))
    res = asyncio.run(upload_thumbnail(fake_file))

    assert res["success"] is True
    assert res["thumb_offset_ms"] == 0
    assert os.path.exists(res["thumbnail_path"])
    assert os.path.getsize(res["thumbnail_path"]) > 0

    # Cleanup
    if os.path.exists(res["thumbnail_path"]):
        os.remove(res["thumbnail_path"])
