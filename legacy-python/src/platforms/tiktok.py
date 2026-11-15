"""TikTok Content Posting API Adapter for ZCodeDev Social Publisher.

Uses official TikTok Content Posting API v2 with FILE_UPLOAD direct chunk transfer,
creator information querying, and publish status reconciliation.
"""

import os
import time
from typing import Any, Dict, Optional
import requests
from src.logging_setup import setup_logger
from src.platforms.base import BasePlatformAdapter, PublishResult

logger = setup_logger("zcodedev_tiktok")

TIKTOK_API_BASE = "https://open.tiktokapis.com/v2"


class TikTokAdapter(BasePlatformAdapter):
    """Handles direct video publishing using TikTok Content Posting API v2."""

    def __init__(self):
        super().__init__("tiktok")

    def verify_account(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Queries creator profile info and available posting settings."""
        access_token = credentials.get("access_token")
        if not access_token:
            return {"valid": False, "error": "Missing access_token in TikTok credentials."}

        try:
            url = f"{TIKTOK_API_BASE}/post/publish/creator_info/query/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            }
            res = requests.post(url, headers=headers, json={}, timeout=15)
            data = res.json()

            error_info = data.get("error", {})
            if error_info.get("code") != "ok":
                return {"valid": False, "error": error_info.get("message", "TikTok API Error")}

            creator_data = data.get("data", {})
            return {
                "valid": True,
                "creator_nickname": creator_data.get("creator_nickname"),
                "creator_username": creator_data.get("creator_username"),
                "privacy_levels": creator_data.get("privacy_level_options", []),
                "max_duration_sec": creator_data.get("max_video_post_duration_sec"),
            }
        except Exception as e:
            logger.error(f"TikTok account verification failed: {e}")
            return {"valid": False, "error": str(e)}

    def upload(self, job: Dict[str, Any], credentials: Dict[str, Any]) -> PublishResult:
        """Executes the TikTok FILE_UPLOAD direct binary workflow."""
        video_path = job["video_path"]
        if not os.path.exists(video_path):
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=f"Video file does not exist: {video_path}",
            )

        access_token = credentials.get("access_token")
        if not access_token:
            return PublishResult(
                success=False,
                status="FAILED",
                error_message="Missing TikTok access_token.",
            )

        file_size = os.path.getsize(video_path)
        title = job.get("title") or ""
        caption = job.get("caption") or ""
        hashtags = job.get("hashtags") or ""
        full_title = f"{title} {caption} {hashtags}".strip()[:2200]

        headers = {
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json; charset=UTF-8",
        }

        try:
            # Step 1: Check creator settings and privacy level
            creator_info = self.verify_account(credentials)
            allowed_privacy = creator_info.get("privacy_levels", ["SELF_ONLY"])

            # Default to SELF_ONLY for safety unless PUBLIC_TO_EVERYONE is permitted
            desired_privacy = "PUBLIC_TO_EVERYONE" if "PUBLIC_TO_EVERYONE" in allowed_privacy else "SELF_ONLY"

            # Check platform_settings for TikTok
            raw_settings = job.get("platform_settings")
            tt_settings = {}
            if isinstance(raw_settings, str):
                try:
                    import json
                    tt_settings = json.loads(raw_settings)
                except Exception:
                    tt_settings = {}
            elif isinstance(raw_settings, dict):
                tt_settings = raw_settings

            tt_conf = tt_settings.get("tiktok", tt_settings) if isinstance(tt_settings.get("tiktok"), dict) else tt_settings

            cover_ms = int(job.get("thumb_offset_ms") or 1000)
            disable_comment = bool(tt_conf.get("disable_comment", False))
            disable_duet = bool(tt_conf.get("disable_duet", False))
            disable_stitch = bool(tt_conf.get("disable_stitch", False))
            brand_content = bool(tt_conf.get("brand_content_toggle", False))
            ai_generated = bool(tt_conf.get("ai_generated_content", False))

            post_info = {
                "title": full_title,
                "privacy_level": desired_privacy,
                "disable_duet": disable_duet,
                "disable_stitch": disable_stitch,
                "disable_comment": disable_comment,
                "video_cover_timestamp_ms": cover_ms,
            }
            if brand_content:
                post_info["brand_content_toggle"] = True
            if ai_generated:
                post_info["is_ai_generated"] = True

            # Step 2: Initialize Direct Video Post (FILE_UPLOAD)
            init_url = f"{TIKTOK_API_BASE}/post/publish/video/init/"
            init_payload = {
                "post_info": post_info,
                "source_info": {
                    "source": "FILE_UPLOAD",
                    "video_size": file_size,
                    "chunk_size": file_size,
                    "total_chunk_count": 1,
                },
            }

            logger.info(f"Initializing TikTok video post for job {job.get('job_uid')}")
            init_res = requests.post(init_url, headers=headers, json=init_payload, timeout=25)
            init_data = init_res.json()

            if init_data.get("error", {}).get("code") != "ok":
                err_msg = init_data.get("error", {}).get("message", "TikTok init failed")
                logger.error(f"TikTok init error: {err_msg}")
                return PublishResult(success=False, status="FAILED", error_message=err_msg)

            publish_id = init_data["data"]["publish_id"]
            upload_url = init_data["data"]["upload_url"]

            # Step 3: Stream Binary Content via PUT to upload_url
            logger.info(f"Streaming {file_size} bytes directly to TikTok upload_url")
            upload_headers = {
                "Content-Type": "video/mp4",
                "Content-Range": f"bytes 0-{file_size - 1}/{file_size}",
                "Content-Length": str(file_size),
            }

            with open(video_path, "rb") as video_file:
                put_res = requests.put(
                    upload_url,
                    headers=upload_headers,
                    data=video_file,
                    timeout=180,
                )

            if put_res.status_code not in (200, 201, 204):
                err_msg = f"TikTok upload HTTP {put_res.status_code}: {put_res.text}"
                logger.error(err_msg)
                return PublishResult(
                    success=False,
                    status="FAILED",
                    remote_post_id=publish_id,
                    error_message=err_msg,
                )

            # Step 4: Poll Publish Status
            logger.info(f"Polling TikTok publish status for publish_id: {publish_id}")
            fetch_url = f"{TIKTOK_API_BASE}/post/publish/status/fetch/"
            status_poll_payload = {"publish_id": publish_id}

            status_str = "PROCESSING_UPLOAD"
            for poll_idx in range(25):
                time.sleep(4)
                status_res = requests.post(fetch_url, headers=headers, json=status_poll_payload, timeout=15)
                status_data = status_res.json()

                if status_data.get("error", {}).get("code") == "ok":
                    status_str = status_data.get("data", {}).get("status", "PROCESSING")
                    logger.debug(f"TikTok publish poll #{poll_idx + 1}: {status_str}")

                    if status_str == "PUBLISH_COMPLETE":
                        break
                    elif status_str in ("FAILED", "CANCELLED"):
                        fail_reason = status_data.get("data", {}).get("fail_reason", "Publish failed")
                        return PublishResult(
                            success=False,
                            status="FAILED",
                            remote_post_id=publish_id,
                            error_message=f"TikTok publish failed: {fail_reason}",
                        )

            if status_str != "PUBLISH_COMPLETE":
                return PublishResult(
                    success=False,
                    status="PROCESSING",
                    remote_post_id=publish_id,
                    error_message=f"TikTok video is processing on servers (State: {status_str}).",
                )

            logger.info(f"TikTok post published successfully: {publish_id}")
            return PublishResult(
                success=True,
                status="PUBLISHED",
                remote_post_id=publish_id,
                remote_url=f"https://www.tiktok.com/@{creator_info.get('creator_username', 'me')}",
                raw_response=status_data,
            )

        except requests.exceptions.Timeout as te:
            logger.warning(f"TikTok upload timeout: {te}")
            return PublishResult(
                success=False,
                status="UNKNOWN_OUTCOME",
                error_message=f"Network timeout contacting TikTok API: {te}",
            )
        except Exception as e:
            logger.error(f"Unexpected TikTok upload exception: {e}")
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=str(e),
            )

    def reconcile_status(self, remote_post_id: str, credentials: Dict[str, Any]) -> str:
        """Fetches TikTok status for a publish_id."""
        access_token = credentials.get("access_token")
        if not access_token:
            return "UNKNOWN_OUTCOME"

        try:
            url = f"{TIKTOK_API_BASE}/post/publish/status/fetch/"
            headers = {
                "Authorization": f"Bearer {access_token}",
                "Content-Type": "application/json; charset=UTF-8",
            }
            res = requests.post(url, headers=headers, json={"publish_id": remote_post_id}, timeout=15)
            data = res.json()
            if data.get("error", {}).get("code") == "ok":
                status_val = data.get("data", {}).get("status", "")
                if status_val == "PUBLISH_COMPLETE":
                    return "PUBLISHED"
                elif status_val in ("PROCESSING_UPLOAD", "PROCESSING_DOWNLOAD"):
                    return "PROCESSING"
                elif status_val in ("FAILED", "CANCELLED"):
                    return "FAILED"
            return "UNKNOWN_OUTCOME"
        except Exception as e:
            logger.error(f"TikTok status reconciliation failed for {remote_post_id}: {e}")
            return "UNKNOWN_OUTCOME"
