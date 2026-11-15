"""1-Click Facebook Page & Reels Connect Wizard for ZCodeDev Social Publisher.

Automatically lists your Facebook Pages, fetches the long-lived Page Token,
verifies Reels publishing permissions, and saves securely in Windows Vault.
"""

import os
import sys
sys.path.insert(0, os.path.abspath("."))
import webbrowser
import requests
from src.logging_setup import setup_logger
from src.security import CredentialManager

logger = setup_logger("zcodedev_facebook_connect")

GRAPH_BASE_URL = "https://graph.facebook.com/v22.0"


def run_facebook_connect_wizard():
    print("\n" + "=" * 60)
    print("      ZCodeDev Social Publisher: Facebook Connect Wizard")
    print("=" * 60)

    print("\n[!] Facebook Token nikaalne ka sab se aasan tareeqa:")
    print("    1. Hum aapke browser mein Meta Graph API Explorer khol rahe hain.")
    print("    2. 'User or Page' dropdown se apna 'Facebook Page' chunein.")
    print("    3. Permissions mein 'pages_manage_posts' aur 'publish_video' tick karein.")
    print("    4. 'Generate Access Token' par click karein aur Token yahan paste karein.\n")

    open_meta = input("Kya Meta Graph API Explorer browser mein kholun? (Y/n): ").strip().lower()
    if open_meta != "n":
        webbrowser.open("https://developers.facebook.com/tools/explorer/")

    token = input("\nApna Access Token yahan paste karein: ").strip()
    if not token:
        print("[ERROR] Token empty tha. Process cancel ho gaya.")
        return False

    # Graph Explorer tokens expire in ~1-2 hours. Exchanging for a long-lived user token
    # makes the Page token derived from it non-expiring.
    print("\n[!] Graph Explorer ka token 1-2 ghante mein EXPIRE ho jata hai.")
    print("    Permanent Page Token ke liye apni Meta App ki App ID aur App Secret dein")
    print("    (developers.facebook.com > My Apps > App settings > Basic). Skip karne ke liye ENTER.")
    app_id = input("App ID: ").strip()
    app_secret = input("App Secret: ").strip() if app_id else ""
    if app_id and app_secret:
        try:
            ex = requests.get(
                f"{GRAPH_BASE_URL}/oauth/access_token",
                params={
                    "grant_type": "fb_exchange_token",
                    "client_id": app_id,
                    "client_secret": app_secret,
                    "fb_exchange_token": token,
                },
                timeout=15,
            ).json()
            if ex.get("access_token"):
                token = ex["access_token"]
                print("[OK] Long-lived token mil gaya. Page token ab expire nahi hoga.")
            else:
                print(f"[WARN] Token exchange fail: {ex.get('error', {}).get('message')}. Short-lived token use hoga.")
        except Exception as e:
            print(f"[WARN] Token exchange error: {e}. Short-lived token use hoga.")
    else:
        print("[WARN] Short-lived token save hoga - 1-2 ghante baad dobara connect karna parega.")

    print("\n[*] Facebook API se aapke Pages check ho rahe hain...")

    try:
        # Check /me/accounts
        res = requests.get(
            f"{GRAPH_BASE_URL}/me/accounts",
            params={"access_token": token, "fields": "id,name,access_token,category"},
            timeout=15,
        )
        data = res.json()

        pages = data.get("data", [])

        # If token was directly a Page token or /me/accounts returned empty, check /me
        selected_page_id = None
        selected_page_name = None
        page_token = None

        if pages:
            print(f"\n[OK] {len(pages)} Facebook Page(s) mil gaye:")
            for idx, p in enumerate(pages):
                print(f"  [{idx + 1}] {p.get('name')} (Page ID: {p.get('id')})")

            choice = 1
            if len(pages) > 1:
                choice_str = input(f"Kaunsa Page use karna hai? (1-{len(pages)}): ").strip()
                if choice_str.isdigit():
                    choice = int(choice_str)

            selected_page = pages[choice - 1]
            selected_page_id = selected_page["id"]
            selected_page_name = selected_page["name"]
            page_token = selected_page.get("access_token") or token

        else:
            # Check if this token belongs directly to a Page (not a personal profile).
            # Note: /me/accounts errors for Page tokens, so don't bail out on that error.
            res_page = requests.get(
                f"{GRAPH_BASE_URL}/me",
                params={"access_token": token, "fields": "id,name", "metadata": "1"},
                timeout=15,
            )
            d_page = res_page.json()
            obj_type = d_page.get("metadata", {}).get("type")
            if "id" in d_page and obj_type == "page":
                selected_page_id = d_page["id"]
                selected_page_name = d_page.get("name")
                page_token = token
            elif "id" in d_page:
                print("[ERROR] Yeh token aapki personal profile ka hai, kisi Page ka nahi - aur koi Page list nahi hua.")
                print("        Graph Explorer mein 'pages_show_list' + 'pages_manage_posts' permission add karke")
                print("        naya token generate karein, phir wizard dobara chalayein.")
                return False
            else:
                print(f"[ERROR] Token verify nahi ho saka: {d_page.get('error', {}).get('message', 'Invalid Token')}")
                return False

        # Save to Windows Vault
        creds_data = {
            "page_id": selected_page_id,
            "page_name": selected_page_name,
            "page_access_token": page_token,
            "access_token": page_token,
        }

        cred_mgr = CredentialManager()
        cred_mgr.save_credentials("facebook", creds_data)

        print("\n" + "=" * 60)
        print(f" SUCCESS: Facebook Page '{selected_page_name}' kamyabi se connect ho gaya!")
        print(f" Page ID: {selected_page_id}")
        print(" Token encrypted in Windows Credential Locker.")
        print("=" * 60 + "\n")
        return True

    except Exception as e:
        print(f"[ERROR] Facebook verification error: {e}")
        return False


if __name__ == "__main__":
    run_facebook_connect_wizard()
