"""Video format and metadata validation for ZCodeDev Social Publisher.

Provides zero-dependency pure Python MP4 atom/box parsing (duration, width, height, aspect ratio)
and enforces platform-specific guidelines for YouTube Shorts, Instagram Reels, Facebook Reels, and TikTok.
"""

import os
import struct
from typing import Any, Dict, List, Optional, Tuple
from src.logging_setup import setup_logger

logger = setup_logger("zcodedev_validator")

# Supported file extensions
SUPPORTED_EXTENSIONS = {".mp4", ".mov", ".webm"}

# Platform constraints
PLATFORM_RULES = {
    "youtube": {
        "name": "YouTube Shorts",
        "max_size_bytes": 1024 * 1024 * 1024,  # 1 GB
        "min_duration_sec": 3.0,
        "max_duration_sec": 180.0,  # YouTube Shorts supports up to 3 mins
        "allowed_aspect_ratios": ["9:16", "1:1"],
    },
    "instagram": {
        "name": "Instagram Reels",
        "max_size_bytes": 1024 * 1024 * 1024,  # 1 GB
        "min_duration_sec": 3.0,
        "max_duration_sec": 90.0,
        "allowed_aspect_ratios": ["9:16"],
    },
    "facebook": {
        "name": "Facebook Reels",
        "max_size_bytes": 1024 * 1024 * 1024,  # 1 GB
        "min_duration_sec": 3.0,
        "max_duration_sec": 90.0,
        "allowed_aspect_ratios": ["9:16"],
    },
    "tiktok": {
        "name": "TikTok",
        "max_size_bytes": 4 * 1024 * 1024 * 1024,  # 4 GB
        "min_duration_sec": 3.0,
        "max_duration_sec": 600.0,  # Up to 10 mins
        "allowed_aspect_ratios": ["9:16", "1:1"],
    },
}


class VideoValidationError(Exception):
    """Raised when a video fails critical format or constraint checks."""
    pass


class VideoMetadata:
    """Holds parsed video file properties."""

    def __init__(
        self,
        file_path: str,
        size_bytes: int,
        duration_sec: Optional[float] = None,
        width: Optional[int] = None,
        height: Optional[int] = None,
    ):
        self.file_path = file_path
        self.size_bytes = size_bytes
        self.duration_sec = duration_sec
        self.width = width
        self.height = height

    @property
    def aspect_ratio_str(self) -> str:
        """Returns simplified aspect ratio string (e.g. '9:16', '16:9', '1:1')."""
        if not self.width or not self.height:
            return "unknown"
        ratio = self.width / self.height
        if 0.52 <= ratio <= 0.60:
            return "9:16"
        elif 0.95 <= ratio <= 1.05:
            return "1:1"
        elif 1.70 <= ratio <= 1.82:
            return "16:9"
        elif 0.75 <= ratio <= 0.85:
            return "4:5"
        return f"{self.width}:{self.height}"

    @property
    def is_vertical(self) -> bool:
        """Determines if the video is vertical (height > width)."""
        if self.width and self.height:
            return self.height >= self.width
        return False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "file_path": self.file_path,
            "size_bytes": self.size_bytes,
            "size_mb": round(self.size_bytes / (1024 * 1024), 2),
            "duration_sec": round(self.duration_sec, 2) if self.duration_sec else None,
            "width": self.width,
            "height": self.height,
            "aspect_ratio": self.aspect_ratio_str,
            "is_vertical": self.is_vertical,
        }


