"""Learning from residents' feedback — from scratch.

* CART decision tree (Gini) and a small Random Forest predict whether a
  pair of roommates will end up in conflict (rating <= 2 out of 5) and
  reveal which factors matter most (feature importance).
* A genetic algorithm tunes the fuzzy system's membership functions and
  rule weights so that its scores agree with real ratings
  (a "genetic-fuzzy system").
"""

from __future__ import annotations

import time
from dataclasses import dataclass

import numpy as np

from .fuzzy import INPUTS, RULES, FuzzyCompatibility, FuzzyParams, compatibility_from_rows


# ---------------------------------------------------------------------------
# Metrics
# ---------------------------------------------------------------------------
def classification_metrics(y_true: np.ndarray, y_pred: np.ndarray) -> dict:
    tp = int(np.sum((y_pred == 1) & (y_true == 1)))
    tn = int(np.sum((y_pred == 0) & (y_true == 0)))
    fp = int(np.sum((y_pred == 1) & (y_true == 0)))
    fn = int(np.sum((y_pred == 0) & (y_true == 1)))
    precision = tp / (tp + fp) if tp + fp else 0.0
    recall = tp / (tp + fn) if tp + fn else 0.0
    f1 = 2 * precision * recall / (precision + recall) if precision + recall else 0.0
    return {"accuracy": round((tp + tn) / max(len(y_true), 1), 4), "precision": round(precision, 4),
            "recall": round(recall, 4), "f1": round(f1, 4),
            "confusion": {"tp": tp, "tn": tn, "fp": fp, "fn": fn}}


def pearson(a: np.ndarray, b: np.ndarray) -> float:
    a, b = a - a.mean(), b - b.mean()
    d = np.sqrt((a ** 2).sum() * (b ** 2).sum())
    return float((a * b).sum() / d) if d > 0 else 0.0


def train_test_split(n: int, test_frac: float = 0.25, seed: int = 0):
    idx = np.random.default_rng(seed).permutation(n)
    cut = int(n * (1 - test_frac))
    return idx[:cut], idx[cut:]


# ---------------------------------------------------------------------------
# CART decision tree
# ---------------------------------------------------------------------------
@dataclass
class Node:
    prediction: int
    proba: float
    samples: int
    gini: float
    feature: int = -1
    threshold: float = 0.0
    left: "Node | None" = None
    right: "Node | None" = None

    @property
    def is_leaf(self) -> bool:
        return self.left is None


def gini(y: np.ndarray) -> float:
    if len(y) == 0:
        return 0.0
    p = y.mean()
    return 1.0 - p ** 2 - (1 - p) ** 2


class DecisionTree:
    def __init__(self, max_depth: int = 4, min_samples_leaf: int = 10,
                 max_features: int | None = None, seed: int = 0):
        self.max_depth, self.min_leaf = max_depth, min_samples_leaf
        self.max_features = max_features
        self.rng = np.random.default_rng(seed)
        self.root: Node | None = None
        self.importances_: np.ndarray | None = None

    def fit(self, x: np.ndarray, y: np.ndarray) -> "DecisionTree":
        self.n_features = x.shape[1]
        self._imp = np.zeros(self.n_features)
        self.root = self._grow(x, y.astype(int), 0)
        total = self._imp.sum()
        self.importances_ = self._imp / total if total > 0 else self._imp
        return self

    def _best_split(self, x: np.ndarray, y: np.ndarray):
        best = (None, None, 0.0)  # feature, threshold, gain
        parent = gini(y)
        feats = np.arange(self.n_features)
        if self.max_features:
            feats = self.rng.choice(feats, self.max_features, replace=False)
        n = len(y)
        for f in feats:
            order = np.argsort(x[:, f])
            xs, ys = x[order, f], y[order]
            left_pos = np.cumsum(ys)[:-1]
            left_n = np.arange(1, n)
            right_pos = ys.sum() - left_pos
            right_n = n - left_n
            valid = (xs[1:] != xs[:-1]) & (left_n >= self.min_leaf) & (right_n >= self.min_leaf)
            if not valid.any():
                continue
            pl, pr = left_pos / left_n, right_pos / right_n
            g = (left_n * (1 - pl ** 2 - (1 - pl) ** 2) + right_n * (1 - pr ** 2 - (1 - pr) ** 2)) / n
            gain = np.where(valid, parent - g, -np.inf)
            k = int(np.argmax(gain))
            if gain[k] > best[2]:
                best = (int(f), float((xs[k] + xs[k + 1]) / 2), float(gain[k]))
        return best

    def _grow(self, x: np.ndarray, y: np.ndarray, depth: int) -> Node:
        p = float(y.mean()) if len(y) else 0.0
        node = Node(prediction=int(p >= 0.5), proba=p, samples=len(y), gini=gini(y))
        if depth >= self.max_depth or len(y) < 2 * self.min_leaf or node.gini == 0:
            return node
        f, thr, gain = self._best_split(x, y)
        if f is None or gain <= 1e-7:
            return node
        mask = x[:, f] <= thr
        self._imp[f] += gain * len(y)
        node.feature, node.threshold = f, thr
        node.left = self._grow(x[mask], y[mask], depth + 1)
        node.right = self._grow(x[~mask], y[~mask], depth + 1)
        return node

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        out = np.empty(len(x))
        for i, row in enumerate(x):
            node = self.root
            while node is not None and not node.is_leaf:
                node = node.left if row[node.feature] <= node.threshold else node.right
            out[i] = node.proba if node else 0.0
        return out

    def predict(self, x: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(x) >= threshold).astype(int)

    def export(self, feature_names: list[str], node: Node | None = None, depth: int = 0) -> dict:
        node = node or self.root
        d = {"samples": node.samples, "proba": round(node.proba, 3), "gini": round(node.gini, 3)}
        if not node.is_leaf and depth < 6:
            d.update({"feature": feature_names[node.feature], "threshold": round(node.threshold, 2),
                      "left": self.export(feature_names, node.left, depth + 1),
                      "right": self.export(feature_names, node.right, depth + 1)})
        return d


