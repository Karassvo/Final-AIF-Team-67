"""Mamdani fuzzy inference system for roommate compatibility — from scratch.

Inputs (crisp)          Linguistic terms
--------------------    ------------------------
sleep_diff   0..6 h     small / medium / large
clean_diff   0..4       small / medium / large
noise_conflict 0..4     small / medium / large
social_diff  0..4       small / medium / large

Output: compatibility 0..100 with terms very_low / low / medium / high / very_high

Pipeline: fuzzification -> rule evaluation (AND = min, weighted) ->
implication (min / clipping) -> aggregation (max) -> centroid defuzzification.

Every input uses a 3-term Ruspini partition defined by three numbers
(a < m < b): "small" is 1 below a and falls to 0 at m, "medium" is a
triangle (a, m, b) and "large" rises from m to 1 at b. Memberships always
sum to 1. These numbers and the rule weights are the parameters the
genetic algorithm tunes (see ``learning.py``).
"""

from __future__ import annotations

from dataclasses import dataclass, field

import numpy as np

INPUTS: dict[str, float] = {  # name -> universe max
    "sleep_diff": 6.0,
    "clean_diff": 4.0,
    "noise_conflict": 4.0,
    "social_diff": 4.0,
}
TERMS = ("small", "medium", "large")
OUT_TERMS = ("very_low", "low", "medium", "high", "very_high")
OUT_UNIVERSE = np.linspace(0.0, 100.0, 101)

DEFAULT_MF: dict[str, tuple[float, float, float]] = {
    "sleep_diff": (0.5, 1.75, 3.5),
    "clean_diff": (0.5, 1.5, 3.0),
    "noise_conflict": (0.5, 1.5, 3.0),
    "social_diff": (0.5, 1.75, 3.25),
}

# (antecedents {input: term}, consequent). Hand-written by "experts" —
# note the strong (and, as feedback later shows, exaggerated) emphasis on
# cleanliness.
RULES: list[tuple[dict[str, str], str]] = [
    ({"sleep_diff": "small", "clean_diff": "small", "noise_conflict": "small"}, "very_high"),
    ({"sleep_diff": "small", "noise_conflict": "small"}, "high"),
    ({"sleep_diff": "small", "clean_diff": "small"}, "high"),
    ({"sleep_diff": "medium", "clean_diff": "small", "noise_conflict": "small"}, "high"),
    ({"social_diff": "small", "sleep_diff": "small"}, "very_high"),
    ({"sleep_diff": "small", "clean_diff": "medium"}, "medium"),
    ({"sleep_diff": "medium", "clean_diff": "small"}, "medium"),
    ({"sleep_diff": "medium", "clean_diff": "medium"}, "medium"),
    ({"sleep_diff": "large", "clean_diff": "small"}, "low"),
    ({"sleep_diff": "large", "clean_diff": "medium"}, "low"),
    ({"clean_diff": "large"}, "very_low"),
    ({"clean_diff": "medium", "noise_conflict": "medium"}, "low"),
    ({"noise_conflict": "medium", "sleep_diff": "medium"}, "low"),
    ({"noise_conflict": "large"}, "low"),
    ({"social_diff": "large", "noise_conflict": "medium"}, "low"),
    ({"sleep_diff": "large", "noise_conflict": "large"}, "very_low"),
    ({"social_diff": "large", "sleep_diff": "small"}, "medium"),
]


def _tri(x: np.ndarray, a: float, b: float, c: float) -> np.ndarray:
    left = np.where(b > a, (x - a) / max(b - a, 1e-9), (x >= b).astype(float))
    right = np.where(c > b, (c - x) / max(c - b, 1e-9), (x <= b).astype(float))
    return np.clip(np.minimum(left, right), 0.0, 1.0)


def _trap(x: np.ndarray, a: float, b: float, c: float, d: float) -> np.ndarray:
    up = np.ones_like(x) if b <= a else (x - a) / (b - a)
    down = np.ones_like(x) if d <= c else (d - x) / (d - c)
    return np.clip(np.minimum(up, down), 0.0, 1.0)


