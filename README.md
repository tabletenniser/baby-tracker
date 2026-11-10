# 🍼 Baby Tracker

A small, self-hosted web app to track your baby's **feeding, sleep, pee/poop, and vitamin D**.

- **Backend:** Python (FastAPI) — data persisted to a JSON file on disk
- **Frontend:** TypeScript (React + Vite) — mobile & iPad friendly
- **No database required** — everything lives in `backend/data.json`

## Features

- **First-run setup** — asks for the baby's birthday; shows the baby's age.
- **Feedings** (with historical backfilling):
  - Defaults to the current time, but you can change it (and navigate to past days).
  - **Breast (weight method):** enter multiple weights; the first is the "before"
    weight, each later one is tagged **Left / Right / N/A**. The app calculates the
    amount fed for each breast.
  - **Bottle:** enter formula milk (ml) and breast milk (ml). Leave a field empty to
    treat it as zero.
- **Daily totals** — breast milk (ml), formula (ml), sleep hours, pee count, poop
  count, and vitamin D status.
- **Sleep** — log by *start + end time* **or** *duration + end time*.
- **Pee & Poop** — track each event; for poop, record **size** (S/M/L, default M)
  and **watery** (Formed / Middle / Watery, default Middle).
- **Vitamin D** — one tap to mark it as given for the day, with a timestamp.
- **Persistence** — data is saved to disk on every change, so restarting the server
  never loses anything.

## Quick start

### 1. Backend

```bash
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
```

The API is now at http://localhost:8000/api and the built frontend is served at
http://localhost:8000.

### 2. Frontend (build)

```bash
cd frontend
npm install
npm run build        # outputs to frontend/dist, served by the backend
```

### Development (hot reload)

Run the backend (above) and, in another terminal:

```bash
cd frontend
npm run dev          # http://localhost:5173, proxies /api to :8000
```

## Data

All data is stored in `backend/data.json` (created on first write). To use a
different location, set the `BABY_DATA_FILE` environment variable before starting
the server. Back up that file to back up your data.

## API overview

| Method | Path | Description |
| --- | --- | --- |
| GET/PUT | `/api/baby` | Read / set the baby's birthday |
| GET/POST | `/api/feedings` | List (by `?date=`) / create feedings |
| PUT/DELETE | `/api/feedings/{id}` | Update / delete a feeding |
| GET/POST | `/api/sleeps` | List (by `?date=`) / create sleep |
| PUT/DELETE | `/api/sleeps/{id}` | Update / delete a sleep |
| GET/POST | `/api/eliminations` | List (by `?date=`) / create pee/poop |
| PUT/DELETE | `/api/eliminations/{id}` | Update / delete an entry |
| GET/PUT | `/api/vitamin?date=` | Read / set vitamin D for a day |
| GET | `/api/daily?date=` | Daily summary |
