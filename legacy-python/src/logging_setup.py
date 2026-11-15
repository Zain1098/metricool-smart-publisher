"""Logging setup with secret-masking filters for ZCodeDev Social Publisher."""

import logging
from logging.handlers import RotatingFileHandler
import os
import re

# Regex patterns to detect and mask sensitive information
SENSITIVE_PATTERNS = [
    re.compile(r'(access_token["\']?\s*[:=]\s*["\'])([^"\']{4})([^"\']+)(["\'])', re.IGNORECASE),
    re.compile(r'(refresh_token["\']?\s*[:=]\s*["\'])([^"\']{4})([^"\']+)(["\'])', re.IGNORECASE),
    re.compile(r'(client_secret["\']?\s*[:=]\s*["\'])([^"\']{4})([^"\']+)(["\'])', re.IGNORECASE),
    re.compile(r'(authorization["\']?\s*[:=]\s*["\'](?:Bearer|OAuth)\s+)([^"\']{4})([^"\']+)(["\'])', re.IGNORECASE),
    re.compile(r'(password["\']?\s*[:=]\s*["\'])([^"\']{2})([^"\']+)(["\'])', re.IGNORECASE),
]


class SecretMaskingFilter(logging.Filter):
    """Filters log records to mask tokens, passwords, and sensitive keys."""

    def filter(self, record: logging.LogRecord) -> bool:
        if isinstance(record.msg, str):
            record.msg = self.mask_secrets(record.msg)
        if record.args:
            if isinstance(record.args, dict):
                record.args = {k: self._mask_val(v) for k, v in record.args.items()}
            elif isinstance(record.args, tuple):
                record.args = tuple(self._mask_val(v) for v in record.args)
        return True

    @classmethod
    def mask_secrets(cls, text: str) -> str:
        masked = text
        for pattern in SENSITIVE_PATTERNS:
            def repl(m):
                return f"{m.group(1)}{m.group(2)}****MASKED****{m.group(4)}"
            masked = pattern.sub(repl, masked)
        return masked

    @classmethod
    def _mask_val(cls, val):
        if isinstance(val, str):
            return cls.mask_secrets(val)
        return val


def setup_logger(
    name: str = "zcodedev_publisher",
    log_dir: str = "logs",
    log_level: int = logging.INFO,
    max_bytes: int = 5 * 1024 * 1024,  # 5 MB
    backup_count: int = 5,
) -> logging.Logger:
    """Configures and returns a centralized logger with file rotation and secret filtering."""
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, "publisher.log")

    logger = logging.getLogger(name)
    logger.setLevel(log_level)

    if not logger.handlers:
        mask_filter = SecretMaskingFilter()

        formatter = logging.Formatter(
            fmt="%(asctime)s [%(levelname)s] [%(name)s:%(lineno)d]: %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

        # Rotating file handler
        file_handler = RotatingFileHandler(
            log_file,
            maxBytes=max_bytes,
            backupCount=backup_count,
            encoding="utf-8",
        )
        file_handler.setLevel(log_level)
        file_handler.setFormatter(formatter)
        file_handler.addFilter(mask_filter)

        # Console handler
        console_handler = logging.StreamHandler()
        console_handler.setLevel(log_level)
        console_handler.setFormatter(formatter)
        console_handler.addFilter(mask_filter)

        logger.addHandler(file_handler)
        logger.addHandler(console_handler)

    return logger