OUT_MF = {
    "very_low": _trap(OUT_UNIVERSE, 0, 0, 8, 30),
    "low": _tri(OUT_UNIVERSE, 0, 25, 50),
    "medium": _tri(OUT_UNIVERSE, 25, 50, 75),
    "high": _tri(OUT_UNIVERSE, 50, 75, 100),
    "very_high": _trap(OUT_UNIVERSE, 70, 92, 100, 100),
}
OUT_MF_MATRIX = np.stack([OUT_MF[t] for t in OUT_TERMS])  # (5, 101)


def input_memberships(x: np.ndarray, a: float, m: float, b: float) -> dict[str, np.ndarray]:
    """Ruspini partition memberships for crisp values ``x``."""
    x = np.asarray(x, dtype=float)
    small = np.clip((m - x) / max(m - a, 1e-9), 0.0, 1.0)
    large = np.clip((x - m) / max(b - m, 1e-9), 0.0, 1.0)
    medium = np.clip(1.0 - small - large, 0.0, 1.0)
    return {"small": small, "medium": medium, "large": large}


@dataclass
class FuzzyParams:
    mf: dict[str, tuple[float, float, float]] = field(default_factory=lambda: dict(DEFAULT_MF))
    weights: np.ndarray = field(default_factory=lambda: np.ones(len(RULES)))

    # ---- genome encoding for the genetic algorithm ----
    def to_vector(self) -> np.ndarray:
        parts = []
        for name in INPUTS:
            parts.extend(self.mf[name])
        return np.concatenate([np.array(parts), self.weights])

    @staticmethod
    def from_vector(v: np.ndarray) -> "FuzzyParams":
        v = np.asarray(v, dtype=float)
        mf = {}
        for i, (name, umax) in enumerate(INPUTS.items()):
            a, m, b = np.sort(np.clip(v[3 * i: 3 * i + 3], 0.0, umax))
            # keep a minimum spread so the partition stays well-formed
            m = max(m, a + 0.1)
            b = max(b, m + 0.1)
            mf[name] = (float(a), float(m), float(b))
        w = np.clip(v[3 * len(INPUTS):], 0.0, 1.0)
        return FuzzyParams(mf=mf, weights=w)

    def to_dict(self) -> dict:
        return {"mf": {k: list(v) for k, v in self.mf.items()},
                "weights": [float(w) for w in self.weights]}


