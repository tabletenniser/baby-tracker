"""Baby Tracker — FastAPI backend.

Serves the JSON API under /api and the built frontend (frontend/dist) for
every other path. Run with:  uvicorn main:app --host 0.0.0.0 --port 8000
"""
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Optional

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel

import store
from models import (
    Baby,
    DailySummary,
    DayCutoffSet,
    EliminationCreate,
    FeedingCreate,
    PoopSize,
    ShowerCreate,
    SleepCreate,
    SupplementCreate,
    VitaminD,
    WateryLevel,
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


def day_bounds(date: str, cutoff: str = "00:00"):
    h, m = (int(x) for x in cutoff.split(":"))
    start = datetime.fromisoformat(date + "T00:00:00") + timedelta(hours=h, minutes=m)
    return start, start + timedelta(days=1)


def cutoff_for(date: str, data: dict) -> str:
    """The day-start cutoff for `date`: per-day override, else the global default."""
    return (
        data.get("dayCutoffOverrides", {}).get(date)
        or data["baby"].get("dayCutoff")
        or "00:00"
    )


def day_for(iso: str, data: dict) -> str:
    """The cutoff-aware calendar date a record at `iso` belongs to.

    A day D spans [D + cutoff, D+1 + cutoff). A record before that day's
    cutoff (e.g. 1am with a 3am cutoff) belongs to the previous day.
    """
    dt = datetime.fromisoformat(iso)
    d0 = dt.date().isoformat()
    def in_window(d: str) -> bool:
        st, en = day_bounds(d, cutoff_for(d, data))
        return st <= dt < en
    if in_window(d0):
        return d0
    prev = (dt.date() - timedelta(days=1)).isoformat()
    return prev if in_window(prev) else d0


def date_range(start: str, end: str):
    d = datetime.fromisoformat(start + "T00:00:00")
    stop = datetime.fromisoformat(end + "T00:00:00")
    out = []
    while d <= stop:
        out.append(d.strftime("%Y-%m-%d"))
        d += timedelta(days=1)
    return out


def compute_breast(weights):
    """Return (left, right, total) ml from a sequence of weights.

    Each weight after the first contributes a delta (weight[i] - weight[i-1]).
    `total` is the sum of all positive deltas; `left`/`right` only count deltas
    whose entry side is left/right. N/A deltas count toward total only, so a
    total-only feeding (unknown split) doesn't skew the left/right balance.
    """
    left = right = total = 0.0
    prev = None
    for w in weights:
        if prev is not None:
            delta = w.weight - prev
            if delta > 0:
                total += delta
                if w.side == "left":
                    left += delta
                elif w.side == "right":
                    right += delta
        prev = w.weight
    return left, right, total


def feeding_breast(f):
    """Return (total_breast_ml, left_ml, right_ml) for a feeding record."""
    if f.get("type") == "breast" and f.get("weights"):
        left, right, total = compute_breast([WeightEntry(**w) for w in f["weights"]])
        return total, left, right
    if f.get("type") == "bottle":
        return float(f.get("bottleBreastMl") or 0), 0.0, 0.0
    return 0.0, 0.0, 0.0


def feeding_formula(f):
    if f.get("type") == "bottle":
        return float(f.get("bottleFormulaMl") or 0)
    return 0.0


def build_breast_weights(before, left, right, amount, left_time="", right_time=""):
    """Build a weights[] list for a breast feeding from (before, left, right, total).

    Prefers the full breakdown (before + left + right) so the per-breast split
    and the growth-chart 'before' weight are preserved; falls back to a
    total-only entry (unknown split, recorded as N/A so it doesn't skew the
    left/right balance) or a before-only entry (0 ml, editable later).
    Optional left_time/right_time (HH:MM) are attached to the matching entries
    so per-breast durations survive a round-trip.
    """
    before = float(before or 0)
    left = float(left or 0)
    right = float(right or 0)
    amount = float(amount or 0)
    if left > 0 or right > 0:
        weights = [{"weight": before, "side": "na"}]
        if left > 0:
            entry = {"weight": before + left, "side": "left"}
            if left_time:
                entry["time"] = left_time
            weights.append(entry)
        if right > 0:
            entry = {"weight": before + left + right, "side": "right"}
            if right_time:
                entry["time"] = right_time
            weights.append(entry)
        return weights
    if amount > 0:
        base = before if before > 0 else 0
        entry = {"weight": base + amount, "side": "na"}
        if left_time:
            entry["time"] = left_time
        return [{"weight": base, "side": "na"}, entry]
    # before-only feeding (0 ml) — editable later
    return [{"weight": before if before > 0 else 0, "side": "na"}]


def _weight_time_dt(start: datetime, hhmm: str):
    """Combine the feeding's date with a weight's HH:MM time.

    Returns a datetime on the feeding's day; if it lands before the start
    (the feeding crossed midnight) it rolls to the next day. None if unparseable.
    """
    try:
        h, m = hhmm.split(":")
        dt = start.replace(hour=int(h), minute=int(m), second=0, microsecond=0)
        if dt < start:
            dt += timedelta(days=1)
        return dt
    except (ValueError, AttributeError):
        return None


def compute_breast_minutes(weights, start_iso: str):
    """Return (left_minutes, right_minutes) from weight timestamps.

    Each weight that carries a time contributes the gap since the previous
    timestamped point (starting from the feeding start), attributed to that
    weight's side — mirroring how compute_breast attributes milk deltas.
    """
    try:
        start = datetime.fromisoformat(start_iso)
    except (ValueError, TypeError):
        return 0, 0
    left = right = 0.0
    prev = start
    for w in weights:
        if not w.time:
            continue
        dt = _weight_time_dt(start, w.time)
        if dt is None:
            continue
        gap = (dt - prev).total_seconds() / 60.0
        if gap > 0:
            if w.side == "left":
                left += gap
            elif w.side == "right":
                right += gap
        prev = dt
    return round(left), round(right)


def feeding_view(f):
    breast, left, right = feeding_breast(f)
    view = {
        **f,
        "breastMl": round(breast, 1),
        "leftMl": round(left, 1),
        "rightMl": round(right, 1),
        "formulaMl": round(feeding_formula(f), 1),
    }
    if f.get("type") == "breast" and f.get("weights") and f.get("datetime"):
        lm, rm = compute_breast_minutes([WeightEntry(**w) for w in f["weights"]], f["datetime"])
        view["leftMinutes"] = lm
        view["rightMinutes"] = rm
    else:
        view["leftMinutes"] = 0
        view["rightMinutes"] = 0
    return view


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


def sleep_overlap_hours(s, date: str, data: dict) -> float:
    """Hours of sleep `s` (a sleep_view dict) that fall within day `date`.

    A "day" runs from the configured cutoff to the next day's cutoff, so a
    night sleep is attributed to the day it started (e.g. a 3am cutoff keeps a
    22:00→03:00 sleep entirely on the first day).
    """
    st = datetime.fromisoformat(s["start"])
    en = datetime.fromisoformat(s["end"])
    dstart, dend = day_bounds(date, cutoff_for(date, data))
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
    breast = formula = left = right = 0.0
    for f in data["feedings"]:
        if day_for(f["datetime"], data) == date:
            b, l, r = feeding_breast(f)
            breast += b
            left += l
            right += r
            formula += feeding_formula(f)
    sleep_hours = 0.0
    for s in data["sleeps"]:
        sleep_hours += sleep_overlap_hours(sleep_view(s), date, data)
    pee = sum(1 for e in data["eliminations"] if e["type"] == "pee" and day_for(e["datetime"], data) == date)
    poop = sum(1 for e in data["eliminations"] if e["type"] == "poop" and day_for(e["datetime"], data) == date)
    shower = sum(1 for s in data.get("showers", []) if day_for(s["datetime"], data) == date)
    supps = sorted({s["name"] for s in data["supplements"] if day_for(s["datetime"], data) == date})
    total = breast + formula
    return {
        "date": date,
        "breastMl": round(breast, 1),
        "leftMl": round(left, 1),
        "rightMl": round(right, 1),
        "formulaMl": round(formula, 1),
        "totalMl": round(total, 1),
        "sleepHours": round(sleep_hours, 2),
        "peeCount": pee,
        "poopCount": poop,
        "showerCount": shower,
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
    store.write(lambda d: d.update({"baby": {
        "birthday": baby.birthday,
        "sex": baby.sex,
        "name": baby.name,
        "dayCutoff": baby.dayCutoff or "00:00",
    }}))
    return store.read()["baby"]


# --------------------------------------------------------------------------- #
# Day cutoff (when the "day" starts, for sleep attribution)
# --------------------------------------------------------------------------- #
@app.get("/api/day-cutoff")
def get_day_cutoff():
    data = store.read()
    return {
        "global": data["baby"].get("dayCutoff") or "00:00",
        "overrides": data.get("dayCutoffOverrides", {}),
    }


@app.put("/api/day-cutoff")
def set_day_cutoff(body: DayCutoffSet):
    def mut(data):
        if body.globalCutoff is not None:
            data["baby"]["dayCutoff"] = body.globalCutoff
        if body.date is not None:
            if body.cutoff:
                data["dayCutoffOverrides"][body.date] = body.cutoff
            else:
                data["dayCutoffOverrides"].pop(body.date, None)

    store.write(mut)
    return get_day_cutoff()


# --------------------------------------------------------------------------- #
# Feedings
# --------------------------------------------------------------------------- #
@app.get("/api/feedings")
def list_feedings(date: Optional[str] = None):
    data = store.read()
    feedings = data["feedings"]
    if date:
        feedings = [f for f in feedings if day_for(f["datetime"], data) == date]
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
    data = store.read()
    views = [sleep_view(s) for s in data["sleeps"]]
    if date:
        views = [v for v in views if sleep_overlap_hours(v, date, data) > 0]
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
    data = store.read()
    elim = data["eliminations"]
    if date:
        elim = [e for e in elim if day_for(e["datetime"], data) == date]
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
    data = store.read()
    supps = data["supplements"]
    if date:
        supps = [s for s in supps if day_for(s["datetime"], data) == date]
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
# Showers
# --------------------------------------------------------------------------- #
@app.get("/api/showers")
def list_showers(date: Optional[str] = None):
    data = store.read()
    showers = data.get("showers", [])
    if date:
        showers = [s for s in showers if day_for(s["datetime"], data) == date]
    showers = sorted(showers, key=lambda s: s["datetime"])
    return showers


@app.post("/api/showers")
def create_shower(s: ShowerCreate):
    shid = store.new_id()

    def mut(data):
        rec = s.model_dump()
        rec["id"] = shid
        data["showers"].append(rec)

    store.write(mut)
    rec = next(x for x in store.read()["showers"] if x["id"] == shid)
    return rec


@app.put("/api/showers/{shid}")
def update_shower(shid: str, s: ShowerCreate):
    def mut(data):
        for i, x in enumerate(data["showers"]):
            if x["id"] == shid:
                rec = s.model_dump()
                rec["id"] = shid
                data["showers"][i] = rec
                return
        raise HTTPException(404, "shower not found")

    store.write(mut)
    rec = next(x for x in store.read()["showers"] if x["id"] == shid)
    return rec


@app.delete("/api/showers/{shid}")
def delete_shower(shid: str):
    def mut(data):
        before = len(data["showers"])
        data["showers"] = [x for x in data["showers"] if x["id"] != shid]
        if len(data["showers"]) == before:
            raise HTTPException(404, "shower not found")

    store.write(mut)
    return {"ok": True}


class LogRequest(BaseModel):
    """Log several events at one timestamp in a single request."""
    datetime: str  # local ISO, e.g. 2026-11-01T07:00
    # breast feeding (any of these present -> a breast feeding is logged)
    breastMl: Optional[float] = None  # total (when the split is unknown)
    leftMl: Optional[float] = None
    rightMl: Optional[float] = None
    beforeWeight: Optional[float] = None
    leftTime: Optional[str] = None
    rightTime: Optional[str] = None
    # bottle feeding
    formulaMl: Optional[float] = None
    bottleBreastMl: Optional[float] = None
    # sleep (a nap of this many hours ending at `datetime`)
    sleepHours: Optional[float] = None
    # pee / poop
    pee: bool = False
    poop: bool = False
    poopSize: Optional[PoopSize] = "M"
    poopWatery: Optional[WateryLevel] = 2
    # shower
    shower: bool = False
    # supplements (names)
    supplements: Optional[List[str]] = None


@app.post("/api/log")
def log_events(req: LogRequest):
    """Create every event present in the request, all at `req.datetime`.

    Returns the ids of the records created, grouped by kind.
    """
    created = {"feedings": [], "sleeps": [], "eliminations": [], "supplements": [], "showers": []}

    def mut(data):
        dt = req.datetime
        # breast feeding
        if req.breastMl or req.leftMl or req.rightMl or req.beforeWeight:
            fid = store.new_id()
            weights = build_breast_weights(
                req.beforeWeight, req.leftMl, req.rightMl, req.breastMl,
                req.leftTime or "", req.rightTime or "",
            )
            data["feedings"].append({"id": fid, "datetime": dt, "type": "breast", "weights": weights})
            created["feedings"].append(fid)
        # bottle feeding
        if req.formulaMl or req.bottleBreastMl:
            fid = store.new_id()
            data["feedings"].append({
                "id": fid, "datetime": dt, "type": "bottle",
                "bottleFormulaMl": req.formulaMl or 0, "bottleBreastMl": req.bottleBreastMl or 0,
            })
            created["feedings"].append(fid)
        # sleep
        if req.sleepHours:
            sid = store.new_id()
            data["sleeps"].append({
                "id": sid, "mode": "duration_end", "endTime": dt, "durationHours": req.sleepHours,
            })
            created["sleeps"].append(sid)
        # pee
        if req.pee:
            eid = store.new_id()
            data["eliminations"].append({"id": eid, "datetime": dt, "type": "pee"})
            created["eliminations"].append(eid)
        # poop
        if req.poop:
            eid = store.new_id()
            data["eliminations"].append({
                "id": eid, "datetime": dt, "type": "poop",
                "size": req.poopSize, "watery": req.poopWatery,
            })
            created["eliminations"].append(eid)
        # shower
        if req.shower:
            shid = store.new_id()
            data["showers"].append({"id": shid, "datetime": dt})
            created["showers"].append(shid)
        # supplements
        for name in (req.supplements or []):
            name = (name or "").strip()
            if not name:
                continue
            sid = store.new_id()
            data["supplements"].append({"id": sid, "datetime": dt, "name": name})
            created["supplements"].append(sid)

    store.write(mut)
    return {"ok": True, "created": created}


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
    cutoff = cutoff_for(date, data)
    dstart, _ = day_bounds(date, cutoff)

    feedings = [feeding_view(f) for f in data["feedings"] if day_for(f["datetime"], data) == date]
    eliminations = [e for e in data["eliminations"] if day_for(e["datetime"], data) == date]
    supplements = [s for s in data["supplements"] if day_for(s["datetime"], data) == date]
    showers = [s for s in data.get("showers", []) if day_for(s["datetime"], data) == date]

    sleeps = []
    for s in data["sleeps"]:
        v = sleep_view(s)
        ov = sleep_overlap_hours(v, date, data)
        if ov > 0:
            st = datetime.fromisoformat(v["start"])
            sleeps.append({**v, "overnight": st < dstart, "dayHours": round(ov, 2)})

    return {
        "date": date,
        "feedings": sorted(feedings, key=lambda f: f["datetime"]),
        "sleeps": sleeps,
        "eliminations": sorted(eliminations, key=lambda e: e["datetime"]),
        "supplements": sorted(supplements, key=lambda s: s["datetime"]),
        "showers": sorted(showers, key=lambda s: s["datetime"]),
        "daily": daily_summary(date, data),
        "cutoff": cutoff,
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
        milk.append({"date": d, "breast": ds["breastMl"], "formula": ds["formulaMl"], "total": ds["totalMl"], "left": ds["leftMl"], "right": ds["rightMl"]})
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
# Milk curve (cumulative milk over the day, for the timeline)
# --------------------------------------------------------------------------- #
_GRID = [i * 0.5 for i in range(49)]  # 0..24 hours in 30-min steps


def _add_days(date: str, n: int) -> str:
    return (datetime.fromisoformat(date + "T00:00:00") + timedelta(days=n)).strftime("%Y-%m-%d")


def _day_feedings_offsets(date: str, data: dict, cutoff: str):
    """Sorted (offset_hours, total_ml) for feedings attributed to `date` (cutoff-aware).

    Attribution uses day_for (same as the rest of the app) so per-day overrides
    stay consistent; the offset is measured from this day's cutoff.
    """
    st, _ = day_bounds(date, cutoff)
    out = []
    for f in data["feedings"]:
        if day_for(f["datetime"], data) != date:
            continue
        dt = datetime.fromisoformat(f["datetime"])
        breast, _, _ = feeding_breast(f)
        total = breast + feeding_formula(f)
        out.append(((dt - st).total_seconds() / 3600.0, total))
    out.sort()
    return out


def _cumulative_curve(offsets):
    """Cumulative ml at each grid point for a day's feeding offsets."""
    return [
        {"t": t, "ml": round(sum(ml for off, ml in offsets if off <= t), 1)}
        for t in _GRID
    ]


@app.get("/api/milk-curve")
def milk_curve(date: str, compare: str = "yesterday"):
    data = store.read()
    cutoff = cutoff_for(date, data)
    today_curve = _cumulative_curve(_day_feedings_offsets(date, data, cutoff))

    compare_curve = None
    compare_days = 0
    if compare == "yesterday":
        prev = _add_days(date, -1)
        compare_curve = _cumulative_curve(_day_feedings_offsets(prev, data, cutoff_for(prev, data)))
        compare_days = 1
    else:
        try:
            n = int(compare)
        except (TypeError, ValueError):
            n = 7
        curves = []
        for i in range(1, n + 1):
            d = _add_days(date, -i)
            offs = _day_feedings_offsets(d, data, cutoff_for(d, data))
            if not offs:
                continue  # no feedings that day -> exclude from the average
            curves.append(_cumulative_curve(offs))
        if curves:
            compare_curve = [
                {"t": curves[0][i]["t"], "ml": round(sum(c[i]["ml"] for c in curves) / len(curves), 1)}
                for i in range(len(curves[0]))
            ]
            compare_days = len(curves)

    # events (supplements + poops) on the selected day, with cumulative ml at that time
    st, _ = day_bounds(date, cutoff)
    offsets = _day_feedings_offsets(date, data, cutoff)
    events = []
    for s in data["supplements"]:
        if day_for(s["datetime"], data) != date:
            continue
        dt = datetime.fromisoformat(s["datetime"])
        off = (dt - st).total_seconds() / 3600.0
        ml = sum(m for o, m in offsets if o <= off)
        events.append({"t": round(off, 3), "ml": round(ml, 1), "type": "supplement"})
    for e in data["eliminations"]:
        if e.get("type") != "poop" or day_for(e["datetime"], data) != date:
            continue
        dt = datetime.fromisoformat(e["datetime"])
        off = (dt - st).total_seconds() / 3600.0
        ml = sum(m for o, m in offsets if o <= off)
        events.append({"t": round(off, 3), "ml": round(ml, 1), "type": "poop"})

    return {
        "cutoff": cutoff,
        "today": today_curve,
        "compare": compare_curve,
        "compareDays": compare_days,
        "events": events,
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
    if curves:
        for m in measurements:
            m["percentile"] = compute_percentile(m["weightKg"], m["ageDays"], curves)
    latest = None
    if measurements and curves:
        last = measurements[-1]
        latest = {
            "weightKg": last["weightKg"],
            "ageDays": last["ageDays"],
            "percentile": last["percentile"],
        }
    return {
        "sex": sex,
        "birthday": birthday,
        "measurements": measurements,
        "curves": curves,
        "latest": latest,
    }


# --------------------------------------------------------------------------- #
# CSV import / export (Google-Sheets friendly)
# --------------------------------------------------------------------------- #
@app.get("/api/export.csv")
def export_csv_endpoint():
    import csvio  # lazy: csvio imports helpers from this module

    data = store.read()
    return Response(
        content=csvio.export_csv(data),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=baby-tracker.csv"},
    )


@app.get("/api/template.csv")
def template_csv_endpoint():
    import csvio

    return Response(
        content=csvio.template_csv(),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=baby-tracker-template.csv"},
    )


@app.post("/api/import")
async def import_csv_endpoint(request: Request, clear: bool = False):
    import csvio

    body = await request.body()
    text = body.decode("utf-8-sig")  # utf-8-sig strips a BOM from Excel/Sheets
    if not text.strip():
        raise HTTPException(400, "empty file")
    records, summary = csvio.import_csv(text, clear=clear)

    def mut(data):
        if clear:
            data["feedings"] = []
            data["sleeps"] = []
            data["eliminations"] = []
            data["supplements"] = []
            data["showers"] = []
        for kind, payload in records:
            payload["id"] = store.new_id()
            data[kind].append(payload)

    store.write(mut)
    return summary


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
