"""Baby Tracker — FastAPI backend.

Serves the JSON API under /api and the built frontend (frontend/dist) for
every other path. Run with:  uvicorn main:app --host 0.0.0.0 --port 8000
"""
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse

import store
from models import (
    Baby,
    DailySummary,
    EliminationCreate,
    FeedingCreate,
    SleepCreate,
    SupplementCreate,
    VitaminD,
    WeightEntry,
)

app = FastAPI(title="Baby Tracker")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).resolve().parent.parent / "frontend" / "dist"


# --------------------------------------------------------------------------- #
# WHO weight-for-age growth curves (0-24 months), in kg.
# Percentiles: p3 ~ -2SD, p15 ~ -1SD, p50 median, p85 ~ +1SD, p97 ~ +2SD.
# Source: WHO 2006 growth standards (approximate monthly values).
# --------------------------------------------------------------------------- #
WHO_CURVES = {
    "male": {
        "ageMonths": list(range(25)),
        "p3": [2.5, 3.4, 4.2, 4.9, 5.5, 6.0, 6.4, 6.8, 7.2, 7.5, 7.9, 8.2, 8.4,
               8.7, 9.0, 9.3, 9.5, 9.8, 10.0, 10.3, 10.5, 10.8, 11.0, 11.3, 11.5],
        "p15": [2.8, 3.8, 4.7, 5.4, 6.0, 6.5, 6.9, 7.3, 7.7, 8.0, 8.3, 8.6, 8.9,
                9.1, 9.4, 9.7, 9.9, 10.2, 10.4, 10.7, 10.9, 11.2, 11.4, 11.7, 11.9],
        "p50": [3.3, 4.5, 5.6, 6.4, 7.0, 7.5, 7.9, 8.3, 8.6, 8.9, 9.2, 9.5, 9.6,
                9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.2],
        "p85": [3.9, 5.1, 6.1, 6.9, 7.5, 8.0, 8.4, 8.8, 9.1, 9.4, 9.7, 10.0, 10.2,
                10.4, 10.7, 10.9, 11.1, 11.3, 11.5, 11.7, 11.9, 12.1, 12.3, 12.5, 12.8],
        "p97": [4.3, 5.5, 6.5, 7.4, 8.0, 8.6, 9.0, 9.4, 9.7, 10.0, 10.3, 10.6, 10.8,
                11.1, 11.3, 11.5, 11.7, 11.9, 12.1, 12.3, 12.5, 12.7, 12.9, 13.1, 13.4],
    },
    "female": {
        "ageMonths": list(range(25)),
        "p3": [2.4, 3.2, 4.0, 4.6, 5.1, 5.5, 5.9, 6.2, 6.6, 6.9, 7.2, 7.4, 7.7,
               7.9, 8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2],
        "p15": [2.7, 3.6, 4.4, 5.0, 5.5, 5.9, 6.3, 6.6, 6.9, 7.2, 7.5, 7.7, 8.0,
                8.2, 8.4, 8.6, 8.8, 9.0, 9.2, 9.4, 9.6, 9.8, 10.0, 10.2, 10.4],
        "p50": [3.2, 4.2, 5.1, 5.8, 6.4, 6.8, 7.2, 7.6, 7.9, 8.2, 8.4, 8.7, 8.9,
                9.1, 9.3, 9.5, 9.7, 9.9, 10.1, 10.3, 10.5, 10.7, 10.9, 11.1, 11.3],
        "p85": [3.7, 4.8, 5.7, 6.4, 7.0, 7.4, 7.8, 8.2, 8.5, 8.8, 9.1, 9.4, 9.6,
                9.8, 10.0, 10.2, 10.4, 10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0],
        "p97": [4.1, 5.3, 6.3, 7.1, 7.7, 8.2, 8.6, 9.0, 9.3, 9.6, 9.9, 10.2, 10.4,
                10.6, 10.8, 11.0, 11.2, 11.4, 11.6, 11.8, 12.0, 12.2, 12.4, 12.6, 12.8],
    },
}


# --------------------------------------------------------------------------- #
# Helpers
# --------------------------------------------------------------------------- #
def date_of(iso: str) -> str:
    return iso[:10]


def day_bounds(date: str):
    start = datetime.fromisoformat(date + "T00:00:00")
    return start, start + timedelta(days=1)


