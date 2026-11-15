"""Duplicate video detection and SHA-256 hashing for ZCodeDev Social Publisher.

Prevents accidental duplicate uploads of the same video content to the same platform.
"""

import hashlib
import os
from typing import Optional, Tuple
from src.database import Database
from src.logging_setup import setup_logger

logger = setup_logger("zcodedev_duplicate_checker")

CHUNK_SIZE = 64 * 1024  # 64 KB streaming hash buffer


class DuplicateVideoError(Exception):
    """Raised when an identical video has already been published to the target platform."""
    pass


class DuplicateChecker:
    """Computes content hashes and prevents redundant uploads."""

    def __init__(self, db: Database):
        self.db = db

    @staticmethod
    def calculate_file_hash(file_path: str) -> str:
        """Calculates the SHA-256 hex digest of a video file using streamed chunks."""
        if not os.path.isfile(file_path):
            raise FileNotFoundError(f"File not found for hash calculation: {file_path}")

        hasher = hashlib.sha256()
        with open(file_path, "rb") as f:
            while chunk := f.read(CHUNK_SIZE):
                hasher.update(chunk)
        file_hash = hasher.hexdigest()
        logger.debug(f"Calculated SHA-256 for {file_path}: {file_hash[:12]}...")
        return file_hash

    def check_duplicate(
        self,
        file_path: str,
        platform: str,
        video_hash: Optional[str] = None,
        allow_repost: bool = False,
    ) -> Tuple[bool, str]:
        """Checks if a video was previously published to the specified platform.

        Returns: (is_duplicate: bool, calculated_hash: str)
        Raises: DuplicateVideoError if duplicate and allow_repost is False.
        """
        if not video_hash:
            video_hash = self.calculate_file_hash(file_path)

        platform_key = platform.lower().strip()
        is_dup = self.db.is_duplicate_upload(video_hash, platform_key)

        if is_dup and not allow_repost:
            msg = (
                f"Duplicate detected: Video with hash {video_hash[:10]}... "
                f"was already published to '{platform_key}'. Set allow_repost=True to override."
            )
            logger.warning(msg)
            raise DuplicateVideoError(msg)

        return is_dup, video_hash
