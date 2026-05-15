# NOVA — Punjab Bus Tracking System (MVP)

End-to-end MERN + React Native bus tracking platform for Punjab.
- **backend/** — Node.js + Express + MongoDB Atlas + JWT
- **frontend/** — React (Vite) + Leaflet for passengers
- **mobile/** — React Native (Expo) for drivers

> Architecture: Driver App → REST API → MongoDB Atlas → Web App.
> Polling every 10 seconds. No WebSockets.

---

## 1. Prerequisites

- Node.js 18+
- npm
- MongoDB Atlas account (free tier is fine)
- Expo Go app on your phone (for mobile)

## 2. MongoDB Atlas Setup

1. Go to https://www.mongodb.com/atlas → create free cluster.
2. Database Access → Add a user (username + password).
3. Network Access → Allow `0.0.0.0/0` (for development).
4. Connect → Drivers → copy the connection string. It looks like:
   `mongodb+srv://<user>:<pass>@cluster0.xxxxx.mongodb.net/nova?retryWrites=true&w=majority`

## 3. Backend

```bash
cd backend
cp .env.example .env       # then fill in MONGO_URI and JWT_SECRET
npm install
npm run seed               # seeds 21 Punjab routes (run once)
npm run dev                # starts on http://localhost:5000
```

## 4. Frontend (Web — Passengers)

```bash
cd frontend
cp .env.example .env       # set VITE_API_URL=http://localhost:5000/api
npm install
npm run dev                # http://localhost:5173
```

## 5. Mobile (React Native — Drivers)

```bash
cd mobile
npm install
# edit services/api.js → set API_URL to your backend URL
npx expo start
```
Open in Expo Go on your phone. Allow location permission.

## 6. Deployment

### Backend → Render
1. Push the `backend/` folder to GitHub.
2. Render → New → Web Service → connect repo.
3. Build command: `npm install`
4. Start command: `node server.js`
5. Environment: add `MONGO_URI`, `JWT_SECRET`, `PORT=5000`.

### Frontend → Vercel
1. Push `frontend/` to GitHub.
2. Vercel → New Project → import.
3. Framework: Vite.
4. Env: `VITE_API_URL=https://<your-render-url>/api`.

### Mobile
- Update `mobile/services/api.js` with the deployed Render URL.
- `npx expo start` then scan QR in Expo Go, or build with EAS for stores.

## 7. Environment Variables

**backend/.env**
```
PORT=5000
MONGO_URI=mongodb+srv://user:pass@cluster.mongodb.net/nova
JWT_SECRET=super_secret_change_me
```

**frontend/.env**
```
VITE_API_URL=http://localhost:5000/api
```

## 8. API Reference (summary)

Auth
- `POST /api/auth/register` — { name, phone, password }
- `POST /api/auth/login`    — { phone, password } → { token, driver }

Routes
- `GET    /api/routes`
- `GET    /api/routes/:id`
- `POST   /api/routes`         (auth)
- `PUT    /api/routes/:id`     (auth)
- `DELETE /api/routes/:id`     (auth)

Buses
- `POST   /api/buses/register`        (auth) — driver creates/updates own bus
- `PUT    /api/buses/:id`             (auth)
- `PUT    /api/buses/:id/location`    (auth) — { latitude, longitude }
- `POST   /api/buses/:id/start-trip`  (auth)
- `POST   /api/buses/:id/stop-trip`   (auth)
- `GET    /api/buses`                 — all buses (status auto-computed)
- `GET    /api/buses/:id`
- `GET    /api/buses/route/:routeId`  — buses on a given route

Offline rule: any bus whose `currentLocation.lastUpdated` is older than 2 minutes is returned as `status: "offline"`.

---

Made for Punjab. Government brands: Punjab Roadways, PRTC, PunBus. Private: Private Bus Operator.
