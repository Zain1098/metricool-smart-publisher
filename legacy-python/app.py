"""ZCodeDev Social Publisher - Local Dashboard & Management API.

Built with FastAPI and modern Vanilla UI. Provides video scheduling,
real-time status tracking, credential management, and logs inspection.
"""

from datetime import datetime, timedelta, timezone
import os
import shutil
from typing import Any, Dict, List, Optional
import uuid
from zoneinfo import ZoneInfo
from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from src.database import Database
from src.logging_setup import setup_logger
from src.meta_helper import auto_connect_meta, discover_facebook_and_instagram
from src.queue_manager import QueueError, QueueManager
from src.security import CredentialManager
from src.video_validator import inspect_video, validate_for_platform

logger = setup_logger("zcodedev_api")

KARACHI_TZ = ZoneInfo("Asia/Karachi")
UPLOAD_DIR = os.path.join("data", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

app = FastAPI(title="ZCodeDev Social Publisher", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize core services
db = Database()
queue_mgr = QueueManager(db)
cred_mgr = CredentialManager()

from src.scheduler import PublisherScheduler, ProcessLockError
scheduler_instance = PublisherScheduler(db=db, poll_interval_sec=8.0)
embedded_scheduler_active = False

@app.on_event("startup")
async def start_scheduler():
    import asyncio
    global embedded_scheduler_active

    # Only one scheduler may dispatch jobs, otherwise the same video gets uploaded twice.
    try:
        scheduler_instance._lock.acquire()
    except ProcessLockError as e:
        logger.info(f"Embedded scheduler not started: {e} (standalone scheduler will publish jobs).")
        return

    embedded_scheduler_active = True
    scheduler_instance.running = True
    try:
        await asyncio.to_thread(scheduler_instance.recover_dangling_jobs)
    except Exception as e:
        logger.error(f"Startup recovery error: {e}")

    async def worker():
        logger.info("Embedded background scheduler started.")
        while scheduler_instance.running:
            try:
                # Run in a thread: uploads are blocking and would freeze the dashboard
                await asyncio.to_thread(scheduler_instance.tick)
            except Exception as e:
                logger.error(f"Embedded scheduler error: {e}")
            await asyncio.sleep(scheduler_instance.poll_interval_sec)
    asyncio.create_task(worker())

@app.on_event("shutdown")
async def stop_scheduler():
    scheduler_instance.running = False
    if embedded_scheduler_active:
        scheduler_instance._lock.release()

# Mount static folder
os.makedirs("static", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")


# ---------------- API Models ----------------

class JobCreateRequest(BaseModel):
    video_path: str
    platforms: List[str]  # ['youtube', 'instagram', 'facebook', 'tiktok']
    scheduled_time: str   # Format: 'YYYY-MM-DD HH:MM:SS'
    title: Optional[str] = ""
    caption: Optional[str] = ""
    hashtags: Optional[str] = ""
    privacy: Optional[str] = "private"
    allow_repost: Optional[bool] = False
    custom_captions: Optional[Dict[str, str]] = None  # Platform-specific caption override
    thumbnail_path: Optional[str] = None
    thumb_offset_ms: Optional[int] = None
    platform_settings: Optional[Dict[str, Any]] = None


class BatchScheduleRequest(BaseModel):
    video_paths: List[str]
    platforms: List[str]
    start_time: str  # Format: 'YYYY-MM-DD HH:MM:SS'
    stagger_interval_hours: Optional[float] = 24.0
    title_template: Optional[str] = ""
    caption: Optional[str] = ""
    hashtags: Optional[str] = ""
    privacy: Optional[str] = "private"
    allow_repost: Optional[bool] = False
    thumbnail_path: Optional[str] = None
    thumb_offset_ms: Optional[int] = None


class CaptureThumbnailRequest(BaseModel):
    data_url: str
    offset_ms: Optional[int] = 0


class MetaSmartConnectRequest(BaseModel):
    token: str
    app_id: Optional[str] = None
    app_secret: Optional[str] = None
    page_id: Optional[str] = None


class CredentialsPayload(BaseModel):
    credentials: Dict[str, Any]


# ---------------- Frontend Route ----------------

@app.get("/", response_class=HTMLResponse)
def index_page():
    index_file = os.path.join("static", "index.html")
    if os.path.exists(index_file):
        with open(index_file, "r", encoding="utf-8") as f:
            return HTMLResponse(content=f.read())
    return HTMLResponse("<h1>ZCodeDev Social Publisher API Running</h1>")


# ---------------- System & Metrics ----------------

@app.get("/api/system/status")
def get_system_status():
    now_karachi = datetime.now(KARACHI_TZ)
    all_jobs = db.list_jobs(limit=1000)

    counts = {
        "total": len(all_jobs),
        "pending": sum(1 for j in all_jobs if j["status"] in ("PENDING", "READY")),
        "uploading": sum(1 for j in all_jobs if j["status"] in ("UPLOADING", "PROCESSING")),
        "published": sum(1 for j in all_jobs if j["status"] == "PUBLISHED"),
        "failed": sum(1 for j in all_jobs if j["status"] in ("FAILED", "UNKNOWN_OUTCOME")),
    }

    lock_file = os.path.join("data", "scheduler.lock")
    scheduler_active = os.path.exists(lock_file)

    return {
        "local_time_karachi": now_karachi.strftime("%Y-%m-%d %H:%M:%S (%Z)"),
        "scheduler_running": scheduler_active,
        "queue_counts": counts,
    }


# ---------------- Video Upload & Inspection ----------------

@app.post("/api/upload-video")
async def upload_video(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".mp4", ".mov", ".webm"):
        raise HTTPException(status_code=400, detail="Only .mp4, .mov, and .webm formats are supported.")

    unique_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
    dest_path = os.path.join(UPLOAD_DIR, unique_filename)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        meta = inspect_video(dest_path)
        meta_dict = meta.to_dict()

        # Check compliance for all 4 platforms
        platform_checks = {}
        for p in ("youtube", "instagram", "facebook", "tiktok"):
            platform_checks[p] = validate_for_platform(meta, p)

        meta_dict["platform_warnings"] = platform_checks
        meta_dict["download_url"] = f"/api/video-file/{unique_filename}"
        return meta_dict
    except Exception as e:
        if os.path.exists(dest_path):
            os.remove(dest_path)
        raise HTTPException(status_code=400, detail=f"Video validation error: {e}")


@app.post("/api/upload-batch-videos")
async def upload_batch_videos(files: List[UploadFile] = File(...)):
    results = []
    errors = []

    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in (".mp4", ".mov", ".webm"):
            errors.append(f"{file.filename}: Unsupported format (must be .mp4, .mov, or .webm)")
            continue

        unique_filename = f"{uuid.uuid4().hex[:8]}_{file.filename}"
        dest_path = os.path.join(UPLOAD_DIR, unique_filename)

        with open(dest_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)

        try:
            meta = inspect_video(dest_path)
            meta_dict = meta.to_dict()

            platform_checks = {}
            for p in ("youtube", "instagram", "facebook", "tiktok"):
                platform_checks[p] = validate_for_platform(meta, p)

            meta_dict["platform_warnings"] = platform_checks
            meta_dict["download_url"] = f"/api/video-file/{unique_filename}"
            meta_dict["original_filename"] = file.filename
            results.append(meta_dict)
        except Exception as e:
            if os.path.exists(dest_path):
                os.remove(dest_path)
            errors.append(f"{file.filename}: {e}")

    if not results and errors:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return {"videos": results, "errors": errors}


@app.get("/api/video-file/{filename}")
def serve_video(filename: str):
    file_path = os.path.join(UPLOAD_DIR, filename)
    if os.path.exists(file_path):
        ext = os.path.splitext(filename)[1].lower()
        media_type = "video/mp4"
        if ext in (".jpg", ".jpeg"):
            media_type = "image/jpeg"
        elif ext == ".png":
            media_type = "image/png"
        elif ext == ".webp":
            media_type = "image/webp"
        return FileResponse(file_path, media_type=media_type)
    raise HTTPException(status_code=404, detail="File not found")


@app.post("/api/capture-thumbnail")
def capture_thumbnail(req: CaptureThumbnailRequest):
    """Saves a base64 canvas snapshot taken from the video frame as a JPEG thumbnail."""
    try:
        import base64
        data_str = req.data_url
        if "," in data_str:
            _, encoded = data_str.split(",", 1)
        else:
            encoded = data_str

        img_bytes = base64.b64decode(encoded)
        thumb_name = f"thumb_{uuid.uuid4().hex[:8]}.jpg"
        dest_path = os.path.join(UPLOAD_DIR, thumb_name)
        with open(dest_path, "wb") as f:
            f.write(img_bytes)

        return {
            "success": True,
            "thumbnail_path": os.path.abspath(dest_path),
            "thumbnail_url": f"/api/video-file/{thumb_name}",
            "thumb_offset_ms": req.offset_ms or 0,
        }
    except Exception as e:
        logger.error(f"Error capturing thumbnail: {e}")
        raise HTTPException(status_code=400, detail=f"Failed to capture thumbnail: {e}")


@app.post("/api/upload-thumbnail")
async def upload_thumbnail(file: UploadFile = File(...)):
    """Uploads a custom image file (JPG, PNG, WEBP) to use as video cover/thumbnail."""
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in (".jpg", ".jpeg", ".png", ".webp"):
        raise HTTPException(status_code=400, detail="Only .jpg, .png, and .webp images are supported.")

    thumb_name = f"custom_thumb_{uuid.uuid4().hex[:8]}{ext}"
    dest_path = os.path.join(UPLOAD_DIR, thumb_name)

    with open(dest_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    return {
        "success": True,
        "thumbnail_path": os.path.abspath(dest_path),
        "thumbnail_url": f"/api/video-file/{thumb_name}",
        "thumb_offset_ms": 0,
    }


# ---------------- Jobs Management ----------------

@app.get("/api/jobs")
def list_jobs(status: Optional[str] = None, platform: Optional[str] = None):
    return db.list_jobs(status=status, platform=platform, limit=100)


@app.post("/api/jobs")
def create_jobs(req: JobCreateRequest):
    if not os.path.exists(req.video_path):
        raise HTTPException(status_code=400, detail="Video file does not exist.")

    if not req.platforms:
        raise HTTPException(status_code=400, detail="Select at least one target platform.")

    created_jobs = []
    errors = []

    for platform in req.platforms:
        try:
            # Check platform-specific caption override
            caption = req.caption
            if req.custom_captions and platform in req.custom_captions:
                caption = req.custom_captions[platform]

            job = queue_mgr.enqueue_video(
                video_path=req.video_path,
                platform=platform,
                scheduled_local_str=req.scheduled_time,
                title=req.title,
                caption=caption,
                hashtags=req.hashtags,
                privacy=req.privacy or "private",
                allow_repost=req.allow_repost or False,
                validate_specs=True,
                thumbnail_path=req.thumbnail_path,
                thumb_offset_ms=req.thumb_offset_ms,
                platform_settings=req.platform_settings,
            )
            created_jobs.append(job)
        except Exception as e:
            errors.append(f"{platform.upper()}: {e}")

    if errors and not created_jobs:
        raise HTTPException(status_code=400, detail="; ".join(errors))

    return {"success": True, "created": created_jobs, "warnings": errors}


@app.post("/api/jobs/publish-now")
async def publish_now(req: JobCreateRequest):
    """Enqueues and immediately publishes to selected platforms without waiting."""
    import asyncio
    now_karachi = datetime.now(KARACHI_TZ).strftime("%Y-%m-%d %H:%M:%S")
    req.scheduled_time = now_karachi

    result = create_jobs(req)
    created_jobs = result.get("created", [])

    async def run_immediate(jobs):
        for j in jobs:
            try:
                fresh_job = db.get_job_by_uid(j["job_uid"])
                if fresh_job:
                    await asyncio.to_thread(scheduler_instance.dispatch_job, fresh_job)
            except Exception as e:
                logger.error(f"Immediate dispatch error for {j.get('job_uid')}: {e}")

    asyncio.create_task(run_immediate(created_jobs))
    return {
        "success": True,
        "message": f"Dispatched {len(created_jobs)} video job(s) for immediate publishing!",
        "created": created_jobs,
        "warnings": result.get("warnings", []),
    }


@app.post("/api/jobs/{job_uid}/publish-now")
async def publish_existing_job_now(job_uid: str):
    """Immediately triggers upload for an existing pending, ready, or failed job."""
    import asyncio
    job = db.get_job_by_uid(job_uid)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    if job["status"] in ("FAILED", "UNKNOWN_OUTCOME"):
        queue_mgr.retry_job(job_uid)
    elif job["status"] not in ("PENDING", "READY"):
        raise HTTPException(status_code=400, detail=f"Cannot publish job with status {job['status']}")

    async def run_single():
        fresh_job = db.get_job_by_uid(job_uid)
        if fresh_job:
            await asyncio.to_thread(scheduler_instance.dispatch_job, fresh_job)

    asyncio.create_task(run_single())
    return {"success": True, "message": f"Job {job_uid} is uploading immediately."}


@app.post("/api/jobs/batch-schedule")
def batch_schedule_jobs(req: BatchScheduleRequest):
    """Schedules multiple videos with staggered timing intervals (e.g., 1 per day or every N hours)."""
    if not req.video_paths:
        raise HTTPException(status_code=400, detail="No video paths provided in batch.")
    if not req.platforms:
        raise HTTPException(status_code=400, detail="Select at least one target platform.")

    try:
        start_dt = datetime.strptime(req.start_time, "%Y-%m-%d %H:%M:%S").replace(tzinfo=KARACHI_TZ)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid start_time format. Expected 'YYYY-MM-DD HH:MM:SS'.")

    stagger_hrs = req.stagger_interval_hours if req.stagger_interval_hours is not None else 24.0
    all_created = []
    all_errors = []

    for idx, v_path in enumerate(req.video_paths):
        if not os.path.exists(v_path):
            all_errors.append(f"File not found: {v_path}")
            continue

        video_time = start_dt + timedelta(hours=idx * stagger_hrs)
        scheduled_str = video_time.strftime("%Y-%m-%d %H:%M:%S")

        # Determine title
        base_name = os.path.basename(v_path)
        clean_title = os.path.splitext(base_name)[0].replace("_", " ").title()
        if req.title_template:
            title = req.title_template.replace("{n}", str(idx + 1)).replace("{filename}", clean_title)
        else:
            title = clean_title

        for platform in req.platforms:
            try:
                job = queue_mgr.enqueue_video(
                    video_path=v_path,
                    platform=platform,
                    scheduled_local_str=scheduled_str,
                    title=title,
                    caption=req.caption or "",
                    hashtags=req.hashtags or "",
                    privacy=req.privacy or "private",
                    allow_repost=req.allow_repost or False,
                    validate_specs=True,
                    thumbnail_path=req.thumbnail_path,
                    thumb_offset_ms=req.thumb_offset_ms,
                )
                all_created.append(job)
            except Exception as e:
                all_errors.append(f"{base_name} ({platform.upper()}): {e}")

    if not all_created and all_errors:
        raise HTTPException(status_code=400, detail="; ".join(all_errors))

    return {
        "success": True,
        "total_scheduled": len(all_created),
        "created": all_created,
        "warnings": all_errors,
    }


@app.post("/api/jobs/{job_uid}/cancel")
def cancel_job(job_uid: str):
    try:
        success = queue_mgr.cancel_job(job_uid)
        return {"success": success, "job_uid": job_uid}
    except QueueError as qe:
        raise HTTPException(status_code=400, detail=str(qe))


@app.post("/api/jobs/{job_uid}/retry")
def retry_job(job_uid: str):
    try:
        success = queue_mgr.retry_job(job_uid)
        return {"success": success, "job_uid": job_uid}
    except QueueError as qe:
        raise HTTPException(status_code=400, detail=str(qe))


# ---------------- Credentials Management & Wizards ----------------

@app.post("/api/wizard/youtube")
def launch_youtube_wizard():
    import subprocess
    cmd = 'start "YouTube Connect Wizard" cmd /c ".venv\\Scripts\\python.exe src\\connect_youtube.py & pause"'
    subprocess.Popen(cmd, shell=True, cwd=os.getcwd())
    return {"status": "launched", "message": "YouTube Connect Wizard opened in a new window."}


@app.post("/api/wizard/facebook")
def launch_facebook_wizard():
    import subprocess
    cmd = 'start "Facebook Connect Wizard" cmd /c ".venv\\Scripts\\python.exe src\\connect_facebook.py & pause"'
    subprocess.Popen(cmd, shell=True, cwd=os.getcwd())
    return {"status": "launched", "message": "Facebook Connect Wizard opened in a new window."}


@app.get("/api/platforms/status")
def get_platforms_status():
    return cred_mgr.list_configured_platforms()


@app.post("/api/platforms/{platform}/credentials")
def save_platform_credentials(platform: str, payload: CredentialsPayload):
    try:
        # Merge with existing values so e.g. re-entering client_id doesn't wipe OAuth tokens
        existing = cred_mgr.get_credentials(platform) or {}
        new_values = {k: v for k, v in payload.credentials.items() if v not in (None, "", "...")}
        saved = cred_mgr.save_credentials(platform, {**existing, **new_values})
        return {"success": saved, "platform": platform}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.delete("/api/platforms/{platform}/credentials")
def delete_platform_credentials(platform: str):
    try:
        deleted = cred_mgr.delete_credentials(platform)
        return {"success": deleted, "platform": platform}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/platforms/details")
def get_platforms_details():
    """Returns live connection health and profile info for all 4 platforms."""
    details = {}
    for platform_name in ("youtube", "facebook", "instagram", "tiktok"):
        is_configured = cred_mgr.has_credentials(platform_name)
        if not is_configured:
            details[platform_name] = {
                "configured": False,
                "valid": False,
                "title": None,
                "subtitle": "Not Connected",
                "error": None,
            }
            continue

        creds = cred_mgr.get_credentials(platform_name) or {}
        adapter = scheduler_instance.adapters.get(platform_name)
        if not adapter:
            details[platform_name] = {"configured": True, "valid": False, "subtitle": "Adapter missing"}
            continue

        try:
            check = adapter.verify_account(creds)
            valid = check.get("valid", False)
            title = None
            subtitle = "Connected"

            if platform_name == "youtube":
                title = check.get("channel_title")
                subs = check.get("subscriber_count")
                subtitle = f"{subs} subscribers" if subs else "YouTube Channel Active"
            elif platform_name == "facebook":
                title = check.get("page_name") or creds.get("page_name")
                subtitle = f"Page ID: {check.get('page_id') or creds.get('page_id')}"
            elif platform_name == "instagram":
                username = check.get("username") or creds.get("username")
                title = f"@{username}" if username else "Instagram Creator"
                subtitle = check.get("account_type", "Professional Account")
            elif platform_name == "tiktok":
                username = check.get("creator_username") or check.get("creator_nickname")
                title = f"@{username}" if username else "TikTok Creator"
                subtitle = "Content Posting API Active"

            details[platform_name] = {
                "configured": True,
                "valid": valid,
                "title": title,
                "subtitle": subtitle if valid else "Session Expired / Token Invalid",
                "error": check.get("error") if not valid else None,
                "raw": check,
            }
        except Exception as e:
            details[platform_name] = {
                "configured": True,
                "valid": False,
                "title": None,
                "subtitle": "Verification Error",
                "error": str(e),
            }

    return details


@app.post("/api/meta/smart-connect")
def smart_connect_meta(req: MetaSmartConnectRequest):
    """Auto-connects Facebook Page and linked Instagram Professional account in 1 click."""
    res = auto_connect_meta(
        token=req.token,
        app_id=req.app_id,
        app_secret=req.app_secret,
        preferred_page_id=req.page_id,
    )
    if not res.get("success"):
        raise HTTPException(status_code=400, detail=res.get("error", "Failed to connect Meta accounts."))
    return res


@app.get("/api/youtube/status")
def get_youtube_status():
    """Checks client_secret.json presence and current YouTube auth status."""
    from src.connect_youtube import find_client_secret_file
    secret_path = find_client_secret_file()
    has_secret_file = secret_path is not None and os.path.exists(secret_path)
    creds = cred_mgr.get_credentials("youtube") or {}
    has_token = bool(creds.get("refresh_token") or creds.get("token"))

    channel_info = None
    if has_token:
        adapter = scheduler_instance.adapters.get("youtube")
        if adapter:
            channel_info = adapter.verify_account(creds)

    return {
        "client_secret_found": has_secret_file,
        "client_secret_path": secret_path,
        "token_saved": has_token,
        "channel_info": channel_info,
    }


# ---------------- Logs Inspection ----------------

@app.get("/api/logs")
def get_recent_logs(lines: int = 60):
    log_file = os.path.join("logs", "publisher.log")
    if not os.path.exists(log_file):
        return {"lines": ["Log file has not been created yet."]}

    try:
        with open(log_file, "r", encoding="utf-8", errors="ignore") as f:
            content = f.readlines()
            return {"lines": [line.strip() for line in content[-lines:]]}
    except Exception as e:
        return {"lines": [f"Error reading logs: {e}"]}
