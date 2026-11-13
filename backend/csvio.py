"""CSV import/export for the Baby Tracker (Google-Sheets friendly).

Concise format: NO `type` column. Each row is one timestamp, and you can log
several events in the same row — the event type is inferred from which columns
are filled. Put "YES" in the pee / poop columns to record those.

    date,time,breast_ml,left_ml,right_ml,before_weight,left_time,right_time,formula_ml,bottle_breast_ml,sleep_hours,pee,poop,poop_size,poop_watery,supplement

Columns:
  - breast_ml        : total breast milk (ml). With left_ml+right_ml, total = L+R.
  - left_ml/right_ml : per-breast split (ml).
  - before_weight    : the "before" weight in grams (feeds the growth chart).
  - left_time/right_time : optional HH:MM when each side's weight was taken
                       (so the app shows how long each breast took).
  - formula_ml       : formula in a bottle (ml).
  - bottle_breast_ml : expressed breast milk in a bottle (ml).
  - sleep_hours      : a nap/sleep of this many hours ENDING at the row time.
  - pee / poop       : put YES (or y/1/x) to record a pee / poop at this time.
  - poop_size        : S / M / L (optional, leave blank if not noted).
  - poop_watery      : 1 formed / 2 middle / 3 watery (optional, leave blank if not noted).
  - supplement       : name(s), e.g. "Vitamin D" or "Vitamin D; DHA" (semicolon-separate several).

Example — 7am with a breast feed + bottle + pee + vitamin D in ONE row:
    2026-11-01,07:00,60,29,31,5000,,,30,0,,YES,,,Vitamin D

Import still accepts the OLD format (with a `type` column, one event per row)
for backward compatibility.
"""
import csv
import io
import re
from datetime import datetime, date, time

from main import feeding_breast, sleep_view, build_breast_weights

HEADER = [
    "date",
    "time",
    "breast_ml",
    "left_ml",
    "right_ml",
    "before_weight",
    "left_time",
    "right_time",
    "formula_ml",
    "bottle_breast_ml",
    "sleep_hours",
    "pee",
    "poop",
    "poop_size",
    "poop_watery",
    "supplement",
]