def date_range(start: str, end: str):
    d = datetime.fromisoformat(start + "T00:00:00")
    stop = datetime.fromisoformat(end + "T00:00:00")
    out = []
    while d <= stop:
        out.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return out


def compute_breast(weights):
    """Return (left, right) ml from a sequence of weights.

    Each weight after the first contributes a delta (weight[i] - weight[i-1])
    attributed to that entry's side (left/right). N/A deltas are ignored.
    """
    left = right = 0.0
    prev = None
    for w in weights:
        if prev is not None:
            delta = w.weight - prev
            if delta > 0:
                if w.side == "left":
                    left += delta
                elif w.side == "right":
                    right += delta
        prev = w.weight
    return left, right


def feeding_breast(f):
    """Return (total_breast_ml, left_ml, right_ml) for a feeding record."""
    if f.get("type") == "breast" and f.get("weights"):
        left, right = compute_breast([WeightEntry(**w) for w in f["weights"]])
        return left + right, left, right
    if f.get("type") == "bottle":
        return float(f.get("bottleBreastMl") or 0), 0.0, 0.0
    return 0.0, 0.0, 0.0


def feeding_formula(f):
    if f.get("type") == "bottle":
        return float(f.get("bottleFormulaMl") or 0)
    return 0.0


def feeding_view(f):
    breast, left, right = feeding_breast(f)
    return {
        **f,
        "breastMl": round(breast, 1),
        "leftMl": round(left, 1),
        "rightMl": round(right, 1),
        "formulaMl": round(feeding_formula(f), 1),
    }


def sleep_view(s):
    if s.get("mode") == "start_end":
        st = datetime.fromisoformat(s["startTime"])
        en = datetime.fromisoformat(s["endTime"])
        hours = (en - st).total_seconds() / 3600
        start, end = s["startTime"], s["endTime"]
    else:
        en = datetime.fromisoformat(s["endTime"])
        st = en - timedelta(hours=float(s.get("durationHours") or 0))
        start, end = st.isoformat(), s["endTime"]
        hours = float(s.get("durationHours") or 0)
    return {**s, "start": start, "end": end, "hours": round(hours, 2)}


def sleep_overlap_hours(s, date: str) -> float:
    """Hours of sleep `s` (a sleep_view dict) that fall within calendar day `date`.

    This correctly splits sleep that spans midnight across the two days.
    """
    st = datetime.fromisoformat(s["start"])
    en = datetime.fromisoformat(s["end"])
    dstart, dend = day_bounds(date)
    ov_start = max(st, dstart)
    ov_end = min(en, dend)
    if ov_end > ov_start:
        return (ov_end - ov_start).total_seconds() / 3600
    return 0.0


def validate_sleep(s: SleepCreate):
    if s.mode == "start_end" and not s.startTime:
        raise HTTPException(400, "startTime is required for start_end mode")
    if s.mode == "duration_end" and s.durationHours is None:
        raise HTTPException(400, "durationHours is required for duration_end mode")


def daily_summary(date: str, data: Optional[dict] = None) -> dict:
    if data is None:
        data = store.read()
    breast = formula = 0.0
    for f in data["feedings"]:
        if date_of(f["datetime"]) == date:
            b, _, _ = feeding_breast(f)
            breast += b
            formula += feeding_formula(f)
    sleep_hours = 0.0
    for s in data["sleeps"]:
        sleep_hours += sleep_overlap_hours(sleep_view(s), date)
    pee = sum(1 for e in data["eliminations"] if e["type"] == "pee" and date_of(e["datetime"]) == date)
    poop = sum(1 for e in data["eliminations"] if e["type"] == "poop" and date_of(e["datetime"]) == date)
    supps = sorted({s["name"] for s in data["supplements"] if date_of(s["datetime"]) == date})
    total = breast + formula
    return {
        "date": date,
        "breastMl": round(breast, 1),
        "formulaMl": round(formula, 1),
        "totalMl": round(total, 1),
        "sleepHours": round(sleep_hours, 2),
        "peeCount": pee,
        "poopCount": poop,
        "supplements": supps,
        "vitaminD": data["vitaminD"].get(date, {}).get("taken", False),
    }