class FuzzyCompatibility:
    """Vectorised Mamdani inference."""

    def __init__(self, params: FuzzyParams | None = None):
        self.params = params or FuzzyParams()

    def _rule_strengths(self, inputs: dict[str, np.ndarray]) -> tuple[np.ndarray, dict]:
        mems = {name: input_memberships(inputs[name], *self.params.mf[name]) for name in INPUTS}
        n = len(next(iter(inputs.values())))
        strengths = np.zeros((len(RULES), n))
        for r, (ante, _) in enumerate(RULES):
            s = np.ones(n)
            for var, term in ante.items():
                s = np.minimum(s, mems[var][term])       # AND = min
            strengths[r] = s * self.params.weights[r]    # rule weight
        return strengths, mems

    def evaluate(self, inputs: dict[str, np.ndarray], chunk: int = 20000) -> np.ndarray:
        """Crisp compatibility (0..100) for arrays of crisp inputs."""
        inputs = {k: np.asarray(inputs[k], dtype=float).ravel() for k in INPUTS}
        n = len(inputs["sleep_diff"])
        out = np.empty(n)
        cons_idx = np.array([OUT_TERMS.index(c) for _, c in RULES])
        for start in range(0, n, chunk):
            sl = {k: v[start:start + chunk] for k, v in inputs.items()}
            strengths, _ = self._rule_strengths(sl)              # (R, c)
            # aggregate rule strengths per output term (max)
            term_act = np.zeros((len(OUT_TERMS), strengths.shape[1]))
            for t in range(len(OUT_TERMS)):
                mask = cons_idx == t
                if mask.any():
                    term_act[t] = strengths[mask].max(axis=0)
            # implication (clip) + aggregation (max) over the output universe
            agg = np.max(np.minimum(term_act[:, :, None], OUT_MF_MATRIX[:, None, :]), axis=0)  # (c, 101)
            area = agg.sum(axis=1)
            centroid = (agg * OUT_UNIVERSE).sum(axis=1) / np.where(area > 0, area, 1.0)
            out[start:start + chunk] = np.where(area > 0, centroid, 50.0)
        return out

    def explain(self, crisp: dict[str, float]) -> dict:
        """Full trace of inference for a single pair (for the UI)."""
        inputs = {k: np.array([float(crisp[k])]) for k in INPUTS}
        strengths, mems = self._rule_strengths(inputs)
        score = float(self.evaluate(inputs)[0])
        cons_idx = [OUT_TERMS.index(c) for _, c in RULES]
        term_act = np.zeros(len(OUT_TERMS))
        for r, t in enumerate(cons_idx):
            term_act[t] = max(term_act[t], strengths[r, 0])
        agg = np.max(np.minimum(term_act[:, None], OUT_MF_MATRIX), axis=0)
        fired = [
            {"rule": int(i), "if": RULES[i][0], "then": RULES[i][1],
             "strength": round(float(strengths[i, 0]), 3),
             "weight": round(float(self.params.weights[i]), 3)}
            for i in np.argsort(-strengths[:, 0]) if strengths[i, 0] > 1e-6
        ]
        return {
            "inputs": {k: round(float(crisp[k]), 2) for k in INPUTS},
            "memberships": {k: {t: round(float(v[0]), 3) for t, v in m.items()} for k, m in mems.items()},
            "fired_rules": fired,
            "aggregated": [round(float(v), 3) for v in agg[::5]],  # 21 points 0..100
            "score": round(score, 1),
        }


# ---------------------------------------------------------------------------
# Final compatibility = fuzzy core + language & shared-interest bonuses
# ---------------------------------------------------------------------------
FUZZY_SHARE = 0.82
LANG_BONUS = 10.0
INTEREST_BONUS = 8.0
SMOKER_PENALTY = 25.0
FUZZY_MIN, FUZZY_MAX = 18.0, 82.0


def combine(fuzzy: np.ndarray, same_language: np.ndarray, interest_sim: np.ndarray,
            smoker_mismatch: np.ndarray) -> np.ndarray:
    # Centroid defuzzification never reaches the extremes of the universe, so
    # the raw output lives roughly in [18, 82]; stretch it to 0..100.
    fuzzy = np.clip((fuzzy - FUZZY_MIN) / (FUZZY_MAX - FUZZY_MIN) * 100.0, 0.0, 100.0)
    s = (FUZZY_SHARE * fuzzy + LANG_BONUS * same_language + INTEREST_BONUS * interest_sim
         - SMOKER_PENALTY * smoker_mismatch)
    return np.clip(s, 0.0, 100.0)


def compatibility_matrix(features: dict[str, np.ndarray], model: FuzzyCompatibility) -> np.ndarray:
    n = features["sleep_diff"].shape[0]
    fz = model.evaluate({k: features[k] for k in INPUTS}).reshape(n, n)
    m = combine(fz, features["same_language"], features["interest_sim"], features["smoker_mismatch"])
    m = (m + m.T) / 2.0
    np.fill_diagonal(m, 100.0)
    return m


def compatibility_from_rows(x: np.ndarray, model: FuzzyCompatibility) -> np.ndarray:
    """Final score for explicit pair-feature rows (columns = PAIR_FEATURES)."""
    from ..features import PAIR_FEATURES
    col = {n: x[:, i] for i, n in enumerate(PAIR_FEATURES)}
    fz = model.evaluate({k: col[k] for k in INPUTS})
    return combine(fz, col["same_language"], col["interest_sim"], col["smoker_mismatch"])
