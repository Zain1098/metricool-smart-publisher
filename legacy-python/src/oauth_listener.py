"""Dedicated Google OAuth listener on port 8080 for ZCodeDev Social Publisher."""

import json
import os
import sys
sys.path.insert(0, os.path.abspath("."))
from google_auth_oauthlib.flow import InstalledAppFlow
from src.database import Database
from src.logging_setup import setup_logger
from src.platforms.youtube import YouTubeAdapter
from src.security import CredentialManager, SCOPES

logger = setup_logger("zcodedev_oauth_listener")


def start_listener():
    cm = CredentialManager()
    creds = cm.get_credentials("youtube")

    if not creds or not creds.get("client_id") or not creds.get("client_secret"):
        # Fallback to client_secret.json
        if os.path.exists("client_secret.json"):
            with open("client_secret.json", "r", encoding="utf-8") as f:
                raw = json.load(f).get("installed", {})
                creds = {
                    "client_id": raw.get("client_id"),
                    "client_secret": raw.get("client_secret"),
                }

    if not creds or not creds.get("client_id") or not creds.get("client_secret"):
        print("[ERROR] Missing client_id or client_secret.")
        return

    os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
    os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

    client_config = {
        "installed": {
            "client_id": creds["client_id"],
            "client_secret": creds["client_secret"],
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8080/"],
        }
    }

    flow = InstalledAppFlow.from_client_config(
        client_config,
        scopes=SCOPES["youtube"],
    )

    print("[*] Starting local server on http://localhost:8080/ ...")
    sys.stdout.flush()

    try:
        # Let run_local_server generate the URL ONCE so state & PKCE code_verifier match!
        auth_creds = flow.run_local_server(
            host="localhost",
            port=8080,
            prompt="consent",
            access_type="offline",
            authorization_prompt_message="\n============================================================\nGOOGLE AUTHENTICATION LINK:\n{url}\n============================================================\n",
            success_message="Mubarak ho! YouTube Channel successfully connect ho gaya hai! Ab aap yeh tab band kar sakte hain.",
            open_browser=True,
        )

        updated_creds = {
            "token": auth_creds.token,
            "refresh_token": auth_creds.refresh_token,
            "token_uri": auth_creds.token_uri,
            "client_id": auth_creds.client_id,
            "client_secret": auth_creds.client_secret,
            "scopes": list(auth_creds.scopes) if auth_creds.scopes else SCOPES["youtube"],
        }

        cm.save_credentials("youtube", updated_creds)
        print("\n[SUCCESS] Refresh token and access token saved in Windows Vault!")
        sys.stdout.flush()

        # Check channel
        adapter = YouTubeAdapter()
        check = adapter.verify_account(updated_creds)
        if check.get("valid"):
            print(f"[OK] Connected YouTube Channel: {check.get('channel_title')} (ID: {check.get('channel_id')})")
            # Sync with Next.js data/store.json
            store_path = os.path.abspath(os.path.join("..", "data", "store.json"))
            if os.path.exists(store_path):
                try:
                    with open(store_path, "r", encoding="utf-8") as sf:
                        store_data = json.load(sf)
                    for acc in store_data.get("accounts", []):
                        if acc.get("platform") == "youtube":
                            acc["isConnected"] = True
                            acc["accountName"] = check.get("channel_title") or acc["accountName"]
                            acc["handle"] = check.get("custom_url") or acc["handle"]
                            acc["followersCount"] = int(check.get("subscriber_count") or acc.get("followersCount") or 0)
                            acc["authMode"] = "api_key"
                            acc["hasCustomCredentials"] = True
                            acc["credentials"] = {
                                "accountId": check.get("channel_id"),
                                "accessToken": "VAULT_MANAGED_YOUTUBE_OAUTH",
                            }
                    with open(store_path, "w", encoding="utf-8") as sf:
                        json.dump(store_data, sf, indent=2)
                    print("[OK] Synced YouTube Channel into Next.js data/store.json!")
                except Exception as se:
                    print(f"[WARN] Could not sync store.json: {se}")

        # Reset failed YouTube jobs to READY
        db = Database()
        jobs = db.list_jobs(platform="youtube", limit=10)
        for j in jobs:
            if j["status"] in ("FAILED", "UNKNOWN_OUTCOME"):
                db.update_job_status(j["job_uid"], "READY", error_message="Authorized. Ready for upload.")
                print(f"[+] Re-queued Job #{j['id']} for upload.")

        sys.stdout.flush()

    except Exception as e:
        print(f"[ERROR] Failed in local server: {e}")
        sys.stdout.flush()


if __name__ == "__main__":
    start_listener()
