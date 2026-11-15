"""Instagram Reels Adapter for ZCodeDev Social Publisher.

Uses official Instagram Graph API v22.0 with direct binary resumable upload
via rupload.facebook.com, container status polling, and first comment posting.
"""

import json
import os
import time
from typing import Any, Dict
import requests
from src.logging_setup import setup_logger
from src.platforms.base import BasePlatformAdapter, PublishResult

logger = setup_logger("zcodedev_instagram")

GRAPH_API_VERSION = "v22.0"
GRAPH_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


class InstagramAdapter(BasePlatformAdapter):
    """Handles publishing Reels to an Instagram Professional (Creator/Business) account."""

    def __init__(self):
        super().__init__("instagram")

    def verify_account(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Queries Instagram account info to verify professional status, followers, and avatar."""
        ig_user_id = credentials.get("ig_user_id")
        access_token = credentials.get("access_token")

        if not ig_user_id or not access_token:
            return {"valid": False, "error": "Missing ig_user_id or access_token in credentials."}

        try:
            url = f"{GRAPH_BASE_URL}/{ig_user_id}"
            params = {
                "fields": "id,username,name,profile_picture_url,followers_count,media_count",
                "access_token": access_token,
            }
            res = requests.get(url, params=params, timeout=15)
            data = res.json()

            if "error" in data:
                return {"valid": False, "error": data["error"].get("message", "API Error")}

            return {
                "valid": True,
                "ig_user_id": data.get("id"),
                "username": data.get("username"),
                "name": data.get("name"),
                "profile_picture_url": data.get("profile_picture_url") or "",
                "followers_count": int(data.get("followers_count") or 0),
                "media_count": int(data.get("media_count") or 0),
                "is_professional": True,
            }
        except Exception as e:
            logger.error(f"Instagram account verification failed: {e}")
            return {"valid": False, "error": str(e)}

    def upload(self, job: Dict[str, Any], credentials: Dict[str, Any]) -> PublishResult:
        """Executes the container creation -> rupload binary push -> poll -> publish -> first comment workflow."""
        video_path = job["video_path"]
        if not os.path.exists(video_path):
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=f"Video file does not exist: {video_path}",
            )

        ig_user_id = credentials.get("ig_user_id")
        access_token = credentials.get("access_token")

        if not ig_user_id or not access_token:
            return PublishResult(
                success=False,
                status="FAILED",
                error_message="Missing ig_user_id or access_token.",
            )

        file_size = os.path.getsize(video_path)
        caption = job.get("caption") or ""
        hashtags = job.get("hashtags") or ""
        full_caption = f"{caption}\n\n{hashtags}".strip()

        try:
            container_url = f"{GRAPH_BASE_URL}/{ig_user_id}/media"
            raw_settings = job.get("platform_settings")
            settings: Dict[str, Any] = {}
            if isinstance(raw_settings, str):
                try:
                    settings = json.loads(raw_settings)
                except Exception:
                    settings = {}
            elif isinstance(raw_settings, dict):
                settings = raw_settings

            ig_settings = (
                settings.get("instagram", settings)
                if isinstance(settings.get("instagram"), dict)
                else settings
            )

            container_payload: Dict[str, Any] = {
                "media_type": "REELS",
                "upload_type": "resumable",
                "caption": full_caption[:2200],
                "share_to_feed": bool(ig_settings.get("share_to_feed", True)),
                "access_token": access_token,
            }
            if ig_settings.get("is_created_with_ai") or ig_settings.get("is_ai_generated"):
                container_payload["is_created_with_ai"] = True

            audio_name = ig_settings.get("audio_name")
            if audio_name and str(audio_name).strip():
                container_payload["audio_name"] = str(audio_name).strip()[:100]

            collabs = ig_settings.get("collaborators")
            if collabs:
                if isinstance(collabs, str):
                    collabs_list = [c.strip().lstrip("@") for c in collabs.split(",") if c.strip()]
                elif isinstance(collabs, list):
                    collabs_list = [str(c).strip().lstrip("@") for c in collabs if str(c).strip()]
                else:
                    collabs_list = []
                if collabs_list:
                    container_payload["collaborators"] = json.dumps(collabs_list[:3])

            user_tags = ig_settings.get("user_tags")
            if user_tags and str(user_tags).strip():
                ut_list = [
                    {"username": u.strip().lstrip("@"), "x": 0.5, "y": 0.5}
                    for u in str(user_tags).split(",")
                    if u.strip()
                ]
                if ut_list:
                    container_payload["user_tags"] = json.dumps(ut_list[:5])

            if job.get("thumb_offset_ms") is not None:
                container_payload["thumb_offset"] = int(job["thumb_offset_ms"])

            logger.info(f"Creating Instagram Reels container for job {job.get('job_uid')}")
            c_res = requests.post(container_url, data=container_payload, timeout=25)
            c_data = c_res.json()

            if "error" in c_data:
                err_msg = c_data["error"].get("message", "Container creation error")
                logger.error(f"Instagram container creation failed: {err_msg}")
                return PublishResult(success=False, status="FAILED", error_message=err_msg)

            container_id = c_data.get("id")
            rupload_uri = c_data.get("uri") or f"https://rupload.facebook.com/ig-api-upload/{container_id}"

            logger.info(f"Streaming {file_size} bytes to Instagram rupload endpoint")
            headers = {
                "Authorization": f"OAuth {access_token}",
                "offset": "0",
                "file_size": str(file_size),
                "Content-Type": "video/mp4",
            }

            with open(video_path, "rb") as video_file:
                upload_res = requests.post(
                    rupload_uri,
                    headers=headers,
                    data=video_file,
                    timeout=180,
                )
            upload_data = upload_res.json()

            if not upload_data.get("success", False) and "error" in upload_data:
                err_msg = upload_data["error"].get("message", "Binary transfer failed")
                return PublishResult(success=False, status="FAILED", error_message=err_msg)

            logger.info(f"Polling Instagram container status: {container_id}")
            max_poll_attempts = 30
            status_code = "IN_PROGRESS"

            for poll_idx in range(max_poll_attempts):
                time.sleep(5)
                status_url = f"{GRAPH_BASE_URL}/{container_id}"
                s_res = requests.get(
                    status_url,
                    params={"fields": "status_code,status", "access_token": access_token},
                    timeout=15,
                )
                s_data = s_res.json()
                status_code = s_data.get("status_code", "IN_PROGRESS")
                logger.debug(f"Container {container_id} poll #{poll_idx + 1}: {status_code}")

                if status_code in ("FINISHED", "READY"):
                    break
                elif status_code == "ERROR":
                    err_msg = s_data.get("status", "Container processing error")
                    return PublishResult(
                        success=False,
                        status="FAILED",
                        remote_post_id=container_id,
                        error_message=f"Instagram media processing error: {err_msg}",
                    )

            if status_code not in ("FINISHED", "READY"):
                logger.warning(f"Container {container_id} did not finish processing in time ({status_code})")
                return PublishResult(
                    success=False,
                    status="UNKNOWN_OUTCOME",
                    remote_post_id=container_id,
                    error_message=f"Container processing timeout. Current state: {status_code}",
                )

            logger.info(f"Publishing container {container_id} to Instagram")
            publish_url = f"{GRAPH_BASE_URL}/{ig_user_id}/media_publish"
            p_res = requests.post(
                publish_url,
                data={"creation_id": container_id, "access_token": access_token},
                timeout=25,
            )
            p_data = p_res.json()

            if "error" in p_data:
                err_msg = p_data["error"].get("message", "Publishing error")
                return PublishResult(
                    success=False,
                    status="FAILED",
                    remote_post_id=container_id,
                    error_message=err_msg,
                )

            media_id = p_data.get("id")
            reel_url = f"https://www.instagram.com/reel/{media_id}/"
            logger.info(f"Instagram Reel published successfully: {media_id}")

            # Optional first comment via /{media_id}/comments
            first_comment = ig_settings.get("first_comment") or job.get("first_comment")
            if first_comment and str(first_comment).strip() and media_id:
                try:
                    requests.post(
                        f"{GRAPH_BASE_URL}/{media_id}/comments",
                        data={"message": str(first_comment).strip()[:2200], "access_token": access_token},
                        timeout=15,
                    )
                except Exception as cm_err:
                    logger.warning(f"Could not post Instagram first comment: {cm_err}")

            return PublishResult(
                success=True,
                status="PUBLISHED",
                remote_post_id=media_id,
                remote_url=reel_url,
                raw_response=p_data,
            )

        except requests.exceptions.Timeout as te:
            logger.warning(f"Instagram upload timeout: {te}")
            return PublishResult(
                success=False,
                status="UNKNOWN_OUTCOME",
                error_message=f"Network timeout during Instagram workflow: {te}",
            )
        except Exception as e:
            logger.error(f"Unexpected Instagram upload exception: {e}")
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=str(e),
            )

    def reconcile_status(self, remote_post_id: str, credentials: Dict[str, Any]) -> str:
        """Checks if a published Instagram media item exists and is active."""
        access_token = credentials.get("access_token")
        if not access_token:
            return "UNKNOWN_OUTCOME"

        try:
            url = f"{GRAPH_BASE_URL}/{remote_post_id}"
            params = {"fields": "id,media_type,permalink", "access_token": access_token}
            res = requests.get(url, params=params, timeout=15)
            data = res.json()
            if "id" in data:
                return "PUBLISHED"
            return "FAILED"
        except Exception as e:
            logger.error(f"Instagram reconciliation error for {remote_post_id}: {e}")
            return "UNKNOWN_OUTCOME"
