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
# Helpers
# --------------------------------------------------------------------------- #
def date_of(iso: str) -> str:
    return iso[:10]


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


def validate_sleep(s: SleepCreate):
    if s.mode == "start_end" and not s.startTime:
        raise HTTPException(400, "startTime is required for start_end mode")
    if s.mode == "duration_end" and s.durationHours is None:
        raise HTTPException(400, "durationHours is required for duration_end mode")


# --------------------------------------------------------------------------- #
# Baby profile
# --------------------------------------------------------------------------- #
@app.get("/api/baby")
def get_baby():
    return store.read()["baby"]


@app.put("/api/baby")
def set_baby(baby: Baby):
    store.write(lambda d: d.update({"baby": {"birthday": baby.birthday}}))
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
        views = [v for v in views if date_of(v["start"]) == date]
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
# Vitamin D (per day)
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
    data = store.read()
    breast = formula = 0.0
    for f in data["feedings"]:
        if date_of(f["datetime"]) == date:
            b, _, _ = feeding_breast(f)
            breast += b
            formula += feeding_formula(f)
    sleep_hours = 0.0
    for s in data["sleeps"]:
        v = sleep_view(s)
        if date_of(v["start"]) == date:
            sleep_hours += v["hours"]
    pee = sum(1 for e in data["eliminations"] if e["type"] == "pee" and date_of(e["datetime"]) == date)
    poop = sum(1 for e in data["eliminations"] if e["type"] == "poop" and date_of(e["datetime"]) == date)
    vitamin = data["vitaminD"].get(date, {}).get("taken", False)
    return DailySummary(
        date=date,
        breastMl=round(breast, 1),
        formulaMl=round(formula, 1),
        sleepHours=round(sleep_hours, 2),
        peeCount=pee,
        poopCount=poop,
        vitaminD=vitamin,
    )


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
