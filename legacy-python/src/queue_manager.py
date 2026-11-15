"""Job Queue Manager for ZCodeDev Social Publisher.

Coordinates job creation, state transitions, retry policies, and UNKNOWN_OUTCOME recovery.
"""

from datetime import datetime, timezone, timedelta
import json
import os
from typing import Any, Dict, List, Optional
import uuid
try:
    from zoneinfo import ZoneInfo
    KARACHI_TZ = ZoneInfo("Asia/Karachi")
except Exception:
    KARACHI_TZ = timezone(timedelta(hours=5), name="PKT")

from src.database import Database
from src.duplicate_checker import DuplicateChecker
from src.logging_setup import setup_logger
from src.video_validator import inspect_video, validate_for_platform

logger = setup_logger("zcodedev_queue_manager")

# Valid state machine transitions
ALLOWED_TRANSITIONS = {
    "DRAFT": {"PENDING", "CANCELLED"},
    "PENDING": {"READY", "UPLOADING", "CANCELLED", "FAILED"},
    "READY": {"UPLOADING", "CANCELLED", "FAILED"},
    "UPLOADING": {"PROCESSING", "PUBLISHED", "FAILED", "UNKNOWN_OUTCOME"},
    "PROCESSING": {"PUBLISHED", "FAILED", "UNKNOWN_OUTCOME"},
    "UNKNOWN_OUTCOME": {"PUBLISHED", "FAILED", "READY"},
    "FAILED": {"READY", "CANCELLED"},  # Can be re-queued to READY for manual/backoff retry
    "PUBLISHED": set(),  # Terminal state
    "CANCELLED": set(),  # Terminal state
}

# Non-recoverable error triggers (should not be auto-retried endlessly)
PERMANENT_ERROR_KEYWORDS = [
    "unauthorized",
    "invalid_grant",
    "permission_denied",
    "forbidden",
    "quota_exceeded",
    "account_restricted",
    "file_not_found",
    "invalid_format",
]


class QueueError(Exception):
    """Raised when queue operations violate state or validation rules."""
    pass