def compute_bedtime(sleeps, start: str, end: str) -> dict:
    """Average start time (hour-of-day) of nighttime sleeps in [start, end].

    A nighttime sleep starts at/after 18:00 or spans midnight.
    """
    starts = []
    for s in sleeps:
        v = sleep_view(s)
        if not (start <= v["start"][:10] <= end):
            continue
        st = datetime.fromisoformat(v["start"])
        en = datetime.fromisoformat(v["end"])
        start_hour = st.hour + st.minute / 60
        spans_midnight = en.date() > st.date()
        if start_hour >= 18 or spans_midnight:
            starts.append(start_hour)
    if not starts:
        return {"avgStartHour": None, "count": 0}
    return {"avgStartHour": round(sum(starts) / len(starts), 2), "count": len(starts)}


def _interp(arr, age_months: float) -> float:
    if age_months <= 0:
        return arr[0]
    if age_months >= 24:
        return arr[24]
    i = int(age_months)
    frac = age_months - i
    return arr[i] * (1 - frac) + arr[i + 1] * frac


def compute_percentile(weight_kg: float, age_days: float, curves) -> float:
    age_months = age_days / 30.44
    p = [_interp(curves[k], age_months) for k in ("p3", "p15", "p50", "p85", "p97")]
    labels = [3, 15, 50, 85, 97]
    w = weight_kg
    if p[0] <= 0:
        return 50.0
    if w <= p[0]:
        return round(max(0.1, 3 * w / p[0]), 1)
    if w >= p[4]:
        span = max(p[4] - p[3], 0.1)
        return round(min(99.0, 97 + (w - p[4]) / span * (97 - 85)), 1)
    for i in range(4):
        if p[i] <= w <= p[i + 1]:
            frac = (w - p[i]) / (p[i + 1] - p[i])
            return round(labels[i] + frac * (labels[i + 1] - labels[i]), 1)
    return 50.0


# --------------------------------------------------------------------------- #
# Baby profile
# --------------------------------------------------------------------------- #
@app.get("/api/baby")
def get_baby():
    return store.read()["baby"]


@app.put("/api/baby")
def set_baby(baby: Baby):
    store.write(lambda d: d.update({"baby": {"birthday": baby.birthday, "sex": baby.sex}}))
    return store.read()["baby"]


# --------------------------------------------------------------------------- #
# Feedings
# --------------------------------------------------------------------------- #
@app.get("/api/feedings")
def list_feedings(date: Optional[str] = None):
    feedings = store.read()["feedings"]
    if date:
        feedings = [f for f in feedings if date_of(f["datetime"]) == date]
    feedings = sorted(feedings, key=lambda f: f["datetime"])
    return [feeding_view(f) for f in feedings]


@app.post("/api/feedings")
def create_feeding(f: FeedingCreate):
    fid = store.new_id()

    def mut(data):
        rec = f.model_dump()
        rec["id"] = fid
        data["feedings"].append(rec)

    store.write(mut)
    rec = next(x for x in store.read()["feedings"] if x["id"] == fid)
    return feeding_view(rec)


@app.put("/api/feedings/{fid}")
def update_feeding(fid: str, f: FeedingCreate):
    def mut(data):
        for i, x in enumerate(data["feedings"]):
            if x["id"] == fid:
                rec = f.model_dump()
                rec["id"] = fid
                data["feedings"][i] = rec
                return
        raise HTTPException(404, "feeding not found")

    store.write(mut)
    rec = next(x for x in store.read()["feedings"] if x["id"] == fid)
    return feeding_view(rec)


@app.delete("/api/feedings/{fid}")
def delete_feeding(fid: str):
    def mut(data):
        before = len(data["feedings"])
        data["feedings"] = [x for x in data["feedings"] if x["id"] != fid]
        if len(data["feedings"]) == before:
            raise HTTPException(404, "feeding not found")

    store.write(mut)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Sleep
# --------------------------------------------------------------------------- #
@app.get("/api/sleeps")
def list_sleeps(date: Optional[str] = None):
    views = [sleep_view(s) for s in store.read()["sleeps"]]
    if date:
        views = [v for v in views if sleep_overlap_hours(v, date) > 0]
    views = sorted(views, key=lambda v: v["start"])
    return views


@app.post("/api/sleeps")
def create_sleep(s: SleepCreate):
    validate_sleep(s)
    sid = store.new_id()

    def mut(data):
        rec = s.model_dump()
        rec["id"] = sid
        data["sleeps"].append(rec)

    store.write(mut)
    rec = next(x for x in store.read()["sleeps"] if x["id"] == sid)
    return sleep_view(rec)