# Old-format columns (still accepted on import for backward compatibility).
_OLD_HEADER = [
    "date", "time", "type", "amount_ml", "left_ml", "right_ml", "before_weight",
    "left_time", "right_time", "formula_ml", "breast_ml", "duration_hours",
    "size", "watery", "supplement",
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


def _split_dt(iso: str):
    """'2026-11-09T20:28' -> ('2026-11-09', '20:28') for two CSV columns."""
    try:
        dt = datetime.fromisoformat(iso)
        return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
    except (ValueError, TypeError):
        return (iso or ""), ""


_DATE_FORMATS = ["%Y-%m-%d", "%Y/%m/%d", "%m/%d/%Y", "%d/%m/%Y"]
_TIME_FORMATS = ["%H:%M:%S", "%H:%M", "%I:%M:%S %p", "%I:%M %p", "%I:%M", "%H"]


def parse_date(s: str):
    """Parse a date in several common formats. Returns a date, or None."""
    s = (s or "").strip()
    if not s:
        return None
    for fmt in _DATE_FORMATS:
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            continue
    return None


def parse_time(s: str):
    """Parse a time in several common formats. Returns a time, or None."""
    s = (s or "").strip()
    if not s:
        return None
    for fmt in _TIME_FORMATS:
        try:
            return datetime.strptime(s, fmt).time()
        except ValueError:
            continue
    return None


def _row_datetime(row) -> str:
    """Combine a row's date/time into 'YYYY-MM-DDTHH:MM'.

    Supports the split columns (date + time) and the old combined column
    (datetime) for backward compatibility. A blank time defaults to noon
    (12:00) so bulk rows still import.
    """
    combined = (row.get("datetime") or "").strip()
    if combined:
        return parse_dt(combined)
    d = parse_date(row.get("date") or "")
    if not d:
        return None
    t = parse_time(row.get("time") or "")
    if t is None:
        t = time(12, 0)
    return datetime(d.year, d.month, d.day, t.hour, t.minute).strftime("%Y-%m-%dT%H:%M")


def _num(v, default=0.0) -> float:
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


def _is_yes(v) -> bool:
    """True if a pee/poop indicator cell means 'yes' (non-empty, not an explicit no)."""
    s = (v or "").strip().lower()
    if not s:
        return False
    return s not in {"no", "n", "0", "false", "-"}


def _before_weight(f) -> float:
    """The 'before' weight (first weight entry) of a breast feeding, or 0."""
    weights = f.get("weights") or []
    return float(weights[0].get("weight") or 0) if weights else 0.0


def _side_time(f, side: str) -> str:
    """The HH:MM time of the last weight entry on `side` (left/right), or ''."""
    t = ""
    for w in f.get("weights") or []:
        if w.get("side") == side and w.get("time"):
            t = w["time"]
    return t


# --------------------------------------------------------------------------- #
# Export: one row per timestamp, merging every event that shares that time.   #
# --------------------------------------------------------------------------- #

def _new_group():
    return {
        "breast_ml": 0.0, "left_ml": 0.0, "right_ml": 0.0,
        "before_weight": 0.0, "left_time": "", "right_time": "",
        "formula_ml": 0.0, "bottle_breast_ml": 0.0,
        "sleep_hours": 0.0, "pee": False, "poop": False,
        "poop_size": "", "poop_watery": "", "supplements": [],
    }


def _merge_into_group(g, kind, obj):
    if kind == "feeding":
        if obj.get("type") == "breast":
            breast, left, right = feeding_breast(obj)
            g["breast_ml"] += breast
            g["left_ml"] += left
            g["right_ml"] += right
            bw = _before_weight(obj)
            if bw and not g["before_weight"]:
                g["before_weight"] = bw
            lt = _side_time(obj, "left")
            if lt:
                g["left_time"] = lt
            rt = _side_time(obj, "right")
            if rt:
                g["right_time"] = rt
        else:
            g["formula_ml"] += _num(obj.get("bottleFormulaMl"))
            g["bottle_breast_ml"] += _num(obj.get("bottleBreastMl"))
    elif kind == "sleep":
        g["sleep_hours"] += obj.get("hours", 0)
    elif kind == "elim":
        if obj.get("type") == "poop":
            g["poop"] = True
            g["poop_size"] = obj.get("size") or ""
            g["poop_watery"] = obj.get("watery") or ""
        else:
            g["pee"] = True
    elif kind == "supp":
        name = (obj.get("name") or "").strip()
        if name:
            g["supplements"].append(name)


def _group_row(g, d, t):
    return [
        d, t,
        round(g["breast_ml"], 1) if g["breast_ml"] else "",
        round(g["left_ml"], 1) if g["left_ml"] else "",
        round(g["right_ml"], 1) if g["right_ml"] else "",
        g["before_weight"] if g["before_weight"] else "",
        g["left_time"],
        g["right_time"],
        round(g["formula_ml"], 1) if g["formula_ml"] else "",
        round(g["bottle_breast_ml"], 1) if g["bottle_breast_ml"] else "",
        round(g["sleep_hours"], 2) if g["sleep_hours"] else "",
        "YES" if g["pee"] else "",
        "YES" if g["poop"] else "",
        g["poop_size"] if g["poop"] else "",
        g["poop_watery"] if g["poop"] else "",
        "; ".join(g["supplements"]),
    ]


def export_csv(data: dict) -> str:
    """Serialize all records to CSV. Events sharing a timestamp share one row."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER)

    items = []  # (datetime, kind, obj)
    for f in data.get("feedings", []):
        items.append((f.get("datetime", ""), "feeding", f))
    for s in data.get("sleeps", []):
        view = sleep_view(s)
        items.append((view["end"], "sleep", view))
    for e in data.get("eliminations", []):
        items.append((e.get("datetime", ""), "elim", e))
    for s in data.get("supplements", []):
        items.append((s.get("datetime", ""), "supp", s))
    items.sort(key=lambda x: x[0])

    groups = {}
    order = []
    for dt, kind, obj in items:
        d, t = _split_dt(dt)
        key = (d, t)
        if key not in groups:
            groups[key] = _new_group()
            order.append(key)
        _merge_into_group(groups[key], kind, obj)

    for key in order:
        d, t = key
        w.writerow(_group_row(groups[key], d, t))

    return buf.getvalue()


def template_csv() -> str:
    """A small template: header plus example rows (each row = one timestamp,
    possibly with several events)."""
    buf = io.StringIO()
    w = csv.writer(buf)
    w.writerow(HEADER)
    # 7am: breast 60 (L29/R31, before 5000g) + bottle 30ml formula + pee + vitamin D
    w.writerow(["2026-11-01", "07:00", "60", "29", "31", "5000", "", "", "30", "0", "", "YES", "", "", "", "Vitamin D"])
    # 11:30am: 2.5h sleep
    w.writerow(["2026-11-01", "11:30", "", "", "", "", "", "", "", "", "2.5", "", "", "", "", ""])
    # 2pm: poop, size M, watery 2
    w.writerow(["2026-11-01", "14:00", "", "", "", "", "", "", "", "", "", "", "YES", "M", "2", ""])
    # 3pm: pee only
    w.writerow(["2026-11-01", "15:00", "", "", "", "", "", "", "", "", "", "YES", "", "", "", ""])
    # 6pm: two supplements at one time (semicolon-separated)
    w.writerow(["2026-11-01", "18:00", "", "", "", "", "", "", "", "", "", "", "", "", "", "Vitamin D; DHA"])
    return buf.getvalue()


# --------------------------------------------------------------------------- #
# Import: supports the new concise format and the old `type`-column format.    #
# --------------------------------------------------------------------------- #

class _Import:
    def __init__(self):
        self.records = []
        self.imported = {"feedings": 0, "sleeps": 0, "eliminations": 0, "supplements": 0}
        self.errors = []
        self.skipped = 0

    def add(self, kind, payload):
        self.records.append((kind, payload))
        self.imported[kind] += 1

    def error(self, line, msg):
        self.errors.append(f"line {line}: {msg}")
        self.skipped += 1


def _import_new_row(imp, row, i):
    """One row of the concise format: may contain several events at one time."""
    dt = _row_datetime(row)
    if not dt:
        imp.error(i, "missing/invalid date (need a 'date' column, or 'date'+'time')")
        return

    # breast feeding
    before = _num(row.get("before_weight"))
    left = _num(row.get("left_ml"))
    right = _num(row.get("right_ml"))
    amount = _num(row.get("breast_ml"))
    left_time = (row.get("left_time") or "").strip()
    right_time = (row.get("right_time") or "").strip()
    if amount > 0 or left > 0 or right > 0 or before > 0:
        imp.add("feedings", {
            "datetime": dt, "type": "breast",
            "weights": build_breast_weights(before, left, right, amount, left_time, right_time),
        })

    # bottle feeding
    formula = _num(row.get("formula_ml"))
    bottle_breast = _num(row.get("bottle_breast_ml"))
    if formula > 0 or bottle_breast > 0:
        imp.add("feedings", {
            "datetime": dt, "type": "bottle",
            "bottleFormulaMl": formula, "bottleBreastMl": bottle_breast,
        })

    # sleep
    sleep_hours = _num(row.get("sleep_hours"))
    if sleep_hours > 0:
        imp.add("sleeps", {"mode": "duration_end", "endTime": dt, "durationHours": sleep_hours})

    # pee
    if _is_yes(row.get("pee")):
        imp.add("eliminations", {"datetime": dt, "type": "pee"})

    # poop
    if _is_yes(row.get("poop")):
        size = (row.get("poop_size") or row.get("size") or "").strip().upper()
        rec = {"datetime": dt, "type": "poop"}
        if size in ("S", "M", "L"):
            rec["size"] = size
        watery_raw = row.get("poop_watery") or row.get("watery")
        if watery_raw not in (None, ""):
            try:
                watery = int(_num(watery_raw, default=0))
                if watery in (1, 2, 3):
                    rec["watery"] = watery
            except (TypeError, ValueError):
                pass
        imp.add("eliminations", rec)

    # supplement(s)
    name = (row.get("supplement") or "").strip()
    if name:
        # Semicolon is the preferred separator; comma is also accepted (legacy).
        for part in re.split(r"[;,]", name):
            part = part.strip()
            if part:
                imp.add("supplements", {"name": part, "datetime": dt})


def _import_old_row(imp, row, i):
    """One row of the OLD format (has a `type` column)."""
    raw_type = (row.get("type") or "").strip().lower()
    dt = _row_datetime(row)
    if not dt:
        imp.error(i, "missing/invalid date (need a 'date' column, or 'date'+'time')")
        return
    if raw_type not in VALID_TYPES:
        imp.error(i, f"unknown type '{raw_type or '(blank)'}'")
        return

    if raw_type == "breast":
        before = _num(row.get("before_weight"))
        left = _num(row.get("left_ml"))
        right = _num(row.get("right_ml"))
        amount = _num(row.get("amount_ml"))
        left_time = (row.get("left_time") or "").strip()
        right_time = (row.get("right_time") or "").strip()
        imp.add("feedings", {
            "datetime": dt, "type": "breast",
            "weights": build_breast_weights(before, left, right, amount, left_time, right_time),
        })
    elif raw_type == "bottle":
        formula = _num(row.get("formula_ml"))
        if formula == 0:
            formula = _num(row.get("amount_ml"))
        breast = _num(row.get("breast_ml"))
        imp.add("feedings", {
            "datetime": dt, "type": "bottle",
            "bottleFormulaMl": formula, "bottleBreastMl": breast,
        })
    elif raw_type == "sleep":
        duration = _num(row.get("duration_hours"), default=3.0)
        imp.add("sleeps", {"mode": "duration_end", "endTime": dt, "durationHours": duration})
    elif raw_type in ("pee", "poop"):
        rec = {"datetime": dt, "type": raw_type}
        if raw_type == "poop":
            size = (row.get("size") or "").strip().upper()
            if size in ("S", "M", "L"):
                rec["size"] = size
            if row.get("watery") not in (None, ""):
                try:
                    watery = int(_num(row.get("watery"), default=0))
                    if watery in (1, 2, 3):
                        rec["watery"] = watery
                except (TypeError, ValueError):
                    pass
        imp.add("eliminations", rec)
    elif raw_type == "supplement":
        name = (row.get("supplement") or "").strip()
        if not name:
            imp.error(i, "supplement needs a name")
            return
        imp.add("supplements", {"name": name, "datetime": dt})


def import_csv(text: str, clear: bool = False):
    """Parse CSV text and return records to add.

    Auto-detects the format: if the header has a `type` column it uses the old
    one-event-per-row layout; otherwise it uses the new concise layout where a
    single row can hold several events at one timestamp.

    Returns (records, summary) where records is a list of (kind, payload) tuples
    ready to append, and summary is {imported: {...}, skipped: N, errors: [...]}.
    The caller applies `records` inside a single store.write().
    """
    reader = csv.DictReader(io.StringIO(text))
    fieldnames = [(f or "").strip().lower() for f in (reader.fieldnames or [])]
    has_type = "type" in fieldnames
    imp = _Import()

    for i, row in enumerate(reader, start=2):  # line 1 is the header
        if has_type:
            _import_old_row(imp, row, i)
        else:
            _import_new_row(imp, row, i)

    summary = {"imported": imp.imported, "skipped": imp.skipped, "errors": imp.errors, "clear": clear}
    return imp.records, summary
