# DataPilot — Quick Testing Setup (ngrok)

This lets you share a working link with someone for testing, without
deploying anywhere. Your PC needs to stay on while they're testing.

## One-time setup (do this once)

1. Install ngrok: https://ngrok.com/download
2. Sign up for a free ngrok account and run:
   ```
   ngrok config add-authtoken YOUR_TOKEN
   ```
   (Token is shown on your ngrok dashboard after signup)
3. Make sure PostgreSQL is set up and `backend\.env` has the right
   credentials. Run this to check:
   ```
   scripts\check-database.bat
   ```
   It will show your current .env DB settings, check if the PostgreSQL
   Windows service is running, and try an actual test connection. Fix
   anything it flags before moving on — login, signup, scheduled reports,
   and comments all depend on this working.

## Every time you want to test with someone

### Step 1 — Run the start script
Double-click: `scripts\start-testing.bat`

This opens 4 windows:
- **DataPilot Backend** — the API server
- **Backend Ngrok** — makes the backend reachable from outside your PC
- **DataPilot Frontend** — the web app
- **Frontend Ngrok** — makes the frontend reachable from outside your PC

### Step 2 — Get the backend's public URL
Look at the **"Backend Ngrok"** window. You'll see a line like:
```
Forwarding   https://a1b2-c3d4.ngrok-free.app -> http://localhost:8001
```
Copy that `https://...ngrok-free.app` URL.

### Step 3 — Point the frontend at that backend URL
Open `frontend\.env.local` and set:
```
VITE_API_URL=https://a1b2-c3d4.ngrok-free.app
```
Save the file.

### Step 4 — Restart only the frontend window
Close the **"DataPilot Frontend"** window, then re-run:
```
cd frontend
npm run dev
```
(This is needed because Vite only reads .env.local on startup.)

### Step 5 — Get the frontend's public URL
Look at the **"Frontend Ngrok"** window — copy its `https://...ngrok-free.app`
URL. **This is the link you send to the person testing.**

## When you're done testing

Double-click: `scripts\stop-testing.bat`

This closes everything cleanly so the ports are free next time.

## Things to know

- Both ngrok URLs change every time you restart ngrok (free plan) — you'll
  need to repeat steps 2-5 each session.
- Your PC must stay on and these windows must stay open while the other
  person is testing — closing them breaks the link immediately.
- The very first time someone opens an ngrok link, they may see an
  interstitial warning page — they just click "Visit Site" to continue.
- If login/signup/scheduled reports/comments don't work, check that
  PostgreSQL is running and `backend\.env` has the right DB credentials.
