"""Facebook Reels & Video Adapter for ZCodeDev Social Publisher.

Uses official Meta Graph API v22.0 for direct binary upload to rupload.facebook.com,
native server-side scheduled publishing (scheduled_publish_time), and first comments.
"""

import os
from typing import Any, Dict
import requests
from src.logging_setup import setup_logger
from src.platforms.base import BasePlatformAdapter, PublishResult

logger = setup_logger("zcodedev_facebook")

GRAPH_API_VERSION = "v22.0"
GRAPH_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class FacebookAdapter(BasePlatformAdapter):
    """Handles publishing and server-side scheduling of Reels/Videos to a Facebook Page."""

    def __init__(self):
        super().__init__("facebook")

    def verify_account(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Queries Facebook Page details, avatar, and follower count."""
        page_id = credentials.get("page_id")
        access_token = credentials.get("page_access_token") or credentials.get("access_token")

        if not page_id or not access_token:
            return {"valid": False, "error": "Missing page_id or page_access_token in credentials."}

        try:
            url = f"{GRAPH_BASE_URL}/{page_id}"
            params = {
                "fields": "id,name,username,followers_count,fan_count,picture{url}",
                "access_token": access_token,
            }
            res = requests.get(url, params=params, timeout=15)
            data = res.json()

            if "error" in data:
                return {"valid": False, "error": data["error"].get("message", "API Error")}

            return {
                "valid": True,
                "page_id": data.get("id"),
                "page_name": data.get("name"),
                "username": data.get("username"),
                "followers_count": int(data.get("followers_count") or data.get("fan_count") or 0),
                "avatar_url": data.get("picture", {}).get("data", {}).get("url") or "",
            }
        except Exception as e:
            logger.error(f"Facebook account verification failed: {e}")
            return {"valid": False, "error": str(e)}

    def upload(self, job: Dict[str, Any], credentials: Dict[str, Any]) -> PublishResult:
        """Executes the 3-step Facebook Reels binary upload workflow with optional native scheduling."""
        video_path = job["video_path"]
        if not os.path.exists(video_path):
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=f"Video file does not exist: {video_path}",
            )

        page_id = credentials.get("page_id")
        access_token = credentials.get("page_access_token") or credentials.get("access_token")

        if not page_id or not access_token:
            return PublishResult(
                success=False,
                status="FAILED",
                error_message="Missing Facebook page_id or access_token.",
            )

        file_size = os.path.getsize(video_path)
        caption = job.get("caption") or ""
        hashtags = job.get("hashtags") or ""
        full_description = f"{caption} {hashtags}".strip()
        scheduled_unix = job.get("scheduled_unix")

        try:
            # Step 1: Initialize the upload session (start)
            init_url = f"{GRAPH_BASE_URL}/{page_id}/video_reels"
            init_payload = {
                "upload_phase": "start",
                "access_token": access_token,
            }
            logger.info(f"Initializing Facebook Reels session for job {job.get('job_uid')}")
            init_res = requests.post(init_url, json=init_payload, timeout=20)
            init_data = init_res.json()

            if "error" in init_data:
                err_msg = init_data["error"].get("message", "Facebook init error")
                logger.error(f"Facebook Reel init failed: {err_msg}")
                return PublishResult(success=False, status="FAILED", error_message=err_msg)

            video_id = init_data.get("video_id")
            upload_url = init_data.get("upload_url") or f"https://rupload.facebook.com/video-upload/{video_id}"

            # Step 2: Upload Direct Binary Data via rupload
            logger.info(f"Uploading {file_size} bytes directly to Facebook rupload endpoint: {video_id}")
            headers = {
                "Authorization": f"OAuth {access_token}",
                "Content-Type": "application/octet-stream",
                "offset": "0",
                "file_size": str(file_size),
            }

            with open(video_path, "rb") as video_file:
                transfer_res = requests.post(
                    upload_url,
                    headers=headers,
                    data=video_file,
                    timeout=180,
                )
            transfer_data = transfer_res.json()

            if not transfer_data.get("success", False) and "error" in transfer_data:
                err_msg = transfer_data["error"].get("message", "Binary upload failed")
                return PublishResult(success=False, status="FAILED", error_message=err_msg)

            # Step 3: Finish and Publish (or Schedule on Meta Servers)
            logger.info(f"Finalizing Facebook Reel publish for video {video_id}")
            fb_settings = job.get("platform_settings", {}).get("facebook", {}) or {}
            is_ai_generated = bool(
                fb_settings.get("is_created_with_ai")
                or job.get("is_ai_generated")
                or job.get("contains_synthetic_media")
            )
            paid_promotion = bool(
                fb_settings.get("paid_promotion") or job.get("paid_promotion")
            )
            sponsor_handle = str(
                fb_settings.get("sponsor_handle") or job.get("sponsor_handle") or ""
            ).strip()
            cta_type = str(fb_settings.get("call_to_action_type") or "NONE").strip()
            dest_link = str(fb_settings.get("destination_link") or "").strip()

            effective_desc = full_description
            if paid_promotion and sponsor_handle and sponsor_handle not in effective_desc:
                effective_desc = f"{effective_desc}\n\nPaid partnership with {sponsor_handle}".strip()
            if dest_link and dest_link not in effective_desc:
                effective_desc = f"{effective_desc}\n🔗 {dest_link}".strip()

            finish_payload: Dict[str, Any] = {
                "upload_phase": "finish",
                "video_id": video_id,
                "video_state": "SCHEDULED" if scheduled_unix else "PUBLISHED",
                "description": effective_desc,
                "access_token": access_token,
            }
            if is_ai_generated:
                finish_payload["is_created_with_ai"] = True
            if fb_settings.get("allow_embedding") is not None:
                finish_payload["embeddable"] = bool(fb_settings.get("allow_embedding"))
            if fb_settings.get("secret_video"):
                finish_payload["secret"] = True
            if cta_type and cta_type != "NONE" and dest_link:
                finish_payload["call_to_action"] = {
                    "type": cta_type,
                    "value": {"link": dest_link},
                }
            if scheduled_unix:
                finish_payload["scheduled_publish_time"] = int(scheduled_unix)
            if job.get("title"):
                finish_payload["title"] = str(job["title"])[:100]
            if job.get("thumb_offset_ms") is not None:
                finish_payload["thumb_offset"] = int(job["thumb_offset_ms"])

            finish_res = requests.post(init_url, json=finish_payload, timeout=30)
            finish_data = finish_res.json()

            if "error" in finish_data:
                err_msg = finish_data["error"].get("message", "Publish finalize error")
                return PublishResult(
                    success=False,
                    status="FAILED",
                    remote_post_id=video_id,
                    error_message=err_msg,
                )

            # Optional first comment if published immediately
            first_comment = fb_settings.get("first_comment") or job.get("first_comment")
            if first_comment and str(first_comment).strip() and not scheduled_unix:
                try:
                    requests.post(
                        f"{GRAPH_BASE_URL}/{video_id}/comments",
                        data={"message": str(first_comment).strip(), "access_token": access_token},
                        timeout=15,
                    )
                except Exception as cm_err:
                    logger.warning(f"Could not post Facebook first comment: {cm_err}")

            reel_url = f"https://www.facebook.com/watch/?v={video_id}"
            logger.info(f"Facebook Reel finalized successfully: {reel_url}")

            return PublishResult(
                success=True,
                status="SCHEDULED_ON_PLATFORM" if scheduled_unix else "PUBLISHED",
                remote_post_id=video_id,
                remote_url=reel_url,
                raw_response=finish_data,
            )

        except requests.exceptions.Timeout as te:
            logger.warning(f"Facebook upload timed out: {te}")
            return PublishResult(
                success=False,
                status="UNKNOWN_OUTCOME",
                error_message=f"Timeout connecting to Facebook API: {te}",
            )
        except Exception as e:
            logger.error(f"Unexpected Facebook upload exception: {e}")
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=str(e),
            )

    def reconcile_status(self, remote_post_id: str, credentials: Dict[str, Any]) -> str:
        """Queries Facebook video status."""
        access_token = credentials.get("page_access_token") or credentials.get("access_token")
        if not access_token:
            return "UNKNOWN_OUTCOME"

        try:
            url = f"{GRAPH_BASE_URL}/{remote_post_id}"
            params = {"fields": "status", "access_token": access_token}
            res = requests.get(url, params=params, timeout=15)
            data = res.json()

            status_obj = data.get("status", {})
            video_status = status_obj.get("video_status", "").lower()
            if video_status in ("ready", "published"):
                return "PUBLISHED"
            elif video_status in ("processing", "uploading", "scheduled"):
                return "PROCESSING"
            elif video_status in ("error", "failed"):
                return "FAILED"
            return "UNKNOWN_OUTCOME"
        except Exception as e:
            logger.error(f"Facebook reconciliation error for {remote_post_id}: {e}")
            return "UNKNOWN_OUTCOME"
