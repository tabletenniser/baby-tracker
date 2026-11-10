"""CSV import/export for the Baby Tracker (Google-Sheets friendly).

One flat row per event, with a `type` column. Only the columns relevant to a
row need to be filled in, so it's quick to type in a spreadsheet:

    datetime,type,amount_ml,left_ml,right_ml,before_weight,formula_ml,breast_ml,duration_hours,size,watery,supplement

type values: breast | bottle | sleep | pee | poop | supplement
  - breast   : amount_ml = total (ml); left_ml / right_ml = per-breast split;
               before_weight = the "before" weight in grams (feeds the growth
               chart). Fill left_ml+right_ml+before_weight to preserve the full
               breakdown; or just amount_ml for a quick total-only entry.
  - bottle   : formula_ml and/or breast_ml (amount_ml is used as formula if set)
  - sleep    : datetime = END time, duration_hours = how long (default 3)
  - pee/poop : size (S/M/L, default M) and watery (1 formed / 2 middle / 3 watery) for poop
  - supplement : supplement = name (e.g. "Vitamin D")
"""
import csv
import io
from datetime import datetime

from main import feeding_breast, sleep_view

HEADER = [
    "datetime",
    "type",
    "amount_ml",
    "left_ml",
    "right_ml",
    "before_weight",
    "formula_ml",
    "breast_ml",
    "duration_hours",
    "size",
    "watery",
    "supplement",
]

VALID_TYPES = {"breast", "bottle", "sleep", "pee", "poop", "supplement"}

_DT_FORMATS = [
    "%Y-%m-%d %H:%M:%S",
    "%Y-%m-%d %H:%M",
    "%Y-%m-%dT%H:%M:%S",
    "%Y-%m-%dT%H:%M",
    "%Y-%m-%d %H:%M %p",
    "%Y-%m-%d %I:%M %p",
    "%Y/%m/%d %H:%M:%S",
    "%Y/%m/%d %H:%M",
    "%m/%d/%Y %H:%M:%S",
    "%m/%d/%Y %H:%M",
    "%m/%d/%Y %I:%M %p",
    "%m/%d/%Y %I:%M",
    "%d/%m/%Y %H:%M:%S",
    "%d/%m/%Y %H:%M",
]


def parse_dt(s: str):
    """Parse a datetime in several common formats. Returns 'YYYY-MM-DDTHH:MM' or None."""
    s = (s or "").strip().replace(",", " ")
    if not s:
        return None
    for fmt in _DT_FORMATS:
        try:
            return datetime.strptime(s, fmt).strftime("%Y-%m-%dT%H:%M")
        except ValueError:
            continue
    return None


def _fmt_dt(iso: str) -> str:
    """'2026-11-09T20:28' -> '2026-11-09 20:28' for readable CSV cells."""
    try:
        return datetime.fromisoformat(iso).strftime("%Y-%m-%d %H:%M")
    except (ValueError, TypeError):
        return iso or ""


