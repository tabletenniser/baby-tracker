"""Pydantic models for the Baby Tracker API."""
from typing import List, Literal, Optional

from pydantic import BaseModel

Side = Literal["left", "right", "na"]
FeedingType = Literal["breast", "bottle"]
SleepMode = Literal["start_end", "duration_end"]
ElimType = Literal["pee", "poop"]
PoopSize = Literal["S", "M", "L"]
# 3-level watery scale: 1 = formed, 2 = middle, 3 = watery
WateryLevel = Literal[1, 2, 3]


Sex = Literal["male", "female"]


class Baby(BaseModel):
    birthday: Optional[str] = None  # YYYY-MM-DD
    sex: Optional[Sex] = None  # for the growth chart
    name: Optional[str] = None  # shown in the top bar
    dayCutoff: Optional[str] = "00:00"  # HH:MM — when the "day" starts (sleep attribution)


class DayCutoffSet(BaseModel):
    globalCutoff: Optional[str] = None  # HH:MM, sets the default for every day
    date: Optional[str] = None  # YYYY-MM-DD, a specific day to override/clear
    cutoff: Optional[str] = None  # HH:MM, the override time (None clears the override)


class WeightEntry(BaseModel):
    weight: float  # grams
    side: Side = "na"


class FeedingCreate(BaseModel):
    datetime: str  # local ISO, e.g. 2026-11-09T14:30
    type: FeedingType
    weights: Optional[List[WeightEntry]] = None  # breast (weight method)
    bottleFormulaMl: Optional[float] = None  # bottle
    bottleBreastMl: Optional[float] = None  # bottle


class Feeding(FeedingCreate):
    id: str
    breastMl: float = 0.0
    leftMl: float = 0.0
    rightMl: float = 0.0
    formulaMl: float = 0.0


class SleepCreate(BaseModel):
    mode: SleepMode
    endTime: str  # local ISO
    startTime: Optional[str] = None  # for start_end
    durationHours: Optional[float] = None  # for duration_end


class Sleep(SleepCreate):
    id: str
    start: str
    end: str
    hours: float


class EliminationCreate(BaseModel):
    datetime: str
    type: ElimType
    size: Optional[PoopSize] = None  # poop only, default M
    watery: Optional[WateryLevel] = None  # poop only, default 2 (middle)


class Elimination(EliminationCreate):
    id: str
    size: PoopSize = "M"
    watery: WateryLevel = 2


class VitaminD(BaseModel):
    taken: bool
    time: Optional[str] = None  # local ISO


class SupplementCreate(BaseModel):
    name: str  # e.g. "Vitamin D", "Probiotic"
    datetime: str  # local ISO


class Supplement(SupplementCreate):
    id: str


class DailySummary(BaseModel):
    date: str
    breastMl: float
    formulaMl: float
    totalMl: float
    sleepHours: float
    peeCount: int
    poopCount: int
    supplements: List[str]  # names of supplements taken that day
    vitaminD: bool = False  # deprecated, kept for back-compat
