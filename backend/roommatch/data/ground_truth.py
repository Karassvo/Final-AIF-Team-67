"""Hidden "real world" satisfaction model used ONLY for simulation.

In reality we would not know this function — we would observe ratings
from residents. Here it lets us (a) generate realistic feedback data for the
learning module and (b) measure how satisfied residents would *actually*
be with an assignment, which is impossible with the algorithm's own score.

Design note: the hidden model deliberately disagrees with the hand-written
fuzzy rules (sleep schedule and noise matter far more than cleanliness),
so the learning module has something real to discover.
"""

from __future__ import annotations

import numpy as np

from ..algorithms.text import TfidfModel
from ..features import PAIR_FEATURES, pair_feature_rows
from ..models import Student
from .generator import generate_students

W = {
    "bias": 4.75,
    "sleep_diff": -0.62,
    "clean_diff": -0.10,
    "noise_conflict": -0.55,
    "social_diff": -0.12,
    "same_language": 0.30,
    "interest_sim": 0.75,
    "smoker_mismatch": -0.90,
}


def true_rating_continuous(x: np.ndarray) -> np.ndarray:
    """x: (m, len(PAIR_FEATURES)). Returns expected rating on a 1..5 scale."""
    f = {name: x[:, i] for i, name in enumerate(PAIR_FEATURES)}
    r = (W["bias"]
         + W["sleep_diff"] * f["sleep_diff"] ** 1.15
         + W["clean_diff"] * f["clean_diff"]
         + W["noise_conflict"] * f["noise_conflict"]
         + W["social_diff"] * f["social_diff"]
         + W["same_language"] * f["same_language"]
         + W["interest_sim"] * f["interest_sim"]
         + W["smoker_mismatch"] * f["smoker_mismatch"])
    return np.clip(r, 1.0, 5.0)


def true_satisfaction_matrix(features: dict[str, np.ndarray]) -> np.ndarray:
    """All-pairs true satisfaction 0..100 from pairwise feature tensors."""
    n = features["sleep_diff"].shape[0]
    x = np.stack([features[k].ravel() for k in PAIR_FEATURES], axis=1)
    r = true_rating_continuous(x).reshape(n, n)
    return (r - 1.0) / 4.0 * 100.0


def generate_feedback(n_pairs: int = 700, seed: int = 7) -> dict:
    """Simulate last year's residents: random same-gender roommates who
    rated each other 1..5 after a month together."""
    rng = np.random.default_rng(seed)
    pool = generate_students(n_pairs * 2, seed=seed + 1000, friend_rate=0.0, start_id=100000)
    by_gender: dict[str, list[Student]] = {"F": [], "M": []}
    for s in pool:
        by_gender[s.gender].append(s)
    a, b = [], []
    for g in ("F", "M"):
        lst = by_gender[g]
        idx = rng.permutation(len(lst))
        for i in range(0, len(idx) - 1, 2):
            a.append(lst[idx[i]])
            b.append(lst[idx[i + 1]])
    a, b = a[:n_pairs], b[:n_pairs]
    tfidf = TfidfModel().fit([s.about for s in a + b])
    va, vb = tfidf.transform([s.about for s in a]), tfidf.transform([s.about for s in b])
    interest = np.clip(np.sum(va * vb, axis=1), 0, 1)
    x = pair_feature_rows(a, b, interest)
    expected = true_rating_continuous(x)
    ratings = np.clip(np.round(expected + rng.normal(0, 0.45, len(expected))), 1, 5)
    return {"X": x, "rating": ratings.astype(int), "feature_names": list(PAIR_FEATURES)}

