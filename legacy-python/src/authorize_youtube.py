"""Automatic YouTube OAuth Authorizer using existing Vault Client ID and Secret.

Opens Google consent screen in browser to obtain real refresh_token and access_token.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import webbrowser
from google_auth_oauthlib.flow import InstalledAppFlow
from src.database import Database
from src.logging_setup import setup_logger
from src.platforms.youtube import YouTubeAdapter
from src.security import CredentialManager, SCOPES

logger = setup_logger("zcodedev_youtube_auth")


def authorize():
    print("\n" + "=" * 60)
    print("      YouTube 1-Click Browser Authorization")
    print("=" * 60)

    cred_mgr = CredentialManager()
    creds = cred_mgr.get_credentials("youtube")

    if not creds or not creds.get("client_id") or not creds.get("client_secret"):
        print("[ERROR] Vault mein client_id ya client_secret nahi mila.")
        return False

    client_id = creds["client_id"]
    client_secret = creds["client_secret"]

    print("[*] Aapke Client ID aur Secret verify ho gaye hain.")
    print("[*] Browser khul raha hai... Apna Google Account select karke 'Allow' karein.")

    client_config = {
        "installed": {
            "client_id": client_id,
            "client_secret": client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": ["http://localhost:8080/"],
        }
    }

    try:
        flow = InstalledAppFlow.from_client_config(client_config, scopes=SCOPES["youtube"])
        auth_creds = flow.run_local_server(
            port=8080,
            prompt="consent",
            authorization_prompt_message="Kripya browser mein login complete karein...",
            success_message="Mubarak ho! YouTube authorization mukammal ho gayi. Aap yeh window band kar sakte hain.",
            open_browser=True,
        )

        # Save actual tokens
        updated_creds = {
            "token": auth_creds.token,
            "refresh_token": auth_creds.refresh_token,
            "token_uri": auth_creds.token_uri,
            "client_id": auth_creds.client_id,
            "client_secret": auth_creds.client_secret,
            "scopes": auth_creds.scopes,
        }

        cred_mgr.save_credentials("youtube", updated_creds)
        print("\n[OK] Asal Refresh Token aur Access Token Windows Vault mein save ho gaye!")

        # Verify Channel
        adapter = YouTubeAdapter()
        check = adapter.verify_account(updated_creds)
        if check.get("valid"):
            print(f" SUCCESS: YouTube Channel '{check.get('channel_title')}' connect ho gaya!")
            print(f" Channel ID: {check.get('channel_id')}")
        else:
            print(f"[!] Channel info: {check.get('error')}")

        # Re-queue any failed YouTube jobs to READY
        db = Database()
        jobs = db.list_jobs(platform="youtube", limit=10)
        for j in jobs:
            if j["status"] in ("FAILED", "UNKNOWN_OUTCOME"):
                db.update_job_status(j["job_uid"], "READY", error_message="Ready for upload after authorization.")
                print(f"[+] Re-queued Job #{j['id']} for automatic upload!")

        print("=" * 60 + "\n")
        return True

    except Exception as e:
        print(f"\n[ERROR] Authorization mein error aaya: {e}")
        return False


if __name__ == "__main__":
    authorize()
