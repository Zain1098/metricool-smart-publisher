# Metricool Smart Social Publisher 🚀
### Autonomous Multi-Platform Social Media Scheduler & Video Autopilot (Next.js + Vercel Ready)

**Metricool Smart Social Publisher** is a modern full-stack web platform designed to schedule and publish vertical short-form videos across **YouTube Shorts**, **Instagram Reels**, **TikTok**, **Facebook Reels**, **X (Twitter)**, and **LinkedIn** with platform-specific tailoring (titles, captions, hashtags, and privacy settings) and an interactive visual calendar.

---

## 🌟 Key Features

1. **Multi-Channel Video Composer:**
   - Single video upload (MP4, MOV, WebM) with automatic aspect ratio, duration, and file size detection.
   - Master caption and global hashtags auto-sync across all selected networks.
   - Tailored tab-by-tab overrides:
     - **YouTube Shorts:** Video title (100 char limit), Description (5000 char limit), Shorts toggle, Visibility (Public, Unlisted, Private).
     - **Instagram Reels:** Caption (2200 char limit), Reels toggle, First Comment (for hashtags & links).
     - **TikTok:** Caption (2200 char limit), Allow Duet / Allow Stitch toggles.
     - **Facebook Reels:** Caption & Reels toggle.
     - **X (Twitter):** 280 character counter with progress indicator.
     - **LinkedIn:** Caption & Post visibility.
   - Live Phone Simulation Mockup for real-time visual preview.

2. **Visual Interactive Calendar:**
   - 7-day and monthly timeline view.
   - **Algorithmic Best Time to Post Heatmap** (Peak audience activity indicators).
   - Instant 1-click slot scheduling.

3. **1-Click OAuth Social Connections:**
   - Metricool-style connection dashboard.
   - End-users simply click "Connect Account" without entering raw developer API keys.

4. **Performance & Growth Analytics:**
   - Unified audience reach, views, likes, shares, and engagement rates across all networks.
   - Cross-platform audience share breakdown.

5. **20 Free Posts Tier:**
   - Free monthly post limit tracker with progress bar, exactly like Metricool's free plan.

---

## 🛠️ Tech Stack

- **Framework:** Next.js 14 (App Router) + React 18 + TypeScript
- **Styling:** Tailwind CSS + Lucide Icons
- **Storage & State:** Dual Mode (Built-in Local JSON / Serverless Memory + Plug & Play Supabase & Cloudflare R2 / AWS S3)
- **Deployment:** Vercel (with `vercel.json` and Vercel Cron trigger)

---

## 🚀 Quick Start (Local Development)

```bash
# 1. Install dependencies
npm install

# 2. Run local development server
npm run dev

# 3. Open in browser
http://localhost:3000
```

---

## 🌐 Deploy to Vercel in 1 Click

1. Push this repository to your GitHub account (`Zain1098`).
2. Go to [Vercel Dashboard](https://vercel.com/new).
3. Import this repository.
4. Framework Preset will automatically detect **Next.js**.
5. Click **Deploy**!
6. Vercel Cron will automatically trigger `/api/cron` every minute to check and publish scheduled posts.

---

## 📁 Repository Structure

```text
├── app/
│   ├── layout.tsx             # Root layout with sidebar & header
│   ├── page.tsx               # Overview Dashboard
│   ├── composer/page.tsx      # Multi-Channel Video Composer & Editor
│   ├── calendar/page.tsx      # Interactive Visual Scheduler
│   ├── analytics/page.tsx     # Performance & Growth Analytics
│   ├── connections/page.tsx   # 1-Click Social Media OAuth Connections
│   ├── settings/page.tsx      # Brand settings & timezone configuration
│   └── api/                   # REST API routes (posts, accounts, analytics, cron)
├── components/                # Modular UI components
├── lib/                       # Types, utilities, and Dual-Mode data store
├── legacy-python/             # Preserved Python scripts from previous version
├── vercel.json                # Vercel deployment & cron job definition
└── .env.example               # Production environment variable template
```
