"""YouTube Shorts & Video Adapter for ZCodeDev Social Publisher.

Uses official Google YouTube Data API v3 with resumable chunked uploads,
native server-side scheduled publishing (status.publishAt), custom thumbnails,
and full Metricool-equivalent YouTube settings.
"""

import json
import os
from typing import Any, Dict, List
from google.oauth2.credentials import Credentials
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError
from googleapiclient.http import MediaFileUpload
from src.logging_setup import setup_logger
from src.platforms.base import BasePlatformAdapter, PublishResult

logger = setup_logger("zcodedev_youtube")


class YouTubeAdapter(BasePlatformAdapter):
    """Handles uploads, native server-side scheduling, and status verification for YouTube."""

    def __init__(self):
        super().__init__("youtube")

    def _get_service(self, credentials_data: Dict[str, Any]):
        """Builds an authorized YouTube service client."""
        creds = Credentials(
            token=credentials_data.get("token") or credentials_data.get("access_token"),
            refresh_token=credentials_data.get("refresh_token"),
            token_uri=credentials_data.get("token_uri", "https://oauth2.googleapis.com/token"),
            client_id=credentials_data.get("client_id"),
            client_secret=credentials_data.get("client_secret"),
            scopes=credentials_data.get("scopes"),
        )
        return build("youtube", "v3", credentials=creds, cache_discovery=False)

    def verify_account(self, credentials: Dict[str, Any]) -> Dict[str, Any]:
        """Queries authenticated channel info to verify identity, avatar, and live statistics."""
        try:
            service = self._get_service(credentials)
            request = service.channels().list(part="snippet,statistics", mine=True)
            response = request.execute()

            items = response.get("items", [])
            if not items:
                return {"valid": False, "error": "No YouTube channel found for these credentials."}

            channel = items[0]
            snippet = channel.get("snippet", {})
            stats = channel.get("statistics", {})
            thumbs = snippet.get("thumbnails", {})
            avatar_url = (
                thumbs.get("medium", {}).get("url")
                or thumbs.get("default", {}).get("url")
                or ""
            )
            return {
                "valid": True,
                "channel_id": channel.get("id"),
                "channel_title": snippet.get("title"),
                "custom_url": snippet.get("customUrl"),
                "avatar_url": avatar_url,
                "subscriber_count": int(stats.get("subscriberCount", 0)),
                "video_count": int(stats.get("videoCount", 0)),
                "view_count": int(stats.get("viewCount", 0)),
            }
        except Exception as e:
            logger.error(f"YouTube account verification failed: {e}")
            return {"valid": False, "error": str(e)}

    def upload(self, job: Dict[str, Any], credentials: Dict[str, Any]) -> PublishResult:
        """Executes resumable chunked upload to YouTube with full platform settings & optional publishAt."""
        video_path = job["video_path"]
        if not os.path.exists(video_path):
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=f"Video file not found: {video_path}",
            )

        title = job.get("title") or "Short Video"
        caption = job.get("caption") or ""
        hashtags = job.get("hashtags") or ""
        privacy = (job.get("privacy") or "public").lower()
        publish_at = job.get("publish_at")  # ISO 8601 UTC string for native server-side scheduling

        description = caption
        if hashtags:
            description = f"{caption}\n\n{hashtags}".strip()

        raw_settings = job.get("platform_settings")
        yt_settings: Dict[str, Any] = {}
        if isinstance(raw_settings, str):
            try:
                yt_settings = json.loads(raw_settings)
            except Exception:
                yt_settings = {}
        elif isinstance(raw_settings, dict):
            yt_settings = raw_settings

        yt_conf = (
            yt_settings.get("youtube", yt_settings)
            if isinstance(yt_settings.get("youtube"), dict)
            else yt_settings
        )

        made_for_kids = bool(yt_conf.get("made_for_kids", False))
        category_id = str(yt_conf.get("category_id") or "28")
        license_type = str(yt_conf.get("license") or "youtube")
        embeddable = bool(yt_conf.get("embeddable", True))
        notify_subscribers = bool(yt_conf.get("notify_subscribers", True))
        is_short = bool(yt_conf.get("is_short", True))
        contains_synthetic_media = bool(
            yt_conf.get("contains_synthetic_media")
            or yt_conf.get("is_ai_generated", False)
        )
        public_stats_viewable = bool(yt_conf.get("public_stats_viewable", True))
        paid_promotion = bool(yt_conf.get("paid_promotion", False))
        default_language = str(yt_conf.get("default_language") or "en").strip()
        playlist_id = str(yt_conf.get("playlist_id") or "").strip()

        # Collect tags from hashtags + explicit tags list
        tags_list: List[str] = [t.strip("#").strip() for t in hashtags.split() if t.strip()]
        explicit_tags = yt_conf.get("tags") or job.get("tags")
        if isinstance(explicit_tags, list):
            for t in explicit_tags:
                clean_t = str(t).strip().lstrip("#")
                if clean_t and clean_t not in tags_list:
                    tags_list.append(clean_t)
        elif isinstance(explicit_tags, str):
            for t in explicit_tags.split(","):
                clean_t = t.strip().lstrip("#")
                if clean_t and clean_t not in tags_list:
                    tags_list.append(clean_t)

        # Ensure #Shorts tag in title/description if marked as Short and not present
        final_title = title[:100]
        if is_short and "#shorts" not in final_title.lower() and "#shorts" not in description.lower():
            description = f"{description}\n\n#Shorts".strip()

        if paid_promotion and "includes paid promotion" not in description.lower():
            sponsor = str(yt_conf.get("sponsor_handle") or "").strip()
            promo_line = f"Includes Paid Promotion / Sponsored by {sponsor}" if sponsor else "Includes Paid Promotion"
            description = f"{description}\n\n{promo_line}".strip()

        status_dict: Dict[str, Any] = {
            "privacyStatus": privacy if privacy in ("private", "unlisted", "public") else "public",
            "selfDeclaredMadeForKids": made_for_kids,
            "embeddable": embeddable,
            "license": license_type,
            "publicStatsViewable": public_stats_viewable,
            "containsSyntheticMedia": contains_synthetic_media,
        }

        # Native YouTube Server-Side Scheduling (works when user's laptop is turned OFF!)
        if publish_at:
            status_dict["privacyStatus"] = "private"
            status_dict["publishAt"] = publish_at

        snippet_dict: Dict[str, Any] = {
            "title": final_title,
            "description": description[:5000],
            "tags": tags_list[:35],
            "categoryId": category_id,
        }
        if default_language:
            snippet_dict["defaultLanguage"] = default_language
            snippet_dict["defaultAudioLanguage"] = default_language

        body = {
            "snippet": snippet_dict,
            "status": status_dict,
        }

        try:
            service = self._get_service(credentials)
            media = MediaFileUpload(
                video_path,
                mimetype="video/mp4",
                chunksize=1024 * 1024 * 2,
                resumable=True,
            )

            insert_request = service.videos().insert(
                part="snippet,status",
                body=body,
                media_body=media,
                notifySubscribers=notify_subscribers,
            )

            logger.info(f"Initiating resumable YouTube upload for job {job.get('job_uid')}")
            response = None
            while response is None:
                status, response = insert_request.next_chunk()
                if status:
                    progress_pct = int(status.progress() * 100)
                    logger.debug(f"YouTube upload progress: {progress_pct}%")

            video_id = response.get("id")
            video_url = (
                f"https://www.youtube.com/shorts/{video_id}"
                if is_short
                else f"https://www.youtube.com/watch?v={video_id}"
            )
            logger.info(f"YouTube upload successful: {video_url}")

            # Optional custom thumbnail upload
            thumbnail_path = job.get("thumbnail_path")
            if thumbnail_path and os.path.exists(thumbnail_path):
                try:
                    logger.info(f"Applying custom thumbnail for YouTube video {video_id}: {thumbnail_path}")
                    mime = "image/png" if thumbnail_path.lower().endswith(".png") else "image/jpeg"
                    service.thumbnails().set(
                        videoId=video_id,
                        media_body=MediaFileUpload(thumbnail_path, mimetype=mime),
                    ).execute()
                    logger.info("Custom YouTube thumbnail successfully set!")
                except Exception as th_err:
                    logger.warning(f"Failed to set custom YouTube thumbnail: {th_err}")

            # Optional Playlist addition
            if playlist_id and video_id:
                try:
                    service.playlistItems().insert(
                        part="snippet",
                        body={
                            "snippet": {
                                "playlistId": playlist_id,
                                "resourceId": {
                                    "kind": "youtube#video",
                                    "videoId": video_id,
                                },
                            }
                        },
                    ).execute()
                    logger.info(f"Added YouTube video {video_id} to playlist {playlist_id}")
                except Exception as pl_err:
                    logger.warning(f"Could not add YouTube video to playlist {playlist_id}: {pl_err}")

            # Optional first comment (if immediately public)
            first_comment = yt_conf.get("first_comment") or job.get("first_comment")
            if first_comment and str(first_comment).strip() and status_dict["privacyStatus"] == "public":
                try:
                    service.commentThreads().insert(
                        part="snippet",
                        body={
                            "snippet": {
                                "videoId": video_id,
                                "topLevelComment": {
                                    "snippet": {"textOriginal": str(first_comment).strip()[:1000]}
                                },
                            }
                        },
                    ).execute()
                except Exception as cm_err:
                    logger.warning(f"Could not post YouTube first comment: {cm_err}")

            return PublishResult(
                success=True,
                status="SCHEDULED_ON_PLATFORM" if publish_at else "PUBLISHED",
                remote_post_id=video_id,
                remote_url=video_url,
                raw_response=response,
            )

        except HttpError as he:
            error_reason = str(he)
            logger.error(f"YouTube HTTP API error: {he}")
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=error_reason,
            )
        except (TimeoutError, ConnectionError) as net_err:
            logger.warning(f"Network timeout during YouTube upload: {net_err}")
            return PublishResult(
                success=False,
                status="UNKNOWN_OUTCOME",
                error_message=f"Network connection lost during upload: {net_err}",
            )
        except Exception as e:
            logger.error(f"Unexpected error in YouTube upload: {e}")
            return PublishResult(
                success=False,
                status="FAILED",
                error_message=str(e),
            )

    def reconcile_status(self, remote_post_id: str, credentials: Dict[str, Any]) -> str:
        """Checks if a video actually published on YouTube."""
        try:
            service = self._get_service(credentials)
            request = service.videos().list(part="status,snippet", id=remote_post_id)
            response = request.execute()
            items = response.get("items", [])
            if items:
                status_obj = items[0].get("status", {})
                upload_status = status_obj.get("uploadStatus", "").lower()
                if upload_status == "processed":
                    return "PUBLISHED"
                elif upload_status == "uploaded":
                    return "PROCESSING"
                elif upload_status in ("failed", "rejected"):
                    return "FAILED"
            return "FAILED"
        except Exception as e:
            logger.error(f"Failed to reconcile YouTube video status for {remote_post_id}: {e}")
            return "UNKNOWN_OUTCOME"

    def fetch_channel_analytics(self, credentials: Dict[str, Any], max_results: int = 100) -> Dict[str, Any]:
        """Fetches real channel statistics, all recent/top videos, and per-video engagement from YouTube Data API v3."""
        try:
            service = self._get_service(credentials)
            ch_res = service.channels().list(part="snippet,statistics,contentDetails", mine=True).execute()
            items = ch_res.get("items", [])
            if not items:
                return {"success": False, "error": "No YouTube channel found."}

            ch = items[0]
            stats = ch.get("statistics", {})
            uploads_id = ch.get("contentDetails", {}).get("relatedPlaylists", {}).get("uploads")
            videos_out: List[Dict[str, Any]] = []

            if uploads_id:
                vid_ids: List[str] = []
                next_page_token = None
                while len(vid_ids) < max_results:
                    pl_res = (
                        service.playlistItems()
                        .list(
                            part="contentDetails",
                            playlistId=uploads_id,
                            maxResults=min(50, max_results - len(vid_ids)),
                            pageToken=next_page_token,
                        )
                        .execute()
                    )
                    for item in pl_res.get("items", []):
                        vid_id = item.get("contentDetails", {}).get("videoId")
                        if vid_id:
                            vid_ids.append(vid_id)
                    next_page_token = pl_res.get("nextPageToken")
                    if not next_page_token:
                        break

                for i in range(0, len(vid_ids), 50):
                    batch_ids = vid_ids[i : i + 50]
                    vids_res = (
                        service.videos()
                        .list(part="snippet,statistics,contentDetails,status", id=",".join(batch_ids))
                        .execute()
                    )
                    for v in vids_res.get("items", []):
                        vid = v.get("id", "")
                        snip = v.get("snippet", {})
                        vstats = v.get("statistics", {})
                        thumbs = snip.get("thumbnails", {})
                        thumb_url = (
                            thumbs.get("medium", {}).get("url")
                            or thumbs.get("high", {}).get("url")
                            or thumbs.get("default", {}).get("url")
                            or ""
                        )
                        videos_out.append(
                            {
                                "id": vid,
                                "platform": "youtube",
                                "title": snip.get("title", "Untitled Video"),
                                "publishedAt": snip.get("publishedAt", ""),
                                "thumbnailUrl": thumb_url,
                                "views": int(vstats.get("viewCount", 0)),
                                "likes": int(vstats.get("likeCount", 0)),
                                "comments": int(vstats.get("commentCount", 0)),
                                "duration": v.get("contentDetails", {}).get("duration", ""),
                                "privacyStatus": v.get("status", {}).get("privacyStatus", "public"),
                                "url": f"https://www.youtube.com/watch?v={vid}",
                            }
                        )

            return {
                "success": True,
                "channel": {
                    "id": ch.get("id"),
                    "title": ch.get("snippet", {}).get("title", "ZCodeDev"),
                    "handle": ch.get("snippet", {}).get("customUrl", "@zcodedev"),
                    "subscribers": int(stats.get("subscriberCount", 0)),
                    "totalViews": int(stats.get("viewCount", 0)),
                    "totalVideos": int(stats.get("videoCount", 0)),
                },
                "videos": videos_out,
            }
        except Exception as e:
            logger.error(f"Failed to fetch YouTube analytics: {e}")
            return {"success": False, "error": str(e), "videos": []}