@app.put("/api/sleeps/{sid}")
def update_sleep(sid: str, s: SleepCreate):
    validate_sleep(s)

    def mut(data):
        for i, x in enumerate(data["sleeps"]):
            if x["id"] == sid:
                rec = s.model_dump()
                rec["id"] = sid
                data["sleeps"][i] = rec
                return
        raise HTTPException(404, "sleep not found")

    store.write(mut)
    rec = next(x for x in store.read()["sleeps"] if x["id"] == sid)
    return sleep_view(rec)


@app.delete("/api/sleeps/{sid}")
def delete_sleep(sid: str):
    def mut(data):
        before = len(data["sleeps"])
        data["sleeps"] = [x for x in data["sleeps"] if x["id"] != sid]
        if len(data["sleeps"]) == before:
            raise HTTPException(404, "sleep not found")

    store.write(mut)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Eliminations (pee / poop)
# --------------------------------------------------------------------------- #
@app.get("/api/eliminations")
def list_eliminations(date: Optional[str] = None):
    elim = store.read()["eliminations"]
    if date:
        elim = [e for e in elim if date_of(e["datetime"]) == date]
    elim = sorted(elim, key=lambda e: e["datetime"])
    return elim


@app.post("/api/eliminations")
def create_elimination(e: EliminationCreate):
    eid = store.new_id()

    def mut(data):
        rec = e.model_dump()
        rec["id"] = eid
        data["eliminations"].append(rec)

    store.write(mut)
    rec = next(x for x in store.read()["eliminations"] if x["id"] == eid)
    return rec


@app.put("/api/eliminations/{eid}")
def update_elimination(eid: str, e: EliminationCreate):
    def mut(data):
        for i, x in enumerate(data["eliminations"]):
            if x["id"] == eid:
                rec = e.model_dump()
                rec["id"] = eid
                data["eliminations"][i] = rec
                return
        raise HTTPException(404, "elimination not found")

    store.write(mut)
    rec = next(x for x in store.read()["eliminations"] if x["id"] == eid)
    return rec


@app.delete("/api/eliminations/{eid}")
def delete_elimination(eid: str):
    def mut(data):
        before = len(data["eliminations"])
        data["eliminations"] = [x for x in data["eliminations"] if x["id"] != eid]
        if len(data["eliminations"]) == before:
            raise HTTPException(404, "elimination not found")

    store.write(mut)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Supplements (vitamin D, probiotic, ...)
# --------------------------------------------------------------------------- #
@app.get("/api/supplements")
def list_supplements(date: Optional[str] = None):
    supps = store.read()["supplements"]
    if date:
        supps = [s for s in supps if date_of(s["datetime"]) == date]
    supps = sorted(supps, key=lambda s: s["datetime"])
    return supps


@app.post("/api/supplements")
def create_supplement(s: SupplementCreate):
    sid = store.new_id()

    def mut(data):
        rec = s.model_dump()
        rec["id"] = sid
        data["supplements"].append(rec)

    store.write(mut)
    rec = next(x for x in store.read()["supplements"] if x["id"] == sid)
    return rec


@app.put("/api/supplements/{sid}")
def update_supplement(sid: str, s: SupplementCreate):
    def mut(data):
        for i, x in enumerate(data["supplements"]):
            if x["id"] == sid:
                rec = s.model_dump()
                rec["id"] = sid
                data["supplements"][i] = rec
                return
        raise HTTPException(404, "supplement not found")

    store.write(mut)
    rec = next(x for x in store.read()["supplements"] if x["id"] == sid)
    return rec


@app.delete("/api/supplements/{sid}")
def delete_supplement(sid: str):
    def mut(data):
        before = len(data["supplements"])
        data["supplements"] = [x for x in data["supplements"] if x["id"] != sid]
        if len(data["supplements"]) == before:
            raise HTTPException(404, "supplement not found")

    store.write(mut)
    return {"ok": True}


# --------------------------------------------------------------------------- #
# Vitamin D (per day) — kept for back-compat
# --------------------------------------------------------------------------- #
@app.get("/api/vitamin")
def get_vitamin(date: str):
    rec = store.read()["vitaminD"].get(date, {"taken": False, "time": None})
    return {"date": date, **rec}


@app.put("/api/vitamin")
def set_vitamin(date: str, v: VitaminD):
    store.write(lambda d: d["vitaminD"].__setitem__(date, {"taken": v.taken, "time": v.time}))
    return {"date": date, "taken": v.taken, "time": v.time}


