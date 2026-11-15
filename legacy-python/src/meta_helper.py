"""Meta (Facebook & Instagram) API Automation Helper for ZCodeDev Social Publisher.

Provides automatic token exchange (for non-expiring Page tokens),
Facebook Page discovery, and automatic Instagram Professional account linking.
"""

from typing import Any, Dict, List, Optional
import requests
from src.logging_setup import setup_logger
from src.security import CredentialManager

logger = setup_logger("zcodedev_meta_helper")

GRAPH_API_VERSION = "v22.0"
GRAPH_BASE_URL = f"https://graph.facebook.com/{GRAPH_API_VERSION}"


def exchange_long_lived_token(short_lived_token: str, app_id: str, app_secret: str) -> Optional[str]:
    """Exchanges a short-lived user token for a 60-day long-lived user token."""
    try:
        url = f"{GRAPH_BASE_URL}/oauth/access_token"
        params = {
            "grant_type": "fb_exchange_token",
            "client_id": app_id.strip(),
            "client_secret": app_secret.strip(),
            "fb_exchange_token": short_lived_token.strip(),
        }
        res = requests.get(url, params=params, timeout=15)
        data = res.json()
        if "access_token" in data:
            logger.info("Successfully exchanged short-lived token for long-lived user token.")
            return data["access_token"]
        else:
            err = data.get("error", {}).get("message", "Token exchange failed")
            logger.warning(f"Long-lived token exchange warning: {err}")
            return None
    except Exception as e:
        logger.error(f"Error during long-lived token exchange: {e}")
        return None


def discover_facebook_and_instagram(user_or_page_token: str) -> Dict[str, Any]:
    """Queries Meta Graph API to discover all Facebook Pages and linked Instagram accounts.

    Args:
        user_or_page_token: Token from Meta Graph API Explorer or Facebook Login.

    Returns:
        Dict with 'pages' list and overall status.
    """
    token = user_or_page_token.strip()
    pages_result: List[Dict[str, Any]] = []

    # First attempt: Query /me/accounts (works when token is a User token)
    try:
        url = f"{GRAPH_BASE_URL}/me/accounts"
        params = {
            "fields": "id,name,access_token,category,instagram_business_account{id,username,name,profile_picture_url}",
            "access_token": token,
            "limit": 100,
        }
        res = requests.get(url, params=params, timeout=15)
        data = res.json()

        # If error 100 (nonexisting field instagram_business_account), fallback to basic page fields
        if "error" in data and data["error"].get("code") == 100:
            logger.info("Instagram field not accessible, falling back to basic Facebook Page fields.")
            params["fields"] = "id,name,access_token,category"
            res = requests.get(url, params=params, timeout=15)
            data = res.json()

        if "data" in data and len(data["data"]) > 0:
            for p in data["data"]:
                page_id = p.get("id")
                page_name = p.get("name")
                page_token = p.get("access_token") or token
                ig_data = p.get("instagram_business_account")

                page_info: Dict[str, Any] = {
                    "page_id": page_id,
                    "page_name": page_name,
                    "page_access_token": page_token,
                    "instagram": None,
                }

                if ig_data and "id" in ig_data:
                    page_info["instagram"] = {
                        "ig_user_id": ig_data.get("id"),
                        "username": ig_data.get("username"),
                        "name": ig_data.get("name"),
                        "profile_picture_url": ig_data.get("profile_picture_url"),
                    }
                pages_result.append(page_info)

            return {
                "success": True,
                "token_type": "USER_TOKEN",
                "pages": pages_result,
            }
    except Exception as e:
        logger.debug(f"/me/accounts lookup failed (might be a page token directly): {e}")

    # Second attempt: Check previously linked page_id in vault (e.g. Meta Business Portfolio pages)
    try:
        cm = CredentialManager()
        old_fb = cm.get_credentials("facebook") or {}
        old_ig = cm.get_credentials("instagram") or {}
        candidate_page_id = old_ig.get("linked_page_id") or old_fb.get("page_id") or "442234252298250"
        if candidate_page_id and str(candidate_page_id) != "2361737161260731":
            p_url = f"{GRAPH_BASE_URL}/{candidate_page_id}"
            p_res = requests.get(
                p_url,
                params={
                    "fields": "id,name,access_token,instagram_business_account{id,username,name,profile_picture_url}",
                    "access_token": token,
                },
                timeout=15,
            ).json()
            if "id" in p_res and "error" not in p_res:
                ig_data = p_res.get("instagram_business_account")
                page_info = {
                    "page_id": p_res["id"],
                    "page_name": p_res.get("name", "Facebook Page"),
                    "page_access_token": p_res.get("access_token") or token,
                    "instagram": {
                        "ig_user_id": ig_data.get("id"),
                        "username": ig_data.get("username"),
                        "name": ig_data.get("name"),
                        "profile_picture_url": ig_data.get("profile_picture_url"),
                    } if ig_data and "id" in ig_data else None,
                }
                return {
                    "success": True,
                    "token_type": "DIRECT_PAGE_LOOKUP",
                    "pages": [page_info],
                }
    except Exception as e:
        logger.debug(f"Direct candidate page lookup failed: {e}")

    # Third attempt: Maybe the token is already a direct Page token! Check /me
    try:
        url = f"{GRAPH_BASE_URL}/me"
        params = {
            "fields": "id,name,instagram_business_account{id,username,name,profile_picture_url}",
            "access_token": token,
        }
        res = requests.get(url, params=params, timeout=15)
        data = res.json()

        if "error" in data and data["error"].get("code") == 100:
            params["fields"] = "id,name"
            res = requests.get(url, params=params, timeout=15)
            data = res.json()

        if "id" in data and "error" not in data:
            page_id = data["id"]
            page_name = data.get("name", "Facebook Page")
            ig_data = data.get("instagram_business_account")

            page_info = {
                "page_id": page_id,
                "page_name": page_name,
                "page_access_token": token,
                "instagram": None,
            }

            if ig_data and "id" in ig_data:
                page_info["instagram"] = {
                    "ig_user_id": ig_data.get("id"),
                    "username": ig_data.get("username"),
                    "name": ig_data.get("name"),
                    "profile_picture_url": ig_data.get("profile_picture_url"),
                }

            return {
                "success": True,
                "token_type": "PAGE_TOKEN",
                "pages": [page_info],
            }
        elif "error" in data:
            return {
                "success": False,
                "error": data["error"].get("message", "Invalid Meta token"),
                "pages": [],
            }
    except Exception as e:
        return {
            "success": False,
            "error": f"Error validating Meta token: {e}",
            "pages": [],
        }

    return {
        "success": False,
        "error": "No Facebook Pages found for this token. Make sure 'pages_show_list' and 'pages_manage_posts' permissions are selected.",
        "pages": [],
    }