def _num(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _before_weight(f) -> float:
    """The 'before' weight (first weight entry) of a breast feeding, or 0."""
    weights = f.get("weights") or []
    return float(weights[0].get("weight") or 0) if weights else 0.0


def export_csv(data: dict) -> str:
    """Serialize all records to CSV (same layout as the import template)."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER)

    feedings = sorted(data.get("feedings", []), key=lambda f: f.get("datetime", ""))
    for f in feedings:
        if f.get("type") == "breast":
            breast, left, right = feeding_breast(f)
            before = _before_weight(f)
            w.writerow([
                _fmt_dt(f.get("datetime", "")),
                "breast",
                round(breast, 1),  # amount_ml (total)
                round(left, 1),    # left_ml
                round(right, 1),   # right_ml
                before,            # before_weight
                "", "", "", "", "", "",
            ])
        else:
            w.writerow([
                _fmt_dt(f.get("datetime", "")),
                "bottle",
                "",                                    # amount_ml
                "", "", "",                            # left_ml, right_ml, before_weight
                round(_num(f.get("bottleFormulaMl")), 1),  # formula_ml
                round(_num(f.get("bottleBreastMl")), 1),   # breast_ml (in bottle)
                "", "", "", "",
            ])

    for s in sorted(data.get("sleeps", []), key=lambda s: s.get("endTime", "")):
        view = sleep_view(s)
        w.writerow([_fmt_dt(view["end"]), "sleep", "", "", "", "", "", "", round(view["hours"], 2), "", "", ""])

    for e in sorted(data.get("eliminations", []), key=lambda e: e.get("datetime", "")):
        if e.get("type") == "poop":
            w.writerow([_fmt_dt(e.get("datetime", "")), "poop", "", "", "", "", "", "", "", e.get("size", "M"), e.get("watery", 2), ""])
        else:
            w.writerow([_fmt_dt(e.get("datetime", "")), "pee", "", "", "", "", "", "", "", "", "", ""])

    for s in sorted(data.get("supplements", []), key=lambda s: s.get("datetime", "")):
        w.writerow([_fmt_dt(s.get("datetime", "")), "supplement", "", "", "", "", "", "", "", "", "", s.get("name", "")])

    return buf.getvalue()


def template_csv() -> str:
    """A small template with the header plus one example of each row type."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER)
    # breast: total 60 = left 29 + right 31, before weight 5000g
    w.writerow(["2026-11-01 08:00", "breast", "60", "29", "31", "5000", "", "", "", "", "", ""])
    # bottle: 30ml formula
    w.writerow(["2026-11-01 02:18", "bottle", "", "", "", "", "30", "0", "", "", "", ""])
    w.writerow(["2026-11-01 11:30", "sleep", "", "", "", "", "", "", "2.5", "", "", ""])
    w.writerow(["2026-11-01 14:00", "poop", "", "", "", "", "", "", "", "M", "2", ""])
    w.writerow(["2026-11-01 15:00", "pee", "", "", "", "", "", "", "", "", "", ""])
    w.writerow(["2026-11-01 18:00", "supplement", "", "", "", "", "", "", "", "", "", "Vitamin D"])
    return buf.getvalue()


def _breast_weights(before: float, left: float, right: float, amount: float):
    """Build a weights[] list for a breast feeding from CSV columns.

    Prefers the full breakdown (before + left + right) so the per-breast split
    and the growth-chart 'before' weight are preserved; falls back to a
    total-only entry (attributed to the left breast) or a before-only entry.
    """
    if left > 0 or right > 0:
        weights = [{"weight": before, "side": "na"}]
        if left > 0:
            weights.append({"weight": before + left, "side": "left"})
        if right > 0:
            weights.append({"weight": before + left + right, "side": "right"})
        return weights
    if amount > 0:
        base = before if before > 0 else 0
        return [{"weight": base, "side": "na"}, {"weight": base + amount, "side": "left"}]
    # before-only feeding (0 ml) — editable later
    return [{"weight": before if before > 0 else 0, "side": "na"}]


def import_csv(text: str, clear: bool = False):
    """Parse CSV text and return records to add.

    Returns (records, summary) where records is a list of (kind, payload) tuples
    ready to append, and summary is {imported: {...}, skipped: N, errors: [...]}.
    The caller applies `records` inside a single store.write().
    """
    reader = csv.DictReader(io.StringIO(text))
    records = []
    imported = {"feedings": 0, "sleeps": 0, "eliminations": 0, "supplements": 0}
    errors = []
    skipped = 0

    for i, row in enumerate(reader, start=2):  # line 1 is the header
        raw_type = (row.get("type") or "").strip().lower()
        dt = parse_dt(row.get("datetime") or "")
        if not dt:
            errors.append(f"line {i}: missing/invalid datetime")
            skipped += 1
            continue
        if raw_type not in VALID_TYPES:
            errors.append(f"line {i}: unknown type '{raw_type or '(blank)'}'")
            skipped += 1
            continue

        if raw_type == "breast":
            before = _num(row.get("before_weight"))
            left = _num(row.get("left_ml"))
            right = _num(row.get("right_ml"))
            amount = _num(row.get("amount_ml"))
            records.append(("feedings", {
                "datetime": dt, "type": "breast",
                "weights": _breast_weights(before, left, right, amount),
            }))
            imported["feedings"] += 1
        elif raw_type == "bottle":
            formula = _num(row.get("formula_ml"))
            if formula == 0:
                formula = _num(row.get("amount_ml"))
            breast = _num(row.get("breast_ml"))
            records.append(("feedings", {
                "datetime": dt, "type": "bottle",
                "bottleFormulaMl": formula, "bottleBreastMl": breast,
            }))
            imported["feedings"] += 1
        elif raw_type == "sleep":
            duration = _num(row.get("duration_hours"), default=3.0)
            records.append(("sleeps", {
                "mode": "duration_end", "endTime": dt, "durationHours": duration,
            }))
            imported["sleeps"] += 1
        elif raw_type in ("pee", "poop"):
            rec = {"datetime": dt, "type": raw_type}
            if raw_type == "poop":
                size = (row.get("size") or "M").strip().upper()
                rec["size"] = size if size in ("S", "M", "L") else "M"
                try:
                    watery = int(_num(row.get("watery"), default=2))
                    rec["watery"] = watery if watery in (1, 2, 3) else 2
                except (TypeError, ValueError):
                    rec["watery"] = 2
            records.append(("eliminations", rec))
            imported["eliminations"] += 1
        elif raw_type == "supplement":
            name = (row.get("supplement") or "").strip()
            if not name:
                errors.append(f"line {i}: supplement needs a name")
                skipped += 1
                continue
            records.append(("supplements", {"name": name, "datetime": dt}))
            imported["supplements"] += 1

    summary = {"imported": imported, "skipped": skipped, "errors": errors, "clear": clear}
    return records, summary
