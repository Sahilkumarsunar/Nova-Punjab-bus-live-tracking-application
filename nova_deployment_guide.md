# Nova — Free Deployment Guide

Deploy the entire Nova project (Backend + Frontend + Mobile) for **₹0** using free-tier services.

---

## Architecture Overview

```mermaid
graph LR
  A["Mobile App<br/>(Expo EAS)"] -->|REST + Socket.IO| B["Backend API<br/>(Render)"]
  C["Frontend Web<br/>(Vercel)"] -->|REST + Socket.IO| B
  B -->|Read/Write| D["MongoDB Atlas<br/>(Free Cluster)"]
```

| Part | Service | Free Tier |
|---|---|---|
| **Database** | MongoDB Atlas | ✅ Already set up (M0 free cluster) |
| **Backend** (Node + Socket.IO) | [Render.com](https://render.com) | 750 hrs/month free |
| **Frontend** (Vite + React) | [Vercel](https://vercel.com) | Unlimited static deploys |
| **Mobile** (Expo) | [Expo EAS](https://expo.dev) | 30 free builds/month |

---

## Step 1: Push to GitHub

> [!IMPORTANT]
> Your `.env` contains secrets. **Never push it to GitHub.** Add it to `.gitignore` first.

```bash
# From project root (e:\nova)
git init
```

Create `e:\nova\.gitignore`:
```
node_modules/
dist/
.env
*.env.local
.expo/
```

```bash
git add .
git commit -m "Initial commit — Nova Punjab Bus Tracking"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/nova.git
git push -u origin main
```

---

## Step 2: Deploy Backend on Render

> [!NOTE]
> Render supports **WebSockets (Socket.IO)** on their free tier — unlike Vercel serverless functions which do not.

### 2.1 — Create a Render Web Service

1. Go to [render.com](https://render.com) → **New** → **Web Service**
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| **Name** | `nova-backend` |
| **Root Directory** | `backend` |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Instance Type** | Free |

### 2.2 — Add Environment Variables

In Render dashboard → **Environment** tab, add:

| Key | Value |
|---|---|
| `MONGO_URI` | `mongodb+srv://sahilsunar530:SahilSunar1432@nova.swrewml.mongodb.net/?appName=Nova` |
| `JWT_SECRET` | `change_this_to_a_long_random_string_at_least_32_charscf` |
| `PORT` | `10000` *(Render uses 10000 by default)* |

### 2.3 — Deploy

Click **Create Web Service**. Render will:
- Install dependencies
- Run `npm start` → `node server.js`
- Give you a URL like: **`https://nova-backend-xxxx.onrender.com`**

> [!WARNING]
> Render free tier sleeps after 15 min of inactivity. First request after sleep takes ~30s to cold-start. This is fine for a college project demo.

### 2.4 — Test It

```
https://nova-backend-xxxx.onrender.com/
→ Should return: { "app": "NOVA", "status": "ok" }
```

---

## Step 3: Deploy Frontend on Vercel

### 3.1 — Create a Vercel Project

1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. Configure:

| Setting | Value |
|---|---|
| **Root Directory** | `frontend` |
| **Framework Preset** | Vite |
| **Build Command** | `npm run build` |
| **Output Directory** | `dist` |

### 3.2 — Add Environment Variable

In Vercel → **Settings** → **Environment Variables**, add:

| Key | Value |
|---|---|
| `VITE_API_URL` | `https://nova-backend-xxxx.onrender.com/api` |

> [!IMPORTANT]
> Replace `xxxx` with your actual Render subdomain. The `/api` suffix is required — your frontend axios instance expects it.

### 3.3 — Fix Client-Side Routing

Vercel needs to know that all routes should serve `index.html` (since React Router handles routing). Create this file:

**`frontend/vercel.json`**:
```json
{
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

### 3.4 — Deploy

Click **Deploy**. Vercel will give you a URL like: **`https://nova-punjab.vercel.app`**

Your frontend will now:
- Make API calls to your Render backend
- Connect Socket.IO to `https://nova-backend-xxxx.onrender.com`
- Geolocation will work because Vercel serves over HTTPS!

---

## Step 4: Deploy Mobile App with Expo EAS

### 4.1 — Update the API URL

Edit `mobile/services/api.js` and set the `baseURL` to your deployed backend:

```javascript
const API_URL = "https://nova-backend-xxxx.onrender.com/api";
```

Also update the Socket URL in `mobile/screens/TripScreen.js`:
```javascript
const socketUrl = "https://nova-backend-xxxx.onrender.com";
```

### 4.2 — Build APK with EAS (Free)

```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# From e:\nova\mobile
eas build:configure

# Build Android APK (free tier: 30 builds/month)
eas build --platform android --profile preview
```

This will give you a downloadable `.apk` file that you can install directly on any Android phone.

### 4.3 — For Quick Testing (No Build)

If you just want to test immediately, use Expo Go:
1. Update `API_URL` to your Render backend URL
2. Run `npx expo start`
3. Scan QR code with Expo Go app on your phone

---

## Step 5: Update MongoDB Atlas Network Access

> [!CAUTION]
> Your Atlas cluster may be restricted to your local IP. You must allow Render's servers.

1. Go to [MongoDB Atlas](https://cloud.mongodb.com) → **Network Access**
2. Click **Add IP Address** → **Allow Access from Anywhere** (`0.0.0.0/0`)
3. This is required because Render's free tier uses shared IPs

---

## Post-Deployment Checklist

- [ ] Backend is live: `https://nova-backend-xxxx.onrender.com/` returns `{"app":"NOVA","status":"ok"}`
- [ ] Frontend is live: `https://nova-punjab.vercel.app` loads the home page
- [ ] Frontend connects to backend: Routes page shows bus routes from database
- [ ] Socket.IO works: Live tracking page updates when a driver starts a trip
- [ ] Mobile app connects: Update `API_URL`, rebuild, and test login + trip
- [ ] Geolocation works on mobile browser: HTTPS (Vercel) enables GPS access

---

## Quick Reference — All URLs

| Service | URL |
|---|---|
| Backend API | `https://nova-backend-xxxx.onrender.com/api` |
| Socket.IO | `https://nova-backend-xxxx.onrender.com` |
| Frontend | `https://nova-punjab.vercel.app` |
| MongoDB | Atlas M0 free cluster (already configured) |

---

## Cost Summary

| Service | Cost |
|---|---|
| MongoDB Atlas M0 | Free forever (512 MB) |
| Render Free Tier | Free (750 hrs/month, cold starts) |
| Vercel Hobby | Free (unlimited static deploys) |
| Expo EAS | Free (30 builds/month) |
| **Total** | **₹0** |