class RandomForest:
    def __init__(self, n_trees: int = 40, max_depth: int = 6, min_samples_leaf: int = 5,
                 max_features: int | None = 3, seed: int = 0):
        self.params = (max_depth, min_samples_leaf, max_features)
        self.n_trees, self.seed = n_trees, seed

    def fit(self, x: np.ndarray, y: np.ndarray) -> "RandomForest":
        rng = np.random.default_rng(self.seed)
        self.trees = []
        for t in range(self.n_trees):
            idx = rng.integers(0, len(x), len(x))   # bootstrap sample
            tree = DecisionTree(*self.params, seed=self.seed + t).fit(x[idx], y[idx])
            self.trees.append(tree)
        self.importances_ = np.mean([t.importances_ for t in self.trees], axis=0)
        return self

    def predict_proba(self, x: np.ndarray) -> np.ndarray:
        return np.mean([t.predict_proba(x) for t in self.trees], axis=0)

    def predict(self, x: np.ndarray, threshold: float = 0.5) -> np.ndarray:
        return (self.predict_proba(x) >= threshold).astype(int)


# ---------------------------------------------------------------------------
# Genetic algorithm for the fuzzy system
# ---------------------------------------------------------------------------
def _bounds() -> tuple[np.ndarray, np.ndarray]:
    lo, hi = [], []
    for umax in INPUTS.values():
        lo += [0.0] * 3
        hi += [umax] * 3
    lo += [0.0] * len(RULES)
    hi += [1.0] * len(RULES)
    return np.array(lo), np.array(hi)


def fuzzy_fitness(vec: np.ndarray, x: np.ndarray, rating: np.ndarray) -> float:
    model = FuzzyCompatibility(FuzzyParams.from_vector(vec))
    return pearson(compatibility_from_rows(x, model), rating.astype(float))


def genetic_tune(x: np.ndarray, rating: np.ndarray, population: int = 40, generations: int = 40,
                 crossover_rate: float = 0.9, mutation_rate: float = 0.15, mutation_scale: float = 0.12,
                 elite: int = 2, tournament: int = 3, seed: int = 0) -> dict:
    """Real-coded GA: tournament selection, BLX-α crossover, Gaussian
    mutation and elitism. Fitness = Pearson correlation between the fuzzy
    compatibility score and residents' ratings."""
    t0 = time.perf_counter()
    rng = np.random.default_rng(seed)
    lo, hi = _bounds()
    dim = len(lo)
    base = FuzzyParams().to_vector()
    pop = np.vstack([base] + [np.clip(base + rng.normal(0, 0.25, dim) * (hi - lo), lo, hi)
                              for _ in range(population - 1)])
    fit = np.array([fuzzy_fitness(ind, x, rating) for ind in pop])
    history = []
    for gen in range(generations):
        order = np.argsort(-fit)
        history.append({"generation": gen, "best": round(float(fit[order[0]]), 4),
                        "mean": round(float(fit.mean()), 4)})
        new = [pop[i].copy() for i in order[:elite]]                     # elitism
        while len(new) < population:
            def pick():
                cand = rng.choice(population, tournament, replace=False)  # tournament
                return pop[cand[np.argmax(fit[cand])]]
            p1, p2 = pick(), pick()
            if rng.random() < crossover_rate:                             # BLX-0.3
                alpha = 0.3
                lo_c, hi_c = np.minimum(p1, p2), np.maximum(p1, p2)
                span = hi_c - lo_c
                child = rng.uniform(lo_c - alpha * span, hi_c + alpha * span)
            else:
                child = p1.copy()
            mask = rng.random(dim) < mutation_rate                        # Gaussian mutation
            child[mask] += rng.normal(0, mutation_scale, mask.sum()) * (hi - lo)[mask]
            new.append(np.clip(child, lo, hi))
        pop = np.array(new)
        fit = np.array([fuzzy_fitness(ind, x, rating) for ind in pop])
    best = int(np.argmax(fit))
    history.append({"generation": generations, "best": round(float(fit[best]), 4),
                    "mean": round(float(fit.mean()), 4)})
    return {"params": FuzzyParams.from_vector(pop[best]), "fitness": float(fit[best]),
            "history": history, "seconds": round(time.perf_counter() - t0, 2)}
