"""Background Scheduler Engine for ZCodeDev Social Publisher.

Provides Karachi-timezone-aware job polling, single-instance process locking on Windows,
reboot recovery, and fault-tolerant dispatching to platform adapters.
"""

from datetime import datetime, timezone, timedelta
import os
import signal
import sys
import threading
import time
from typing import Any, Dict, Optional

# Allow running directly as `python src\scheduler.py` (bat file / Windows Task Scheduler)
_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _PROJECT_ROOT not in sys.path:
    sys.path.insert(0, _PROJECT_ROOT)
try:
    from zoneinfo import ZoneInfo
    KARACHI_TZ = ZoneInfo("Asia/Karachi")
except Exception:
    KARACHI_TZ = timezone(timedelta(hours=5), name="PKT")
from src.database import Database
from src.logging_setup import setup_logger
from src.platforms.base import BasePlatformAdapter, PublishResult
from src.platforms.facebook import FacebookAdapter
from src.platforms.instagram import InstagramAdapter
from src.platforms.tiktok import TikTokAdapter
from src.platforms.youtube import YouTubeAdapter
from src.queue_manager import QueueManager
from src.security import CredentialManager, missing_credential_fields

logger = setup_logger("zcodedev_scheduler")

KARACHI_TZ = ZoneInfo("Asia/Karachi")
LOCK_FILE_PATH = os.path.join("data", "scheduler.lock")


class ProcessLockError(Exception):
    """Raised when another scheduler instance is already running."""
    pass


class SingleInstanceLock:
    """Ensures only one scheduler process executes on Windows at any time."""

    def __init__(self, lock_path: str = LOCK_FILE_PATH):
        self.lock_path = lock_path
        self._lock_file = None

    def acquire(self) -> bool:
        """Acquires lock file using atomic open or Windows lock."""
        os.makedirs(os.path.dirname(os.path.abspath(self.lock_path)), exist_ok=True)
        try:
            if os.path.exists(self.lock_path):
                # Check if previous process died unexpectedly
                try:
                    with open(self.lock_path, "r") as f:
                        old_pid = int(f.read().strip())
                    # Check if old_pid is still running on Windows
                    import ctypes
                    kernel32 = ctypes.windll.kernel32
                    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
                    h_process = kernel32.OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, False, old_pid)
                    if h_process != 0:
                        kernel32.CloseHandle(h_process)
                        raise ProcessLockError(
                            f"Another scheduler instance (PID {old_pid}) is already running."
                        )
                except (ValueError, OSError):
                    pass

            self._lock_file = open(self.lock_path, "w")
            self._lock_file.write(str(os.getpid()))
            self._lock_file.flush()
            logger.info(f"Acquired single-instance scheduler lock (PID {os.getpid()})")
            return True
        except ProcessLockError:
            raise
        except Exception as e:
            logger.error(f"Failed to acquire process lock: {e}")
            raise ProcessLockError(f"Cannot acquire scheduler lock: {e}")

    def release(self) -> None:
        """Releases the lock file on clean shutdown."""
        try:
            if self._lock_file:
                self._lock_file.close()
            if os.path.exists(self.lock_path):
                os.remove(self.lock_path)
            logger.info("Released single-instance scheduler lock.")
        except Exception as e:
            logger.warning(f"Error releasing process lock: {e}")