# --------------------------------------------------------------------------- #
# Daily summary
# --------------------------------------------------------------------------- #
@app.get("/api/daily")
def daily(date: str):
    return DailySummary(**daily_summary(date))


# --------------------------------------------------------------------------- #
# Timeline (all activities for a day, chronological, overnight sleep handled)
# --------------------------------------------------------------------------- #
@app.get("/api/timeline")
def timeline(date: str):
    data = store.read()
    dstart, _ = day_bounds(date)

    feedings = [feeding_view(f) for f in data["feedings"] if date_of(f["datetime"]) == date]
    eliminations = [e for e in data["eliminations"] if date_of(e["datetime"]) == date]
    supplements = [s for s in data["supplements"] if date_of(s["datetime"]) == date]

    sleeps = []
    for s in data["sleeps"]:
        v = sleep_view(s)
        ov = sleep_overlap_hours(v, date)
        if ov > 0:
            st = datetime.fromisoformat(v["start"])
            sleeps.append({**v, "overnight": st < dstart, "dayHours": round(ov, 2)})

    return {
        "date": date,
        "feedings": sorted(feedings, key=lambda f: f["datetime"]),
        "sleeps": sleeps,
        "eliminations": sorted(eliminations, key=lambda e: e["datetime"]),
        "supplements": sorted(supplements, key=lambda s: s["datetime"]),
        "daily": daily_summary(date, data),
    }


# --------------------------------------------------------------------------- #
# Stats (time series for the insights tab)
# --------------------------------------------------------------------------- #
@app.get("/api/stats")
def stats(start: str, end: str):
    if start > end:
        start, end = end, start
    data = store.read()
    milk, sleep, poop, pee = [], [], [], []
    for d in date_range(start, end):
        ds = daily_summary(d, data)
        milk.append({"date": d, "breast": ds["breastMl"], "formula": ds["formulaMl"], "total": ds["totalMl"]})
        sleep.append({"date": d, "hours": ds["sleepHours"]})
        poop.append({"date": d, "count": ds["poopCount"]})
        pee.append({"date": d, "count": ds["peeCount"]})
    return {
        "milk": milk,
        "sleep": sleep,
        "poop": poop,
        "pee": pee,
        "bedtime": compute_bedtime(data["sleeps"], start, end),
    }


# --------------------------------------------------------------------------- #
# Growth (weight measurements + WHO percentile curves)
# --------------------------------------------------------------------------- #
@app.get("/api/growth")
def growth():
    data = store.read()
    baby = data["baby"]
    sex = baby.get("sex")
    birthday = baby.get("birthday")
    if not birthday:
        return {"sex": sex, "birthday": None, "measurements": [], "curves": None, "latest": None}

    b = datetime.fromisoformat(birthday + "T00:00:00")
    measurements = []
    for f in data["feedings"]:
        if f.get("type") == "breast" and f.get("weights"):
            w0 = f["weights"][0].get("weight")
            if w0 and w0 > 0:
                t = datetime.fromisoformat(f["datetime"])
                measurements.append({
                    "datetime": f["datetime"],
                    "date": date_of(f["datetime"]),
                    "weightKg": round(w0 / 1000, 3),
                    "ageDays": round((t - b).total_seconds() / 86400),
                })
    measurements.sort(key=lambda m: m["datetime"])

    curves = WHO_CURVES.get(sex)
    latest = None
    if measurements and curves:
        last = measurements[-1]
        latest = {
            "weightKg": last["weightKg"],
            "ageDays": last["ageDays"],
            "percentile": compute_percentile(last["weightKg"], last["ageDays"], curves),
        }
    return {
        "sex": sex,
        "birthday": birthday,
        "measurements": measurements,
        "curves": curves,
        "latest": latest,
    }


# --------------------------------------------------------------------------- #
# Frontend (built SPA)
# --------------------------------------------------------------------------- #
@app.get("/{path:path}")
def spa(path: str):
    if not FRONTEND_DIST.exists():
        return {
            "message": "Frontend not built yet. Run: cd frontend && npm install && npm run build"
        }
    file = FRONTEND_DIST / (path or "index.html")
    if file.is_file():
        return FileResponse(file)
    return FileResponse(FRONTEND_DIST / "index.html")
