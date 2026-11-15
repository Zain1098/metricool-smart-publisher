"""Tests for security and logging secret masking."""

import logging
from src.logging_setup import SecretMaskingFilter, setup_logger
from src.security import CredentialManager


def test_secret_masking_filter():
    f = SecretMaskingFilter()
    raw = 'Got response: access_token="ya29.a0AfH6SMTestToken12345" with client_secret="superSecretKey9876"'
    masked = f.mask_secrets(raw)
    assert "ya29.a0AfH6SMTestToken12345" not in masked
    assert "superSecretKey9876" not in masked
    assert "****MASKED****" in masked


def test_credential_manager_roundtrip():
    # Uses isolated test service name to avoid overwriting production keys
    mgr = CredentialManager(service_name="ZCodeDevTestService")
    test_creds = {"access_token": "token123", "refresh_token": "refresh456"}

    # Save
    mgr.save_credentials("test_platform", test_creds)

    # Retrieve
    retrieved = mgr.get_credentials("test_platform")
    assert retrieved == test_creds

    # Delete
    deleted = mgr.delete_credentials("test_platform")
    assert deleted is True

    # Verify deleted
    assert mgr.get_credentials("test_platform") is None
