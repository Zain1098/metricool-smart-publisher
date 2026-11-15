# Postiz Standalone Deployment & Configuration Guide

This guide describes how to deploy, configure, and connect the official **Postiz** publishing engine with **ZCodeDev Metricool Studio**.

---

## 1. Architecture Overview & Infrastructure Rules

1. **Independent Stack Requirement:**
   - Postiz is an open-source multi-service application containing Next.js, Redis, PostgreSQL, and background BullMQ workers.
   - It **cannot** be hosted on Netlify (Netlify is serverless stateless functions only).
   - It **must not** be deployed on a 1 GB VPS (Postiz with Redis and workers requires a minimum of **2 GB RAM**, ideally 4 GB RAM).

2. **Recommended Hosting Providers:**
   - **Hetzner / DigitalOcean / Vultr / Linode:** 2 CPU / 4 GB RAM VPS ($8 - $12/month) running Docker Compose.
   - **Railway / Coolify / Render:** Managed container deployments with persistent storage volumes.

---

## 2. Quick Deploy with Docker Compose

1. Clone or download `docs/docker-compose.postiz.yml` onto your server.
2. Generate secure random secrets:
   ```bash
   openssl rand -hex 32
   ```
3. Update the environment variables in `docker-compose.postiz.yml`:
   - `MAIN_URL`: Your domain (e.g. `https://postiz.yourdomain.com`)
   - `JWT_SECRET`: Random 32-byte secret
   - `POSTGRES_PASSWORD`: Strong database password
   - `WEBHOOK_SECRET`: Secure secret shared with Metricool Studio
4. Start the stack:
   ```bash
   docker compose -f docker-compose.postiz.yml up -d
   ```
5. Set up a reverse proxy (e.g., Caddy or Nginx) with automatic SSL pointing to port `4200`.

---

## 3. Obtaining Postiz API Key & Webhook Configuration

1. **Log in to Postiz:**
   - Open your deployed Postiz instance URL (e.g. `https://postiz.yourdomain.com`).
   - Create your administrator account.
2. **Connect Social Channels:**
   - Go to **Integrations / Channels** inside Postiz.
   - Connect your social accounts:
     - YouTube
     - Instagram (via Meta)
     - Facebook Pages
     - TikTok
     - X (Twitter)
     - LinkedIn
     - Threads
     - Pinterest
3. **Generate API Key:**
   - Navigate to **Settings** → **API / Developers**.
   - Generate a new API Key with full publishing permissions.
4. **Configure Webhook:**
   - Add a webhook endpoint URL:
     ```
     https://zcodedev-metricool-studio.netlify.app/api/webhooks/postiz
     ```
   - Events to subscribe: `post.published`, `post.failed`, `post.cancelled`.
   - Secret: Enter the same secret used in `POSTIZ_WEBHOOK_SECRET`.

---

## 4. Connecting Postiz to ZCodeDev Metricool Studio

Add the following environment variables to your Netlify dashboard (or `.env.local` for local development):

```env
POSTIZ_API_URL=https://postiz.yourdomain.com/api/v1
POSTIZ_API_KEY=your_postiz_api_key_here
POSTIZ_WEBHOOK_SECRET=your_postiz_webhook_signing_secret_here
```

### What Happens Once Configured:
- Metricool Studio's **Social Accounts** screen will automatically pull live connected channels via `/api/postiz/channels`.
- When you click **Publish Now** or schedule a post, Metricool Studio sends the post payload and R2 media URL directly to Postiz.
- Postiz distributes the video to the selected platforms and fires the webhook back to Metricool Studio upon completion.
- If Postiz is unconfigured or temporarily unavailable, Metricool Studio automatically falls back to direct platform publishers without crashing or falsely reporting success.
