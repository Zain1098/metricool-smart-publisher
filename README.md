# Metricool Smart Social Publisher

### Multi-Platform Social Media Scheduler & Video Publishing Studio (Next.js + Supabase + R2)

**Metricool Smart Social Publisher** is a full-stack web platform for scheduling and publishing short-form videos and posts across **YouTube Shorts**, **Instagram Reels**, **TikTok**, **Facebook Reels**, **X (Twitter)**, **Threads**, **LinkedIn**, and **Pinterest** with platform-specific tailoring, a media library, publishing queue, analytics, and an interactive visual calendar.

---

## Key Features

1. **Multi-Channel Video Composer (`/composer`):**
   - Video upload (MP4, MOV, WebM) with aspect ratio, duration, and file size detection.
   - Master caption and global hashtags that sync across selected networks.
   - Platform-specific overrides (YouTube Shorts title/description/visibility, Instagram Reels first comment, TikTok Duet/Stitch toggles, X 280-char counter, LinkedIn visibility) with live mobile preview.

2. **Visual Interactive Calendar (`/calendar`):**
   - Weekly and monthly timeline views with Best Time to Post heatmap and 1-click slot scheduling.

3. **Media Library & Publishing Queue (`/media`, `/publishing`):**
   - Manage uploaded video assets (local or Cloudflare R2 presigned/multipart uploads) and track scheduled, queued, published, and failed jobs.

4. **Social Connections (`/connections`):**
   - Unified connection dashboard supporting Postiz-proxied channels or direct platform OAuth credentials.

5. **Performance & Growth Analytics (`/analytics`):**
   - Cross-platform audience reach, views, likes, comments, per-post metrics (YouTube, Instagram, Facebook, TikTok, X, Threads, LinkedIn, Pinterest), and growth snapshots.

6. **Reporting Studio & Public Share Links (`/reports`, `/reports/preview/[token]`):**
   - Block-based custom report builder (KPIs, platform breakdown, timeline chart, top videos, topic insights, strategist notes) with **CSV**, **Print/PDF** export, and **unlimited shareable public URLs** (no paywall or plan limits).

7. **Web & Blog Analytics Pixel (`/web-analytics`, `/public/pixel.js`):**
   - Self-hosted tracking script (`<script src=".../pixel.js" data-site="your-site" defer></script>`) to measure pageviews, unique sessions, top pages, and referrers on any website or WordPress blog.

8. **SmartLinks / Link-in-Bio (`/smartlinks`, `/u/[slug]`):**
   - Custom bio-link pages with live mobile preview and per-link click & view tracking.

9. **Evergreen Flows / Autolists (`/flows`):**
   - Recurring content queues that loop and feed directly into your Publishing Queue.

10. **Competitors & Hashtag Tracker (`/competitors`):**
    - Track competitor `@handles` (subscribers, views, video counts) and monitor hashtag search volume.

---

## Tech Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **Storage & State (Dual Mode):**
  - **Local Mode (Default):** Works out-of-the-box with local JSON storage (`data/store.json`) and local uploads — no external database required to try it locally.
  - **Production Mode:** PostgreSQL via **Supabase** + **Cloudflare R2** (S3-compatible) media storage + **Postiz** publishing engine.
- **Deployment:** Vercel (`vercel.json` with Cron) or Netlify (`netlify.toml`)

---

## Quick Start (Local Development)

### Prerequisites
- **Node.js** 18+ (20+ recommended)
- **npm**

### 1. Clone & Install
```bash
git clone https://github.com/Zain1098/metricool-smart-publisher.git
cd metricool-smart-publisher
npm install
```

### 2. Configure Environment Variables
Copy the example template to `.env.local`:

```bash
# macOS / Linux
cp .env.example .env.local

# Windows (PowerShell / CMD)
copy .env.example .env.local
```

> **Tip:** To run locally in demo/local mode, you can leave the external keys blank in `.env.local` and the app will automatically fall back to local storage.

### 3. Run Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Production Setup (Supabase + Cloudflare R2 + Postiz)

1. **Database (Supabase):**
   - Create a Supabase project and run the SQL migration in [`supabase/migrations/20261111000001_metricool_schema.sql`](supabase/migrations/20261111000001_metricool_schema.sql).
   - Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` in your environment variables.
2. **Media Storage (Cloudflare R2):**
   - Configure `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, and `NEXT_PUBLIC_R2_PUBLIC_URL`.
3. **Publishing Engine (Postiz — Optional):**
   - See [`docs/POSTIZ_DEPLOYMENT_GUIDE.md`](docs/POSTIZ_DEPLOYMENT_GUIDE.md) for self-hosting Postiz with Docker Compose (`docs/docker-compose.postiz.yml`).
   - Set `POSTIZ_API_URL`, `POSTIZ_API_KEY`, and `POSTIZ_WEBHOOK_SECRET`.
4. **Cron Secret:**
   - Generate a strong random string for `CRON_SECRET` to protect `/api/cron`.

---

## Deploy to Vercel

1. Fork or push this repository to your GitHub account.
2. Go to [Vercel Dashboard](https://vercel.com/new) and import your repository.
3. Framework Preset will automatically detect **Next.js**.
4. Add your environment variables from `.env.example` in Vercel Project Settings.
5. Click **Deploy**.
6. `vercel.json` configures Vercel Cron to trigger `/api/cron` every minute for scheduled posts.

---

## Build & Verification

```bash
# Production build & typecheck
npm run build

# Lint check
npm run lint
```

---

## Repository Structure

```text
├── app/
│   ├── layout.tsx             # Root layout with sidebar & header
│   ├── page.tsx               # Overview Dashboard
│   ├── composer/page.tsx      # Multi-Channel Video Composer & Editor
│   ├── calendar/page.tsx      # Interactive Visual Scheduler
│   ├── media/page.tsx         # Media Asset Library
│   ├── publishing/page.tsx    # Publishing Queue & Job Logs
│   ├── analytics/page.tsx     # Cross-Platform Performance & Growth Analytics
│   ├── reports/page.tsx       # Reporting Studio & Public Shareable Reports
│   ├── web-analytics/page.tsx # Self-Hosted Web & Blog Tracking Pixel
│   ├── smartlinks/page.tsx    # SmartLinks (Link-in-Bio Builder) & /u/[slug]
│   ├── flows/page.tsx         # Evergreen Flows (Autolists)
│   ├── competitors/page.tsx   # Competitors & Hashtag Tracker
│   ├── connections/page.tsx   # Social Media Connections
│   ├── settings/page.tsx      # Brand settings & timezone configuration
│   ├── login/page.tsx         # Authentication page
│   └── api/                   # REST API routes (posts, accounts, analytics, reports, pixel, smartlinks, flows, competitors, r2, postiz, cron)
├── components/                # Modular UI components
├── lib/                       # Types, utilities, R2/Postiz/Supabase adapters & dual-mode store
├── supabase/migrations/       # PostgreSQL schema migrations
├── docs/                      # Postiz deployment guide & verification reports
├── legacy-python/             # Archived Python implementation
├── vercel.json                # Vercel deployment & cron job definition
├── netlify.toml               # Netlify deployment configuration
└── .env.example               # Environment variable template
```
