"""1-Click YouTube OAuth Connect Wizard for ZCodeDev Social Publisher.

Opens your browser, handles OAuth consent, and securely stores tokens
directly inside the Windows Credential Locker (WinVaultKeyring).
"""

import json
import os
import sys
sys.path.insert(0, os.path.abspath("."))
import webbrowser
from google_auth_oauthlib.flow import InstalledAppFlow
from src.logging_setup import setup_logger
from src.platforms.youtube import YouTubeAdapter
from src.security import CredentialManager, SCOPES

logger = setup_logger("zcodedev_youtube_connect")

def find_client_secret_file():
    # 1. Check local directory
    for fname in os.listdir("."):
        if fname.startswith("client_secret") and fname.endswith(".json"):
            return os.path.abspath(fname)

    # 2. Check Downloads folder for recently downloaded client_secret JSONs
    downloads_dir = os.path.expanduser("~/Downloads")
    candidates = []
    if os.path.exists(downloads_dir):
        for fname in os.listdir(downloads_dir):
            if fname.startswith("client_secret") and fname.endswith(".json"):
                full_p = os.path.join(downloads_dir, fname)
                candidates.append((os.path.getmtime(full_p), full_p))
        candidates.sort(reverse=True)

    for mtime, full_p in candidates:
        try:
            with open(full_p, "r", encoding="utf-8") as f:
                data = json.load(f)
                if "installed" in data:
                    dest = os.path.abspath("client_secret.json")
                    import shutil
                    shutil.copy2(full_p, dest)
                    logger.info(f"Auto-imported Desktop OAuth client file from Downloads: {fname}")
                    return dest
        except Exception:
            pass

    return None


def run_youtube_oauth_flow():
    print("\n" + "=" * 60)
    print("      ZCodeDev Social Publisher: YouTube Connect Wizard")
    print("=" * 60)

    client_file = find_client_secret_file()

    if not client_file:
        print("\n[!] Google Cloud se 'Desktop App' OAuth client banana hai:")
        print("    1. Hum aapke browser mein Google Cloud Credentials page khol rahe hain.")
        print("    2. 'Application type' dropdown mein 'Desktop app' select karein.")
        print("    3. Name: 'ZCodeDev Publisher' likhein aur 'CREATE' button dabayein.")
        print("    4. Popup mein 'DOWNLOAD JSON' par click karein.\n")
        print("    (Script aapke Downloads folder se file khud utha legi!)")

        webbrowser.open("https://console.cloud.google.com/apis/credentials/oauthclient")
        input("\nJSON download karne ke baad yahan ENTER dabayein...")
        client_file = find_client_secret_file()

    if not client_file:
        print("\n[ERROR] 'client_secret.json' nahi mili. Process cancel ho gaya.")
        return False

    print(f"\n[OK] Client secrets file mil gayi: {client_file}")
    print("[*] Browser khul raha hai... Apne YouTube Google account se 'Allow' karein.")

    try:
        # Check if port 8080 is occupied and free it
        import socket
        import time
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        in_use = (sock.connect_ex(('127.0.0.1', 8080)) == 0)
        sock.close()
        if in_use:
            print("[*] Port 8080 par purana process tha, usko free kiya ja raha hai...")
            import subprocess
            subprocess.run("powershell -Command \"Get-NetTCPConnection -LocalPort 8080 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }\"", shell=True)
            time.sleep(1)

        os.environ["OAUTHLIB_INSECURE_TRANSPORT"] = "1"
        os.environ["OAUTHLIB_RELAX_TOKEN_SCOPE"] = "1"

        flow = InstalledAppFlow.from_client_secrets_file(
            client_file,
            scopes=SCOPES["youtube"],
        )

        print("\n" + "=" * 60)
        print(" [*] Browser khul raha hai... Login complete karein.")
        print(" (Agar warning screen aaye toh 'Continue' ya 'Advanced' dabayein)")
        print("=" * 60 + "\n")

        # Runs local web server on port 8080 to receive redirect token
        credentials = flow.run_local_server(
            port=8080,
            access_type="offline",
            prompt="consent",
            authorization_prompt_message="Google Login Link:\n{url}\n\nKripya browser mein login complete karein...",
            success_message="Mubarak ho! Authorization kamyab rahi. Aap yeh window band kar sakte hain.",
            open_browser=True,
        )

        # Build payload
        creds_data = {
            "token": credentials.token,
            "refresh_token": credentials.refresh_token,
            "token_uri": credentials.token_uri,
            "client_id": credentials.client_id,
            "client_secret": credentials.client_secret,
            "scopes": credentials.scopes,
        }

        # Save to Windows Credential Locker
        cred_mgr = CredentialManager()
        cred_mgr.save_credentials("youtube", creds_data)

        # Verify channel
        adapter = YouTubeAdapter()
        check = adapter.verify_account(creds_data)

        print("\n" + "=" * 60)
        if check.get("valid"):
            print(f" SUCCESS: YouTube Channel '{check.get('channel_title')}' connect ho gaya!")
            print(f" Channel ID: {check.get('channel_id')}")
            print(f" Subscribers: {check.get('subscriber_count')}")
        else:
            print(" Token Windows Vault mein save ho gaya hai, magar channel check mein yeh aaya:")
            print(f" {check.get('error')}")
        print("=" * 60 + "\n")
        return True

    except Exception as e:
        print(f"\n[ERROR] OAuth flow mein error aaya: {e}")
        return False


if __name__ == "__main__":
    run_youtube_oauth_flow()