def auto_connect_meta(
    token: str,
    app_id: Optional[str] = None,
    app_secret: Optional[str] = None,
    preferred_page_id: Optional[str] = None,
) -> Dict[str, Any]:
    """Automates Meta connection: exchanges token, discovers pages, and stores credentials.

    Stores Facebook credentials and, if linked, Instagram credentials inside Windows Credential Locker.
    """
    active_token = token.strip()

    # Step 1: Exchange for long-lived user token if App ID + Secret provided
    if app_id and app_secret and app_id.strip() and app_secret.strip():
        long_lived = exchange_long_lived_token(active_token, app_id, app_secret)
        if long_lived:
            active_token = long_lived

    # Step 2: Discover Pages and Instagram
    discovery = discover_facebook_and_instagram(active_token)
    if not discovery.get("success") or not discovery.get("pages"):
        return {
            "success": False,
            "error": discovery.get("error", "No Facebook Pages found."),
        }

    pages = discovery["pages"]
    selected_page = None

    if preferred_page_id:
        for p in pages:
            if str(p["page_id"]) == str(preferred_page_id):
                selected_page = p
                break

    if not selected_page:
        selected_page = pages[0]

    # Step 3: Save Facebook credentials
    cred_mgr = CredentialManager()
    fb_creds = {
        "page_id": selected_page["page_id"],
        "page_name": selected_page["page_name"],
        "page_access_token": selected_page["page_access_token"],
        "access_token": selected_page["page_access_token"],
    }
    cred_mgr.save_credentials("facebook", fb_creds)
    logger.info(f"Saved Facebook credentials for page: {selected_page['page_name']} ({selected_page['page_id']})")

    # Step 4: If linked Instagram account exists, auto-save Instagram credentials
    ig_info = selected_page.get("instagram")
    ig_saved = False
    if ig_info and ig_info.get("ig_user_id"):
        ig_creds = {
            "ig_user_id": ig_info["ig_user_id"],
            "username": ig_info.get("username"),
            "name": ig_info.get("name"),
            "access_token": selected_page["page_access_token"],
            "linked_page_id": selected_page["page_id"],
        }
        cred_mgr.save_credentials("instagram", ig_creds)
        ig_saved = True
        logger.info(f"Auto-saved linked Instagram credentials for user: {ig_info.get('username')} ({ig_info['ig_user_id']})")

    return {
        "success": True,
        "facebook_connected": True,
        "page_id": selected_page["page_id"],
        "page_name": selected_page["page_name"],
        "instagram_connected": ig_saved,
        "instagram_username": ig_info.get("username") if ig_info else None,
        "instagram_user_id": ig_info.get("ig_user_id") if ig_info else None,
        "available_pages": [
            {"page_id": p["page_id"], "page_name": p["page_name"], "has_instagram": bool(p.get("instagram"))}
            for p in pages
        ],
    }
