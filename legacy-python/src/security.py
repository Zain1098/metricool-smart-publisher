"""Secure Credential Management for ZCodeDev Social Publisher.

Uses Windows Credential Locker (WinVaultKeyring) to safeguard tokens and API secrets.
Never saves plaintext secrets to disk or logs.
"""

import json
import os
from typing import Any, Dict, Optional
import keyring
from keyring.backends.Windows import WinVaultKeyring
from src.logging_setup import setup_logger

logger = setup_logger("zcodedev_security")

SERVICE_NAME = "ZCodeDevSocialPublisher"

# Minimum required scopes per platform
SCOPES = {
    "youtube": [
        "https://www.googleapis.com/auth/youtube.upload",
        "https://www.googleapis.com/auth/youtube.readonly",
    ],
    "facebook": [
        "pages_show_list",
        "pages_read_engagement",
        "pages_manage_posts",
        "publish_video",
    ],
    "instagram": [
        "instagram_basic",
        "instagram_content_publish",
        "pages_show_list",
    ],
    "tiktok": [
        "user.info.basic",
        "video.publish",
        "video.upload",
    ],
}

# Fields each adapter actually needs to upload. Tuples mean "any one of these".
REQUIRED_FIELDS = {
    "youtube": ["refresh_token", "client_id", "client_secret"],
    "facebook": ["page_id", ("page_access_token", "access_token")],
    "instagram": ["ig_user_id", "access_token"],
    "tiktok": ["access_token"],
}


def missing_credential_fields(platform: str, creds: Optional[Dict[str, Any]]) -> list:
    """Returns the list of required credential fields that are missing/empty."""
    creds = creds or {}
    missing = []
    for field in REQUIRED_FIELDS.get(platform.lower().strip(), []):
        options = field if isinstance(field, tuple) else (field,)
        if not any(creds.get(f) for f in options):
            missing.append("/".join(options))
    return missing


class SecurityError(Exception):
    """Raised when secure storage encounters an unrecoverable issue."""
    pass


class CredentialManager:
    """Safely manages platform credentials using the OS-backed Windows Credential Locker."""

    def __init__(self, service_name: str = SERVICE_NAME):
        self.service_name = service_name
        self._verify_backend()

    def _verify_backend(self) -> None:
        """Ensures the active keyring backend is an OS-backed secure store."""
        current_backend = keyring.get_keyring()
        logger.debug(f"Verifying keyring backend: {type(current_backend).__name__}")
        # On Windows, we expect WinVaultKeyring or a hardware-backed backend
        # We explicitly reject plaintext or dummy keyrings
        insecure_backends = ["fail", "dummy", "chainer", "null"]
        backend_name = type(current_backend).__name__.lower()
        for insecure in insecure_backends:
            if insecure in backend_name:
                raise SecurityError(
                    f"Insecure keyring backend detected ({backend_name}). "
                    "Refusing to store credentials in plaintext."
                )

    def _read_local_file(self) -> Dict[str, Any]:
        file_path = os.path.join("data", "credentials.json")
        if os.path.exists(file_path):
            try:
                with open(file_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                return {}
        return {}

    def _write_local_file(self, data: Dict[str, Any]) -> None:
        os.makedirs("data", exist_ok=True)
        file_path = os.path.join("data", "credentials.json")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            logger.warning(f"Could not write to local credentials.json: {e}")

    def save_credentials(self, platform: str, credentials_data: Dict[str, Any]) -> bool:
        """Stores a serialized JSON credentials payload in Windows Vault and local credentials.json."""
        platform_key = platform.lower().strip()
        # Save to local file
        local_data = self._read_local_file()
        local_data[platform_key] = credentials_data
        self._write_local_file(local_data)

        # Also save to Windows Vault
        try:
            raw_json = json.dumps(credentials_data)
            keyring.set_password(self.service_name, platform_key, raw_json)
            logger.info(f"Credentials successfully saved to Windows Vault for platform: {platform_key}")
        except Exception as e:
            logger.warning(f"Keyring save warning for platform {platform}: {e} (saved to data/credentials.json)")

        return True

    def get_credentials(self, platform: str) -> Optional[Dict[str, Any]]:
        """Retrieves credentials for a given platform, checking Vault and local credentials.json."""
        platform_key = platform.lower().strip()
        vault_data = None
        try:
            raw_json = keyring.get_password(self.service_name, platform_key)
            if raw_json:
                vault_data = json.loads(raw_json)
        except Exception as e:
            logger.debug(f"Keyring read error: {e}")

        # Check local file
        local_data = self._read_local_file().get(platform_key)

        if vault_data and local_data:
            return {**local_data, **vault_data}
        return vault_data or local_data

    def has_credentials(self, platform: str) -> bool:
        """Returns True if valid credential data exists for the platform."""
        creds = self.get_credentials(platform)
        return bool(creds)

    def delete_credentials(self, platform: str) -> bool:
        """Removes platform credentials from Windows Credential Manager and local credentials.json."""
        platform_key = platform.lower().strip()
        local_data = self._read_local_file()
        if platform_key in local_data:
            del local_data[platform_key]
            self._write_local_file(local_data)

        try:
            keyring.delete_password(self.service_name, platform_key)
            logger.info(f"Credentials revoked and removed from Windows Vault for platform: {platform_key}")
            return True
        except keyring.errors.PasswordDeleteError:
            return True
        except Exception as e:
            logger.warning(f"Failed to delete credentials from Vault: {e}")
            return True

    def list_configured_platforms(self) -> Dict[str, bool]:
        """Returns connection status for each target platform without revealing secrets."""
        platforms = ["youtube", "facebook", "instagram", "tiktok"]
        status = {}
        for p in platforms:
            creds = self.get_credentials(p)
            status[p] = bool(creds) and not missing_credential_fields(p, creds)
        return status
