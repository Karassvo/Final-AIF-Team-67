"""Pairwise features shared by the fuzzy system, the learners and the
synthetic ground-truth simulator."""

from __future__ import annotations

import numpy as np

from .models import Student

PAIR_FEATURES = [
    "sleep_diff",       # |bedtime_a - bedtime_b|, hours (0..6)
    "clean_diff",       # |cleanliness_a - cleanliness_b| (0..4)
    "noise_conflict",   # how much one's guests exceed the other's tolerance (0..4)
    "social_diff",      # |social_a - social_b| (0..4)
    "same_language",    # 1 if same preferred language
    "interest_sim",     # TF-IDF cosine similarity of "About me" (0..1)
    "smoker_mismatch",  # 1 if exactly one of them smokes
]


def student_arrays(students: list[Student]) -> dict[str, np.ndarray]:
    return {
        "bedtime": np.array([s.bedtime for s in students]),
        "cleanliness": np.array([s.cleanliness for s in students]),
        "noise_tolerance": np.array([s.noise_tolerance for s in students]),
        "guests": np.array([s.guests for s in students]),
        "study_in_room": np.array([s.study_in_room for s in students]),
        "social": np.array([s.social for s in students]),
        "smoker": np.array([s.smoker for s in students], dtype=float),
        "language": np.array([s.language for s in students]),
    }


def _noise_conflict(guests_a, tol_a, study_a, guests_b, tol_b, study_b):
    # A's guests disturb B if they exceed B's tolerance; studying in the room
    # makes one more sensitive.
    a_to_b = guests_a - tol_b + 0.5 * np.maximum(study_b - 3, 0)
    b_to_a = guests_b - tol_a + 0.5 * np.maximum(study_a - 3, 0)
    return np.clip(np.maximum(a_to_b, b_to_a), 0.0, 4.0)


def pairwise_feature_tensors(students: list[Student], interest_sim: np.ndarray) -> dict[str, np.ndarray]:
    """All-pairs feature matrices, each of shape (n, n)."""
    a = student_arrays(students)
    col = lambda k: a[k][:, None]  # noqa: E731
    row = lambda k: a[k][None, :]  # noqa: E731
    return {
        "sleep_diff": np.abs(col("bedtime") - row("bedtime")),
        "clean_diff": np.abs(col("cleanliness") - row("cleanliness")),
        "noise_conflict": _noise_conflict(col("guests"), col("noise_tolerance"), col("study_in_room"),
                                          row("guests"), row("noise_tolerance"), row("study_in_room")),
        "social_diff": np.abs(col("social") - row("social")),
        "same_language": (a["language"][:, None] == a["language"][None, :]).astype(float),
        "interest_sim": interest_sim,
        "smoker_mismatch": (col("smoker") != row("smoker")).astype(float),
    }


def pair_feature_rows(a: list[Student], b: list[Student], interest_sim: np.ndarray) -> np.ndarray:
    """Feature matrix (m, len(PAIR_FEATURES)) for explicit pairs a[i]-b[i]."""
    A, B = student_arrays(a), student_arrays(b)
    cols = [
        np.abs(A["bedtime"] - B["bedtime"]),
        np.abs(A["cleanliness"] - B["cleanliness"]),
        _noise_conflict(A["guests"], A["noise_tolerance"], A["study_in_room"],
                        B["guests"], B["noise_tolerance"], B["study_in_room"]),
        np.abs(A["social"] - B["social"]),
        (A["language"] == B["language"]).astype(float),
        interest_sim,
        (A["smoker"] != B["smoker"]).astype(float),
    ]
    return np.column_stack(cols)
