"""Base Platform Adapter for ZCodeDev Social Publisher.

Defines the contract and result structures for all social publishing adapters.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any, Dict, Optional
from src.logging_setup import setup_logger

logger = setup_logger("zcodedev_platform_base")


@dataclass
class PublishResult:
    """Standard outcome container returned by all platform adapters."""
    success: bool
    status: str  # 'PUBLISHED', 'PROCESSING', 'UNKNOWN_OUTCOME', 'FAILED'
    remote_post_id: Optional[str] = None
    remote_url: Optional[str] = None
    error_message: Optional[str] = None
    raw_response: Optional[Dict[str, Any]] = None


class BasePlatformAdapter(ABC):
    """Abstract base class for all platform adapters."""

    def __init__(self, platform_name: str):
        self.platform_name = platform_name.lower().strip()

    @abstractmethod
    def upload(self, job: Dict[str, Any], credentials: Dict[str, Any]) -> PublishResult:
        """Executes the video upload workflow for the platform.

        Args:
            job: Dictionary containing job details (video_path, title, caption, hashtags, privacy, etc.)
            credentials: Platform credentials retrieved securely from Windows Vault.

        Returns:
            PublishResult with status, remote ID, and error information.
        """
        pass

    @abstractmethod
    def verify_account(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Validates API credentials and queries profile/channel information.

        Returns:
            Dictionary with account metadata (id, name, permissions).
        """
        pass

    @abstractmethod
    def reconcile_status(self, remote_post_id: str, credentials: Dict[str, Any]) -> str:
        """Queries the platform API to determine the state of an uploaded video after a timeout or unknown outcome.

        Returns:
            One of 'PUBLISHED', 'PROCESSING', 'FAILED', or 'UNKNOWN_OUTCOME'.
        """
        pass
