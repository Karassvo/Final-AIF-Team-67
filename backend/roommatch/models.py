"""Core domain model: students, rooms and the dormitory."""

from __future__ import annotations

from dataclasses import asdict, dataclass, field
from typing import Optional

import numpy as np

# Lifestyle features used by clustering (order matters: it is the column order
# of the feature matrix).
LIFESTYLE_FEATURES: list[str] = [
    "bedtime",        # hour, 21.0 .. 27.0  (27 == 03:00 next day)
    "wake_time",      # hour, 5.0 .. 12.0
    "cleanliness",    # 1 .. 5
    "noise_tolerance",  # 1 .. 5  (5 = "noise doesn't bother me")
    "guests",         # 1 .. 5  (5 = "friends over almost every day")
    "study_in_room",  # 1 .. 5  (5 = "I always study in the room")
    "social",         # 1 .. 5  (1 = introvert, 5 = extrovert)
]

FEATURE_RANGES: dict[str, tuple[float, float]] = {
    "bedtime": (21.0, 27.0),
    "wake_time": (5.0, 12.0),
    "cleanliness": (1.0, 5.0),
    "noise_tolerance": (1.0, 5.0),
    "guests": (1.0, 5.0),
    "study_in_room": (1.0, 5.0),
    "social": (1.0, 5.0),
}

LANGUAGES = ("kk", "ru", "en")
GENDERS = ("F", "M")


@dataclass
class Student:
    id: int
    name: str
    gender: str                 # "F" | "M"
    year: int                   # 1 .. 4
    faculty: str
    bedtime: float
    wake_time: float
    cleanliness: float
    noise_tolerance: float
    guests: float
    study_in_room: float
    social: float
    smoker: bool
    language: str               # "kk" | "ru" | "en"
    about: str = ""
    friend_id: Optional[int] = None   # mutual "I want to live with X" request
    archetype: Optional[str] = None   # ground-truth archetype (synthetic data only)

    def lifestyle_vector(self) -> np.ndarray:
        return np.array([getattr(self, f) for f in LIFESTYLE_FEATURES], dtype=float)

    def to_dict(self) -> dict:
        return asdict(self)

    @staticmethod
    def from_dict(d: dict) -> "Student":
        allowed = {f for f in Student.__dataclass_fields__}
        clean = {k: v for k, v in d.items() if k in allowed}
        smoker = clean.get("smoker", False)
        if isinstance(smoker, str):
            smoker = smoker.strip().lower() in ("1", "true", "yes", "y", "да", "иә")
        clean["smoker"] = bool(smoker)
        if clean.get("friend_id") in ("", None) or (
            isinstance(clean.get("friend_id"), float) and np.isnan(clean["friend_id"])
        ):
            clean["friend_id"] = None
        else:
            clean["friend_id"] = int(clean["friend_id"])
        for f in LIFESTYLE_FEATURES:
            lo, hi = FEATURE_RANGES[f]
            clean[f] = float(np.clip(float(clean[f]), lo, hi))
        clean["id"] = int(clean["id"])
        clean["year"] = int(clean.get("year", 1))
        clean.setdefault("about", "")
        if not isinstance(clean["about"], str):
            clean["about"] = ""
        return Student(**clean)


@dataclass
class Room:
    id: str          # e.g. "3-07"
    floor: int
    number: int
    capacity: int    # 2 .. 4
    gender: str      # floors are single-gender


@dataclass
class Dorm:
    name: str
    rooms: list[Room] = field(default_factory=list)

    @property
    def capacity(self) -> int:
        return sum(r.capacity for r in self.rooms)

    def capacity_for(self, gender: str) -> int:
        return sum(r.capacity for r in self.rooms if r.gender == gender)

    def floors(self) -> list[int]:
        return sorted({r.floor for r in self.rooms})

    def to_dict(self) -> dict:
        return {"name": self.name, "rooms": [asdict(r) for r in self.rooms]}


def build_dorm(n_female: int, n_male: int, slack: float = 0.06,
               rooms_per_floor: int = 12, seed: int = 0) -> Dorm:
    """Create a dormitory with enough single-gender floors for the given
    number of students, leaving roughly ``slack`` spare beds per gender."""
    rng = np.random.default_rng(seed)
    rooms: list[Room] = []
    floor = 1
    for gender, n in (("F", n_female), ("M", n_male)):
        need = int(np.ceil(n * (1 + slack)))
        beds = 0
        while beds < need:
            number = 1
            while number <= rooms_per_floor and beds < need:
                cap = int(rng.choice([2, 3, 3, 4], p=[0.3, 0.25, 0.25, 0.2]))
                rooms.append(Room(id=f"{floor}-{number:02d}", floor=floor,
                                  number=number, capacity=cap, gender=gender))
                beds += cap
                number += 1
            floor += 1
    return Dorm(name="Dormitory №1", rooms=rooms)
