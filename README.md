# FIFA 2026 Predictor — Deployment Guide

## Prerequisites
- GitHub account
- Supabase account (supabase.com)
- Vercel account (vercel.com)

---

## Step 1 — Set up Supabase Database

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Wait for the project to finish setting up (~2 min)
3. Go to **SQL Editor** → **New Query**
4. Copy and paste the contents of `supabase-schema.sql` and click **Run**
5. Go to **Project Settings** → **API**
6. Copy:
   - **Project URL** (looks like `https://xxxx.supabase.co`)
   - **anon public** key (long string starting with `eyJ...`)

---

## Step 2 — Push to GitHub

```bash
# In the project folder
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/wc2026-predictor.git
git push -u origin main
```

Or use GitHub Desktop to push the folder.

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com](https://vercel.com) and sign in with GitHub
2. Click **Add New Project**
3. Import your `wc2026-predictor` repository
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = your Project URL from Step 1
   - `VITE_SUPABASE_ANON_KEY` = your anon key from Step 1
5. Click **Deploy**
6. Your app will be live at `https://wc2026-predictor.vercel.app` (or similar)

---

## Step 4 — Share the URL

Share the Vercel URL with your friends. Everyone can use it from any device — no Claude account needed!

---

## Updating the app

If you need to fix bugs or make changes:
1. Edit the files locally
2. `git add . && git commit -m "Fix" && git push`
3. Vercel automatically redeploys in ~30 seconds

---

## Admin PIN

The admin PIN is **2026** — change this in `src/App.jsx` if you want.

---

## Notes

- The Supabase free tier supports up to 500MB and 50,000 API calls/month — more than enough for a friends league
- All data persists in the cloud — works across all devices and browsers
- The app is mobile-friendly
