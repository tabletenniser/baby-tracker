# 🍼 Baby Tracker

A small, self-hosted web app to track your baby's **feeding, sleep, pee/poop, and supplements** — with a day-by-day timeline, trend charts, and a WHO growth chart.

- **Backend:** Python (FastAPI) — data persisted to a JSON file on disk
- **Frontend:** TypeScript (React + Vite + Recharts) — mobile & iPad friendly
- **Bilingual** — English / 中文, switchable from the top-right corner
- **No database required** — everything lives in `backend/data.json`

## Features

Two tabs:

### 📅 Timeline (main view)
- **Baby's name** in the top-left (set it in the profile); falls back to "Baby Tracker" if unset.
- **Exact age** in the header (e.g. "2 months 17 days old"), tap it to edit the profile (name, birthday, sex, day-cutoff).
- **Daily totals** — **total milk** (breast + formula), breast milk, formula, sleep hours, pee, poop, and supplements.
- A **chronological list** of the day's activities (ascending time), with one-tap **add** buttons for **Feeding / Sleep / Pee-Poop / Supplement** (each opens a modal), plus edit/delete on every entry.
- **Overnight sleep handled correctly** — a sleep that runs past midnight is split across the two days: it shows at its start time on the first day and as "Slept until HH:MM (from HH:MM prev night)" on the next day, and each day's sleep total only counts its own portion.
- **Day-cutoff** — controls where one day ends and the next begins for sleep attribution. Set a **global** default in the profile (default 12:00 AM) and an **optional per-day override** right in the timeline header (e.g. set it to 3:00 AM for a night the baby sleeps past 3). A "Reset" button clears a day's override.
- **Milk over the day** — a cumulative milk curve whose x-axis runs from the day's cutoff to the next cutoff (e.g. 3 AM → 3 AM) and whose y-axis is the running total of milk. 💊 dots mark supplements and 💩 dots mark poops. Toggle compares **today vs yesterday** or **today vs the 3/7/14-day average** (days with no feedings are excluded from the average, not counted as zero).
- **Feeding trend** — a 14-day bar chart at the bottom showing today vs yesterday vs 7-day and 14-day averages, with reference lines for the two averages.

### 📊 Insights (visualization)
- **Milk per day** — stacked bars separating breast and formula.
- **Sleep per day** and **Poop per day** trends.
- **Nighttime sleep** — the average time the baby usually falls asleep.
- **Growth chart** — the baby's weight (from the "before" weight of each breast feeding) plotted against the **WHO weight-for-age percentile curves** (3rd/15th/50th/85th/97th) for the baby's sex, with the latest weight's approximate percentile.
- **Range selector** — 7 / 14 / 31 days, or a custom date range.

### 🌐 Language
- Toggle **English / 中文** from the button in the top-right corner. The choice is remembered on the device. All labels, buttons, charts, and dates switch instantly.

### 🔗 Shareable URL
- The current view lives in the URL, so you can copy it and anyone opening it sees exactly the same thing: the **tab** (`timeline`/`insights`), the **date**, the **language** (`en`/`zh`), the **Insights range** (`7`/`14`/`31`/`custom`), and the **Milk-over-the-day compare** (`yesterday`/`3`/`7`/`14`). The URL updates as you navigate, and clicking the 📥 button or switching tabs never loses your place.

### 📥 Import / Export (CSV)
- The **📥** button in the top bar opens an import/export dialog.
- **Export** — download all feedings, sleeps, pee/poop, and supplements as a flat CSV (one row per event, with a `type` column).
- **Template** — download a small template CSV showing one example of each row type. Open it in **Google Sheets**, type your historical rows, export as CSV, then import it here.
- **Import** — upload a CSV. Check **"Replace existing data"** first if you want to wipe feedings/sleeps/pee-poop/supplements before importing. A summary shows how many rows were imported and any rows that were skipped (with the reason).
- Only the columns you need are filled in per row — the layout is designed to be quick to type in a spreadsheet:

  ```
  date,time,type,amount_ml,left_ml,right_ml,before_weight,left_time,right_time,formula_ml,breast_ml,duration_hours,size,watery,supplement
  2026-11-01,08:00,breast,60,29,31,5000,08:07,08:20,,,,,,
  2026-11-01,02:18,bottle,,,,,,,30,0,,,,
  2026-11-01,11:30,sleep,,,,,,,,,2.5,,,
  2026-11-01,14:00,poop,,,,,,,,,,M,2,
  2026-11-01,15:00,pee,,,,,,,,,,,,
  2026-11-01,18:00,supplement,,,,,,,,,,,,Vitamin D
  ```

  - **Date and time are separate columns** so you can copy a date down a column and just fill in each `time`. A blank `time` defaults to noon (12:00). Row order does not matter — each row is an independent event and the app sorts by date/time.
  - `type`: `breast` · `bottle` · `sleep` (`time` = end time, `duration_hours`) · `pee` · `poop` (`size` S/M/L, `watery` 1/2/3) · `supplement` (name)
  - **Breast** — fill `left_ml` + `right_ml` + `before_weight` to preserve the full per-breast split and the growth-chart "before" weight (`amount_ml` = the total). Optional `left_time` / `right_time` (HH:MM) record when each side's weight was taken, so the app can show how long each breast took. Or just fill `amount_ml` for a quick total-only entry (attributed to the left breast), or leave it empty for a "before weight only" entry you can complete later.
  - **Bottle** — `formula_ml` and/or `breast_ml` (breast milk given by bottle); `amount_ml` is used as the formula amount if `formula_ml` is left empty.
  - Dates accept `YYYY-MM-DD`, `YYYY/MM/DD`, `M/D/YYYY`, `D/M/YYYY`; times accept `HH:MM`, `HH:MM:SS`, `h:MM AM/PM`. An older combined `datetime` column is still accepted on import.
  - Export preserves all of this, so **export → edit in Sheets → import** round-trips without losing the left/right split or weights.

### Entry details
- **First-run setup** — asks for the baby's name, birthday, and sex.
- **Feedings** (with historical backfilling): defaults to the current time, but you can change it and navigate to past days.
  - **Breast (weight method):** enter multiple weights; the first is the "before" weight, each later one is tagged **Left / Right / N/A** and can have an optional **time** (when that weight was taken). The app calculates the amount fed for each breast, and — when times are given — how long each breast took (shown in the timeline, e.g. "L 30 ml (7m) · R 30 ml (13m)"). The "before" weight also feeds the growth chart. You can **save with just a "before" weight** (it shows as "before weight only") and add more weights later by editing the entry.
  - **Bottle:** enter formula milk (ml) and breast milk (ml). Leave a field empty to treat it as zero.
  - Number fields use **direct entry** (no up/down spinner) so you can type amounts quickly.
- **Sleep** — log by *duration + end time* (the default) **or** *start + end time*.
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
| GET/PUT | `/api/baby` | Read / set the baby's name, birthday + sex + global day-cutoff |
| GET/PUT | `/api/day-cutoff` | Read / set the global day-cutoff and per-day overrides |
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
| GET | `/api/milk-curve?date=&compare=` | Cumulative milk over the day + supplement/poop markers (compare: yesterday/3/7/14) |
| GET | `/api/export.csv` | Download all data as a flat CSV |
| GET | `/api/template.csv` | Download a small CSV template (one example row per type) |
| POST | `/api/import?clear=` | Import a CSV body (`clear=true` wipes feedings/sleeps/pee-poop/supplements first) |
| GET | `/api/growth` | Weight points + WHO percentile curves + latest percentile |