class QueueManager:
    """Manages publishing queue state transitions, creation, and retries."""

    def __init__(self, db: Database):
        self.db = db
        self.duplicate_checker = DuplicateChecker(db)

    def enqueue_video(
        self,
        video_path: str,
        platform: str,
        scheduled_local_str: str,
        title: Optional[str] = None,
        caption: Optional[str] = None,
        hashtags: Optional[str] = None,
        privacy: str = "private",
        allow_repost: bool = False,
        validate_specs: bool = True,
        thumbnail_path: Optional[str] = None,
        thumb_offset_ms: Optional[int] = None,
        platform_settings: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        """Validates video, parses Karachi schedule, checks duplicates, and inserts into queue.

        Args:
            video_path: Absolute or relative path to video.
            platform: 'youtube', 'instagram', 'facebook', or 'tiktok'.
            scheduled_local_str: Format 'YYYY-MM-DD HH:MM:SS' or ISO string in Karachi time.
            title: Video title.
            caption: Video caption/description.
            hashtags: Hashtags list or string.
            privacy: 'private', 'unlisted', or 'public'.
            allow_repost: If True, bypasses duplicate video detection.
            validate_specs: If True, enforces platform aspect ratio/duration constraints.
        """
        # 1. Inspect physical file
        meta = inspect_video(video_path)

        # 2. Check platform validation rules
        if validate_specs:
            issues = validate_for_platform(meta, platform)
            if issues:
                error_summary = "; ".join(issues)
                logger.warning(f"Validation warnings for {video_path} on {platform}: {error_summary}")

        # 3. Duplicate check via SHA-256
        is_dup, video_hash = self.duplicate_checker.check_duplicate(
            video_path, platform, allow_repost=allow_repost
        )

        # 4. Parse time: Interpret as Asia/Karachi time, compute UTC ISO
        try:
            # Try parsing multiple date formats
            dt_local = None
            for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%dT%H:%M:%S", "%Y-%m-%d %H:%M"):
                try:
                    dt_local = datetime.strptime(scheduled_local_str.strip(), fmt)
                    break
                except ValueError:
                    continue
            if not dt_local:
                dt_local = datetime.fromisoformat(scheduled_local_str.strip())

            if dt_local.tzinfo is None:
                dt_local = dt_local.replace(tzinfo=KARACHI_TZ)
            else:
                dt_local = dt_local.astimezone(KARACHI_TZ)

            dt_utc = dt_local.astimezone(timezone.utc)
            scheduled_time_utc = dt_utc.isoformat()
            scheduled_time_local = dt_local.strftime("%Y-%m-%d %H:%M:%S (%Z)")
        except Exception as e:
            raise QueueError(f"Invalid scheduled time '{scheduled_local_str}': {e}")

        # 5. Insert Job
        job_uid = f"job_{uuid.uuid4().hex[:12]}"
        job_data = {
            "job_uid": job_uid,
            "video_path": os.path.abspath(video_path),
            "video_hash": video_hash,
            "platform": platform.lower().strip(),
            "title": title or "",
            "caption": caption or "",
            "hashtags": hashtags or "",
            "privacy": privacy.lower(),
            "scheduled_time_utc": scheduled_time_utc,
            "scheduled_time_local": scheduled_time_local,
            "status": "PENDING",
            "max_attempts": 3,
            "thumbnail_path": os.path.abspath(thumbnail_path) if thumbnail_path and os.path.exists(thumbnail_path) else None,
            "thumb_offset_ms": thumb_offset_ms,
            "platform_settings": json.dumps(platform_settings) if isinstance(platform_settings, dict) else platform_settings,
        }

        job_id = self.db.create_job(job_data)
        job_data["id"] = job_id
        return job_data

    def transition_status(
        self,
        job_uid: str,
        new_status: str,
        error_message: Optional[str] = None,
        remote_post_id: Optional[str] = None,
        remote_url: Optional[str] = None,
        increment_attempt: bool = False,
    ) -> bool:
        """Enforces state transition rules and updates job in database."""
        job = self.db.get_job_by_uid(job_uid)
        if not job:
            raise QueueError(f"Job not found with uid: {job_uid}")

        current_status = job["status"]
        allowed = ALLOWED_TRANSITIONS.get(current_status, set())

        if new_status not in allowed:
            raise QueueError(
                f"Invalid state transition from {current_status} to {new_status} for job {job_uid}"
            )

        updated = self.db.update_job_status(
            job_uid=job_uid,
            status=new_status,
            error_message=error_message,
            remote_post_id=remote_post_id,
            remote_url=remote_url,
            increment_attempt=increment_attempt,
        )

        # If job is now successfully PUBLISHED, register into duplicate registry
        if new_status == "PUBLISHED" and updated:
            self.db.register_successful_upload(
                video_hash=job["video_hash"],
                platform=job["platform"],
                job_uid=job_uid,
            )

        return updated

    def cancel_job(self, job_uid: str) -> bool:
        """Cancels a scheduled or pending job before upload begins."""
        job = self.db.get_job_by_uid(job_uid)
        if not job:
            raise QueueError(f"Job not found: {job_uid}")

        if job["status"] in ("UPLOADING", "PROCESSING"):
            raise QueueError(
                f"Cannot cancel job {job_uid} while in active state '{job['status']}'."
            )

        return self.transition_status(job_uid, "CANCELLED")

    def retry_job(self, job_uid: str) -> bool:
        """Manually re-queues a failed or unknown-outcome job."""
        job = self.db.get_job_by_uid(job_uid)
        if not job:
            raise QueueError(f"Job not found: {job_uid}")

        if job["status"] not in ("FAILED", "UNKNOWN_OUTCOME"):
            raise QueueError(f"Only FAILED or UNKNOWN_OUTCOME jobs can be retried. Current: {job['status']}")

        return self.transition_status(job_uid, "READY", error_message="Reset for retry.")

    @staticmethod
    def is_recoverable_error(error_msg: str) -> bool:
        """Evaluates whether an error should trigger automatic retry."""
        lower_err = error_msg.lower()
        for kw in PERMANENT_ERROR_KEYWORDS:
            if kw in lower_err:
                return False
        return True
