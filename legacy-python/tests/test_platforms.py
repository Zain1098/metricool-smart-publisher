"""Mocked unit tests for all platform adapters (YouTube, Facebook, Instagram, TikTok)."""

import os
import tempfile
from unittest.mock import MagicMock, patch
import pytest
from src.platforms.facebook import FacebookAdapter
from src.platforms.instagram import InstagramAdapter
from src.platforms.tiktok import TikTokAdapter
from src.platforms.youtube import YouTubeAdapter


@pytest.fixture
def dummy_video():
    with tempfile.NamedTemporaryFile(suffix=".mp4", delete=False) as f:
        f.write(b"\x00" * 1024)
        path = f.name
    yield path
    if os.path.exists(path):
        os.remove(path)


# ---------------- Facebook Adapter Tests ----------------

def test_facebook_adapter_mocked_success(dummy_video):
    adapter = FacebookAdapter()
    job = {
        "job_uid": "fb_job_1",
        "video_path": dummy_video,
        "caption": "Cool FB Reel",
        "hashtags": "#viral",
    }
    creds = {"page_id": "123456", "page_access_token": "EAABtestToken"}

    with patch("requests.post") as mock_post:
        # Mock step 1 (init), step 2 (binary transfer), step 3 (finish)
        mock_init_res = MagicMock()
        mock_init_res.json.return_value = {"video_id": "vid_987", "upload_url": "https://rupload.facebook.com/video-upload/vid_987"}

        mock_upload_res = MagicMock()
        mock_upload_res.json.return_value = {"success": True}

        mock_finish_res = MagicMock()
        mock_finish_res.json.return_value = {"success": True}

        mock_post.side_effect = [mock_init_res, mock_upload_res, mock_finish_res]

        result = adapter.upload(job, creds)
        assert result.success is True
        assert result.status == "PUBLISHED"
        assert result.remote_post_id == "vid_987"
        assert "facebook.com" in result.remote_url


# ---------------- Instagram Adapter Tests ----------------

def test_instagram_adapter_mocked_success(dummy_video):
    adapter = InstagramAdapter()
    job = {
        "job_uid": "ig_job_1",
        "video_path": dummy_video,
        "caption": "Cool IG Reel",
        "hashtags": "#reels",
    }
    creds = {"ig_user_id": "ig_user_888", "access_token": "IGAAtestToken"}

    with patch("requests.post") as mock_post, patch("requests.get") as mock_get, patch("time.sleep"):
        # Step 1: container create
        mock_container_res = MagicMock()
        mock_container_res.json.return_value = {"id": "container_456", "uri": "https://rupload.facebook.com/ig-api-upload/container_456"}

        # Step 2: binary upload
        mock_upload_res = MagicMock()
        mock_upload_res.json.return_value = {"success": True}

        # Step 3: poll status (GET)
        mock_poll_res = MagicMock()
        mock_poll_res.json.return_value = {"status_code": "FINISHED"}
        mock_get.return_value = mock_poll_res

        # Step 4: publish
        mock_publish_res = MagicMock()
        mock_publish_res.json.return_value = {"id": "ig_published_media_123"}

        mock_post.side_effect = [mock_container_res, mock_upload_res, mock_publish_res]

        result = adapter.upload(job, creds)
        assert result.success is True
        assert result.status == "PUBLISHED"
        assert result.remote_post_id == "ig_published_media_123"
        assert "instagram.com/reel" in result.remote_url


# ---------------- TikTok Adapter Tests ----------------

def test_tiktok_adapter_mocked_success(dummy_video):
    adapter = TikTokAdapter()
    job = {
        "job_uid": "tt_job_1",
        "video_path": dummy_video,
        "title": "My TikTok Video",
        "hashtags": "#foryou",
    }
    creds = {"access_token": "act.tiktokTestToken"}

    with patch("requests.post") as mock_post, patch("requests.put") as mock_put, patch("time.sleep"):
        # Creator info
        mock_creator_res = MagicMock()
        mock_creator_res.json.return_value = {
            "error": {"code": "ok"},
            "data": {"creator_username": "zcode_user", "privacy_level_options": ["PUBLIC_TO_EVERYONE", "SELF_ONLY"]},
        }

        # Init post
        mock_init_res = MagicMock()
        mock_init_res.json.return_value = {
            "error": {"code": "ok"},
            "data": {"publish_id": "tt_pub_789", "upload_url": "https://open-upload.tiktokapis.com/video"},
        }

        # Binary chunk upload (PUT)
        mock_put_res = MagicMock()
        mock_put_res.status_code = 200
        mock_put.return_value = mock_put_res

        # Status fetch
        mock_status_res = MagicMock()
        mock_status_res.json.return_value = {
            "error": {"code": "ok"},
            "data": {"status": "PUBLISH_COMPLETE"},
        }

        mock_post.side_effect = [mock_creator_res, mock_init_res, mock_status_res]

        result = adapter.upload(job, creds)
        assert result.success is True
        assert result.status == "PUBLISHED"
        assert result.remote_post_id == "tt_pub_789"
        assert "tiktok.com" in result.remote_url