class PublisherScheduler:
    """Core scheduler orchestrator."""

    def __init__(
        self,
        db: Optional[Database] = None,
        poll_interval_sec: float = 10.0,
    ):
        self.db = db or Database()
        self.queue_mgr = QueueManager(self.db)
        self.cred_mgr = CredentialManager()
        self.poll_interval_sec = poll_interval_sec
        self.running = False
        self._lock = SingleInstanceLock()

        # Register platform adapters
        self.adapters: Dict[str, BasePlatformAdapter] = {
            "youtube": YouTubeAdapter(),
            "facebook": FacebookAdapter(),
            "instagram": InstagramAdapter(),
            "tiktok": TikTokAdapter(),
        }

    def _setup_signal_handlers(self) -> None:
        """Handles graceful termination on SIGINT/SIGTERM."""
        def handle_exit(signum, frame):
            logger.info(f"Received shutdown signal ({signum}). Terminating gracefully...")
            self.stop()

        signal.signal(signal.SIGINT, handle_exit)
        signal.signal(signal.SIGTERM, handle_exit)

    def recover_dangling_jobs(self) -> None:
        """Recovers any jobs stuck in UPLOADING or PROCESSING from an abrupt reboot/crash."""
        active_jobs = self.db.list_jobs(status="UPLOADING") + self.db.list_jobs(status="PROCESSING")
        if not active_jobs:
            return

        logger.info(f"Reboot recovery: found {len(active_jobs)} potentially interrupted jobs.")
        for job in active_jobs:
            job_uid = job["job_uid"]
            remote_id = job.get("remote_post_id")
            platform = job["platform"]

            if remote_id and platform in self.adapters:
                # Attempt reconciliation
                creds = self.cred_mgr.get_credentials(platform) or {}
                outcome = self.adapters[platform].reconcile_status(remote_id, creds)
                logger.info(f"Reconciled job {job_uid} ({platform}) outcome -> {outcome}")
                if outcome == "PUBLISHED":
                    self.queue_mgr.transition_status(job_uid, "PUBLISHED", remote_post_id=remote_id)
                    continue

            # If unconfirmed, transition to UNKNOWN_OUTCOME to protect against duplicate uploads
            self.queue_mgr.transition_status(
                job_uid,
                "UNKNOWN_OUTCOME",
                error_message="Interrupted by system restart or crash. Flagged for verification.",
            )

    def dispatch_job(self, job: Dict[str, Any]) -> None:
        """Executes a single due job through its target adapter."""
        job_uid = job["job_uid"]
        platform = job["platform"].lower()
        adapter = self.adapters.get(platform)

        if not adapter:
            err = f"Unsupported platform: '{platform}'"
            logger.error(err)
            self.queue_mgr.transition_status(job_uid, "FAILED", error_message=err)
            return

        creds = self.cred_mgr.get_credentials(platform)
        if not creds:
            err = f"No credentials configured for platform '{platform}'. Please authorize in settings."
            logger.warning(err)
            self.queue_mgr.transition_status(job_uid, "FAILED", error_message=err)
            return

        missing = missing_credential_fields(platform, creds)
        if missing:
            err = (
                f"{platform.capitalize()} credentials incomplete (missing: {', '.join(missing)}). "
                f"Run the {platform.capitalize()} Connect Wizard in Platform Accounts, then Retry."
            )
            logger.warning(err)
            self.queue_mgr.transition_status(job_uid, "FAILED", error_message=err)
            return

        # Advance status: PENDING -> UPLOADING
        try:
            self.queue_mgr.transition_status(job_uid, "UPLOADING", increment_attempt=True)
        except Exception as e:
            logger.error(f"Cannot transition job {job_uid} to UPLOADING: {e}")
            return

        # Execute upload
        logger.info(f"Dispatching job {job_uid} to {platform} adapter...")
        try:
            result: PublishResult = adapter.upload(job, creds)
            logger.info(f"Adapter result for {job_uid}: {result.status} (success={result.success})")

            if result.success and result.status == "PUBLISHED":
                self.queue_mgr.transition_status(
                    job_uid,
                    "PUBLISHED",
                    remote_post_id=result.remote_post_id,
                    remote_url=result.remote_url,
                )
            elif result.status == "PROCESSING":
                self.queue_mgr.transition_status(
                    job_uid,
                    "PROCESSING",
                    remote_post_id=result.remote_post_id,
                )
            elif result.status == "UNKNOWN_OUTCOME":
                self.queue_mgr.transition_status(
                    job_uid,
                    "UNKNOWN_OUTCOME",
                    remote_post_id=result.remote_post_id,
                    error_message=result.error_message,
                )
            else:
                # FAILED
                self.queue_mgr.transition_status(
                    job_uid,
                    "FAILED",
                    remote_post_id=result.remote_post_id,
                    error_message=result.error_message,
                )

        except Exception as e:
            logger.exception(f"Unhandled exception during job execution {job_uid}: {e}")
            self.queue_mgr.transition_status(
                job_uid,
                "FAILED",
                error_message=f"Unhandled dispatch exception: {e}",
            )

    def tick(self) -> int:
        """Checks for due jobs and dispatches them. Returns count of processed jobs."""
        current_utc = datetime.now(timezone.utc).isoformat()
        due_jobs = self.db.get_pending_due_jobs(current_utc)

        if due_jobs:
            logger.info(f"Tick found {len(due_jobs)} due jobs ready for publishing.")

        for job in due_jobs:
            if not self.running:
                break
            self.dispatch_job(job)

        return len(due_jobs)

    def run(self) -> None:
        """Main scheduler loop."""
        self._lock.acquire()
        self._setup_signal_handlers()
        self.running = True
        logger.info("PublisherScheduler started. Monitoring queue in Asia/Karachi timezone...")

        # Run recovery on startup
        self.recover_dangling_jobs()

        try:
            while self.running:
                try:
                    self.tick()
                except Exception as e:
                    logger.error(f"Error in scheduler tick: {e}")
                time.sleep(self.poll_interval_sec)
        finally:
            self._lock.release()
            logger.info("PublisherScheduler stopped cleanly.")

    def stop(self) -> None:
        """Signals scheduler loop to stop."""
        self.running = False


if __name__ == "__main__":
    os.chdir(_PROJECT_ROOT)  # data/ and logs/ paths are relative to project root
    scheduler = PublisherScheduler()
    scheduler.run()
