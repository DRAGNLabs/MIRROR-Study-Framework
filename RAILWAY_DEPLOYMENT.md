# Railway Deployment Guide

This document covers the changes made to deploy the MIRROR Study Framework on [Railway](https://railway.app) and the steps to set up a new deployment.

## Why Railway?

The app requires **persistent WebSocket connections** (Socket.io) for real-time group chat and LLM streaming. This eliminates serverless platforms (Vercel, Firebase Cloud Functions) since they cannot maintain long-lived connections. Railway runs the app as a persistent Node.js process with full WebSocket support at ~$5/month for our scale (~10 concurrent users).

## Architecture: Single-Service Deployment

Instead of hosting the frontend and backend separately, the Express backend serves the React frontend's built static files. This means:

- **One Railway service** instead of two
- **No CORS issues** in production (same origin)
- **One URL** for everything
- The backend serves API routes at `/api/*` and the React app at all other routes

```
Browser  --->  Railway Service (Express on port $PORT)
                ├── /api/*          → API routes (users, rooms, survey, admin)
                ├── /socket.io/*    → WebSocket connections (Socket.io)
                └── /*              → React SPA (static files from my-app/dist/)
                        |
                        v
                Railway PostgreSQL (auto-provisioned)
```

---

## Code Changes Summary

All changes are tagged with `[Railway]` comments in the code for easy searching.

### New Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Orchestrates the Railway build. Nixpacks needs this at the root to detect Node.js. Contains `build` and `start` scripts. |
| `my-app/src/config.js` | Centralized frontend configuration. Exports `API_BASE` and `SOCKET_URL`, reading from Vite env vars. In production (single-service), uses relative paths (same origin). In local dev, defaults to `http://localhost:3001`. |
| `backend/.env.example` | Documents all required environment variables with descriptions. |

### Modified Files

| File | What Changed | Why |
|------|-------------|-----|
| `backend/index.js` | Added `path`/`fileURLToPath` imports, `CORS_ORIGIN` env var, `express.static()` for serving frontend dist, SPA catch-all route using Express 5 `{*splat}` syntax | Backend now serves the React frontend in production and reads CORS config from env vars instead of hardcoded localhost |
| `backend/package.json` | `"start"` changed from `nodemon` to `node`, added `"dev"` script for nodemon | Railway uses `npm start` in production; nodemon is a dev-only tool that shouldn't run in prod |
| `backend/services/roomsService.js` | `API_BASE` reads from `process.env.PORT` / `process.env.API_BASE` instead of hardcoded `localhost:3001` | Backend self-calls need to work on whatever port Railway assigns |
| `my-app/services/roomsService.js` | Replaced `const API_BASE = "http://localhost:3001/api"` with `import { API_BASE } from "../src/config.js"` | All API calls now route through the centralized config |
| `my-app/services/surveyService.js` | Same as above | Same as above |
| `my-app/services/usersService.js` | Same as above | Same as above |
| `my-app/services/adminService.js` | Same as above | Same as above |
| `my-app/src/socket.js` | Imports `SOCKET_URL` from config. Uses `io()` (no URL = same origin) in production, `io(SOCKET_URL)` in dev | Socket.io must connect to the right host in any environment |
| `my-app/src/admin/roomManagement.jsx` | Display URL and QR code use `window.location.origin` instead of hardcoded `localhost:5173` / `dragn.ai` | URL and QR code now automatically match whatever domain the app is running on |
| `my-app/src/App.jsx` | Fixed import casing: `Survey` -> `survey`, `Interaction` -> `interaction`, `WaitingRoom` -> `waitingRoom`, `RoomManagement` -> `roomManagement` | Linux filesystems (Railway's build server) are case-sensitive. macOS/Windows are not, so these mismatches went unnoticed locally |

---

## Setting Up a New Railway Deployment

### Prerequisites
- A [Railway](https://railway.app) account (GitHub OAuth sign-in recommended)
- The repo pushed to GitHub
- An OpenAI API key
- A bcrypt-hashed admin password (see step 4)

### Step 1: Create a Railway Project
1. Log in to [railway.app](https://railway.app)
2. Click **"New Project"** -> **"Empty Project"**

### Step 2: Add PostgreSQL
1. In the project dashboard, click **"+ New"** -> **"Database"** -> **"PostgreSQL"**
2. Railway provisions the database and auto-generates connection variables

### Step 3: Add the App Service
1. Click **"+ New"** -> **"GitHub Repo"** -> select the MIRROR-Study-Framework repo
2. In the service **Settings** tab, configure:
   - **Root Directory:** `/` (leave blank or set to `/`)
   - **Build Command:** `npm run build`
   - **Start Command:** `npm start`
   - **Branch:** `railway-migration` (or `main` once merged)

### Step 4: Set Environment Variables

In the service **Variables** tab:

**Manual variables (you provide these):**

| Variable | Value | Notes |
|----------|-------|-------|
| `OPENAI_API_KEY` | `sk-...` | Your OpenAI API key |
| `OPENAI_MODEL` | `gpt-4o` | Or whichever model you use |
| `ADMIN_PASSWORD_HASH` | `$2b$10$...` | Bcrypt hash of your admin password |

To generate the admin password hash, run this from the `backend/` directory (after `npm install`):
```bash
node -e 'import("bcrypt").then(b => b.default.hash("YOUR_PASSWORD_HERE", 10).then(h => console.log(h)))'
```
Copy the output (starts with `$2b$10$`) and paste it as the `ADMIN_PASSWORD_HASH` value.

**Reference variables (linked from PostgreSQL service):**

Click **"Add Variable Reference"** and link these from the PostgreSQL service:
- `PGHOST`
- `PGPORT`
- `PGDATABASE`
- `PGUSER`
- `PGPASSWORD`

Railway stores these as references (e.g., `${{Postgres.PGHOST}}`) so they update automatically if the database changes.

**Variables you do NOT need to set:**
- `PORT` — Railway sets this automatically
- `CORS_ORIGIN` — Not needed in single-service mode
- `API_BASE` — Defaults correctly in production

### Step 5: Generate a Public Domain
1. Go to the service **Settings** -> **Networking** -> **Generate Domain**
2. You'll get a URL like `https://mirror-study-xxxx.up.railway.app`
3. (Optional) Add a custom domain under the same section

### Step 6: Deploy
Railway auto-deploys on push to the configured branch. You can also trigger a manual deploy from the dashboard.

### Step 7: Verify
1. Open the Railway URL in a browser
2. Log in as admin, create a room
3. Open 3 browser tabs, join the room as different users
4. Run through the full flow: instructions -> chat -> LLM streaming -> survey -> exit
5. Check the Railway Postgres web UI to verify data persistence

---

## Local Development (Unchanged)

Local development still works the same way. The config module detects `import.meta.env.DEV` and defaults to `localhost:3001`:

```bash
# Terminal 1: Backend
cd backend
npm install
npm run dev      # <-- note: 'dev' not 'start' (uses nodemon for auto-restart)

# Terminal 2: Frontend
cd my-app
npm install
npm run dev
```

The frontend runs on `http://localhost:5173`, backend on `http://localhost:3001`. The config module handles the cross-origin setup automatically.

---

## Cost

- **Railway Hobby plan:** $5/month (includes $5 in usage credits)
- A small Express server + PostgreSQL for ~10 concurrent users stays within included credits
- OpenAI API costs are separate