def parse_mp4_boxes(file_path: str) -> Tuple[Optional[float], Optional[int], Optional[int]]:
    """Zero-dependency MP4 atom reader to extract duration, width, and height.

    Traverses MP4 ISO base media format (ftyp -> moov -> mvhd & trak -> mdia -> minf -> stbl / tkhd).
    """
    duration = None
    width = None
    height = None

    try:
        with open(file_path, "rb") as f:
            file_size = os.fstat(f.fileno()).st_size

            def read_atom(stream) -> Tuple[Optional[str], int, int]:
                header = stream.read(8)
                if len(header) < 8:
                    return None, 0, 0
                atom_size, atom_type = struct.unpack(">I4s", header)
                try:
                    type_str = atom_type.decode("latin-1")
                except Exception:
                    type_str = "????"

                header_size = 8
                if atom_size == 1:  # 64-bit extended size
                    large_size_bytes = stream.read(8)
                    if len(large_size_bytes) < 8:
                        return None, 0, 0
                    atom_size = struct.unpack(">Q", large_size_bytes)[0]
                    header_size = 16
                elif atom_size == 0:  # Extends to EOF
                    atom_size = file_size - stream.tell() + header_size

                return type_str, atom_size, header_size

            while f.tell() < file_size:
                atype, asize, hsize = read_atom(f)
                if not atype or asize < hsize:
                    break

                if atype == "moov":
                    moov_end = f.tell() + asize - hsize
                    while f.tell() < moov_end:
                        sub_type, sub_size, sub_hsize = read_atom(f)
                        if not sub_type or sub_size < sub_hsize:
                            break

                        if sub_type == "mvhd":
                            # Parse movie header atom for timescale and duration
                            payload = f.read(min(sub_size - sub_hsize, 100))
                            if len(payload) >= 20:
                                version = payload[0]
                                if version == 0:
                                    timescale, dur = struct.unpack(">II", payload[12:20])
                                elif version == 1 and len(payload) >= 28:
                                    timescale, dur = struct.unpack(">IQ", payload[20:32])
                                else:
                                    timescale, dur = 0, 0
                                if timescale > 0:
                                    duration = dur / timescale
                        elif sub_type == "trak":
                            # Inside track atom, look for tkhd (track header) to get dimensions
                            trak_end = f.tell() + sub_size - sub_hsize
                            while f.tell() < trak_end:
                                trk_type, trk_size, trk_hsize = read_atom(f)
                                if not trk_type or trk_size < trk_hsize:
                                    break
                                if trk_type == "tkhd":
                                    tkhd_data = f.read(trk_size - trk_hsize)
                                    if len(tkhd_data) >= 80:
                                        version = tkhd_data[0]
                                        # Width and height are 16.16 fixed point numbers at the end of tkhd
                                        w_raw, h_raw = struct.unpack(">II", tkhd_data[-8:])
                                        t_w = w_raw >> 16
                                        t_h = h_raw >> 16
                                        if t_w > 0 and t_h > 0 and (width is None or t_w > width):
                                            width = t_w
                                            height = t_h
                                else:
                                    f.seek(trk_size - trk_hsize, os.SEEK_CUR)
                        else:
                            f.seek(sub_size - sub_hsize, os.SEEK_CUR)
                    break
                else:
                    f.seek(asize - hsize, os.SEEK_CUR)

    except Exception as e:
        logger.warning(f"Native MP4 parser encountered a non-fatal parsing exception on {file_path}: {e}")

    return duration, width, height


def inspect_video(file_path: str) -> VideoMetadata:
    """Validates physical file existence and extracts metadata."""
    if not os.path.exists(file_path):
        raise VideoValidationError(f"Video file does not exist: {file_path}")

    if not os.path.isfile(file_path):
        raise VideoValidationError(f"Path is not a regular file: {file_path}")

    size_bytes = os.path.getsize(file_path)
    if size_bytes == 0:
        raise VideoValidationError(f"Video file is empty (0 bytes): {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise VideoValidationError(
            f"Unsupported video extension '{ext}'. Allowed formats: {', '.join(SUPPORTED_EXTENSIONS)}"
        )

    duration, width, height = parse_mp4_boxes(file_path)
    return VideoMetadata(
        file_path=file_path,
        size_bytes=size_bytes,
        duration_sec=duration,
        width=width,
        height=height,
    )


def validate_for_platform(metadata: VideoMetadata, platform: str) -> List[str]:
    """Validates the video metadata against a specific platform's rules.

    Returns a list of warning/error messages. Empty list indicates full compliance.
    """
    platform_key = platform.lower().strip()
    rules = PLATFORM_RULES.get(platform_key)
    if not rules:
        return [f"Unknown platform: '{platform}'"]

    issues = []

    # File size check
    if metadata.size_bytes > rules["max_size_bytes"]:
        max_mb = rules["max_size_bytes"] / (1024 * 1024)
        curr_mb = metadata.size_bytes / (1024 * 1024)
        issues.append(f"File size ({curr_mb:.1f}MB) exceeds {rules['name']} limit ({max_mb:.0f}MB).")

    # Duration check
    if metadata.duration_sec is not None:
        if metadata.duration_sec < rules["min_duration_sec"]:
            issues.append(
                f"Duration ({metadata.duration_sec:.1f}s) is shorter than minimum required ({rules['min_duration_sec']}s)."
            )
        if metadata.duration_sec > rules["max_duration_sec"]:
            issues.append(
                f"Duration ({metadata.duration_sec:.1f}s) exceeds {rules['name']} maximum allowed ({rules['max_duration_sec']}s)."
            )

    # Orientation / Aspect ratio check
    if metadata.width and metadata.height:
        if not metadata.is_vertical:
            issues.append(
                f"Video is landscape/horizontal ({metadata.width}x{metadata.height}). "
                f"{rules['name']} requires vertical 9:16 orientation for Reels/Shorts."
            )

    return issues