# ---------------- YouTube Adapter Missing File Test ----------------

def test_youtube_adapter_missing_file():
    adapter = YouTubeAdapter()
    job = {"video_path": "non_existent_path.mp4"}
    creds = {"client_id": "abc", "client_secret": "def"}

    result = adapter.upload(job, creds)
    assert result.success is False
    assert result.status == "FAILED"
    assert "not found" in result.error_message.lower()


def test_instagram_adapter_with_advanced_settings(dummy_video):
    import json
    adapter = InstagramAdapter()
    job = {
        "job_uid": "ig_job_adv",
        "video_path": dummy_video,
        "caption": "AI Reel",
        "hashtags": "#ai",
        "platform_settings": {
            "instagram": {
                "is_created_with_ai": True,
                "share_to_feed": False,
                "audio_name": "Original Audio - Zain",
                "collaborators": "@coauthor1, @coauthor2"
            }
        }
    }
    creds = {"ig_user_id": "ig_user_888", "access_token": "IGAAtestToken"}

    with patch("requests.post") as mock_post, patch("requests.get") as mock_get, patch("time.sleep"):
        mock_container_res = MagicMock()
        mock_container_res.json.return_value = {"id": "container_456", "uri": "https://rupload.facebook.com/ig-api-upload/container_456"}

        mock_upload_res = MagicMock()
        mock_upload_res.json.return_value = {"success": True}

        mock_poll_res = MagicMock()
        mock_poll_res.json.return_value = {"status_code": "FINISHED"}
        mock_get.return_value = mock_poll_res

        mock_publish_res = MagicMock()
        mock_publish_res.json.return_value = {"id": "ig_published_adv_123"}

        mock_post.side_effect = [mock_container_res, mock_upload_res, mock_publish_res]

        result = adapter.upload(job, creds)
        assert result.success is True

        # Verify container creation payload
        first_call_data = mock_post.call_args_list[0][1]["data"]
        assert first_call_data["is_created_with_ai"] is True
        assert first_call_data["share_to_feed"] is False
        assert first_call_data["audio_name"] == "Original Audio - Zain"
        assert json.loads(first_call_data["collaborators"]) == ["coauthor1", "coauthor2"]


def test_tiktok_adapter_with_advanced_settings(dummy_video):
    adapter = TikTokAdapter()
    job = {
        "job_uid": "tt_job_adv",
        "video_path": dummy_video,
        "title": "TikTok AI Post",
        "platform_settings": {
            "tiktok": {
                "ai_generated_content": True,
                "disable_comment": True,
                "disable_duet": True,
                "disable_stitch": True,
                "brand_content_toggle": True
            }
        }
    }
    creds = {"access_token": "valid_token"}

    with patch("requests.post") as mock_post, patch("requests.put") as mock_put, patch("time.sleep"), patch.object(adapter, "verify_account") as mock_verify:
        mock_verify.return_value = {"privacy_levels": ["PUBLIC_TO_EVERYONE"]}

        mock_init_res = MagicMock()
        mock_init_res.json.return_value = {
            "error": {"code": "ok"},
            "data": {"publish_id": "pub_adv", "upload_url": "https://upload.tiktok.com/chunk"},
        }

        mock_put_res = MagicMock()
        mock_put_res.status_code = 200
        mock_put.return_value = mock_put_res

        mock_status_res = MagicMock()
        mock_status_res.json.return_value = {
            "error": {"code": "ok"},
            "data": {"status": "PUBLISH_COMPLETE"},
        }

        mock_post.side_effect = [mock_init_res, mock_status_res]

        result = adapter.upload(job, creds)
        assert result.success is True

        # Verify init post_info payload
        init_json = mock_post.call_args_list[0][1]["json"]["post_info"]
        assert init_json["is_ai_generated"] is True
        assert init_json["disable_comment"] is True
        assert init_json["disable_duet"] is True
        assert init_json["disable_stitch"] is True
        assert init_json["brand_content_toggle"] is True
