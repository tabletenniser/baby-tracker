# 🍼 Baby Tracker

A small, self-hosted web app to track your baby's **feeding, sleep, pee/poop, and supplements** — with a day-by-day timeline, trend charts, and a WHO growth chart.

- **Backend:** Python (FastAPI) — data persisted to a JSON file on disk
- **Frontend:** TypeScript (React + Vite + Recharts) — mobile & iPad friendly
- **No database required** — everything lives in `backend/data.json`

## Features

Two tabs:

### 📅 Timeline (main view)
- **Exact age** in the header (e.g. "2 months 17 days old"), tap it to edit the profile (birthday + sex).
- **Daily totals** — **total milk** (breast + formula), breast milk, formula, sleep hours, pee, poop, and supplements.
- A **chronological list** of the day's activities (ascending time), with one-tap **add** buttons for **Feeding / Sleep / Pee-Poop / Supplement** (each opens a modal), plus edit/delete on every entry.
- **Overnight sleep handled correctly** — a sleep that runs past midnight is split across the two days: it shows at its start time on the first day and as "Slept until HH:MM (from HH:MM prev night)" on the next day, and each day's sleep total only counts its own portion.

### 📊 Insights (visualization)
- **Milk per day** — stacked bars separating breast and formula.
- **Sleep per day** and **Poop per day** trends.
- **Nighttime sleep** — the average time the baby usually falls asleep.
- **Growth chart** — the baby's weight (from the "before" weight of each breast feeding) plotted against the **WHO weight-for-age percentile curves** (3rd/15th/50th/85th/97th) for the baby's sex, with the latest weight's approximate percentile.
- **Range selector** — 7 / 14 / 31 days, or a custom date range.

### Entry details
- **First-run setup** — asks for the baby's birthday and sex.
- **Feedings** (with historical backfilling): defaults to the current time, but you can change it and navigate to past days.
  - **Breast (weight method):** enter multiple weights; the first is the "before" weight, each later one is tagged **Left / Right / N/A**. The app calculates the amount fed for each breast. The "before" weight also feeds the growth chart.
  - **Bottle:** enter formula milk (ml) and breast milk (ml). Leave a field empty to treat it as zero.
- **Sleep** — log by *start + end time* **or** *duration + end time*.
- **Pee & Poop** — track each event; for poop, record **size** (S/M/L, default M) and **watery** (Formed / Middle / Watery, default Middle).
- **Supplements** — pick from a list (Vitamin D, Probiotic, Iron, Vitamin C) or enter a custom name, with a timestamp.
- **Persistence** — data is saved to disk on every change, so restarting the server never loses anything.

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
| GET/PUT | `/api/baby` | Read / set the baby's birthday + sex |
| GET/POST | `/api/feedings` | List (by `?date=`) / create feedings |
| PUT/DELETE | `/api/feedings/{id}` | Update / delete a feeding |
| GET/POST | `/api/sleeps` | List (by `?date=`) / create sleep |
| PUT/DELETE | `/api/sleeps/{id}` | Update / delete a sleep |
| GET/POST | `/api/eliminations` | List (by `?date=`) / create pee/poop |
| PUT/DELETE | `/api/eliminations/{id}` | Update / delete an entry |
| GET/POST | `/api/supplements` | List (by `?date=`) / create supplements |
| PUT/DELETE | `/api/supplements/{id}` | Update / delete a supplement |
| GET/PUT | `/api/vitamin?date=` | Read / set vitamin D for a day (back-compat) |
| GET | `/api/daily?date=` | Daily summary (incl. total milk + supplements) |
| GET | `/api/timeline?date=` | Chronological activities for a day (overnight sleep split) |
| GET | `/api/stats?start=&end=` | Time series: milk, sleep, poop, pee, bedtime |
| GET | `/api/growth` | Weight points + WHO percentile curves + latest percentile |
