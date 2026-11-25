"""K-means++ clustering, silhouette analysis and PCA — from scratch.

Groups residents into lifestyle "types" (e.g. night owls, quiet scholars).
The types are used to (1) explain residents to administrators, (2) guide
the value ordering of the CSP solver and (3) show each student a
"resident passport".
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from ..models import LIFESTYLE_FEATURES

# Persona prototypes used only to give clusters human-readable names.
PERSONAS: dict[str, dict] = {
    "quiet_scholar": {"emoji": "📚", "proto": [22.8, 7.0, 4.3, 1.8, 1.4, 4.5, 1.8]},
    "night_owl": {"emoji": "🦉", "proto": [25.7, 10.3, 2.4, 3.9, 2.8, 3.1, 2.6]},
    "early_bird": {"emoji": "🌅", "proto": [22.1, 6.0, 4.1, 2.8, 2.2, 2.0, 3.2]},
    "social_butterfly": {"emoji": "🦋", "proto": [24.6, 9.0, 3.0, 4.4, 4.5, 1.6, 4.6]},
    "easygoing": {"emoji": "🌿", "proto": [23.8, 8.2, 3.2, 3.4, 2.8, 2.8, 3.3]},
}


@dataclass
class KMeansResult:
    labels: np.ndarray
    centroids: np.ndarray       # in standardized space
    inertia: float
    n_iter: int


class Standardizer:
    def fit(self, x: np.ndarray) -> "Standardizer":
        self.mean = x.mean(axis=0)
        self.std = x.std(axis=0)
        self.std[self.std == 0] = 1.0
        return self

    def transform(self, x: np.ndarray) -> np.ndarray:
        return (x - self.mean) / self.std

    def inverse(self, z: np.ndarray) -> np.ndarray:
        return z * self.std + self.mean


def _sq_dists(x: np.ndarray, c: np.ndarray) -> np.ndarray:
    return ((x[:, None, :] - c[None, :, :]) ** 2).sum(axis=2)


def kmeans_pp_init(x: np.ndarray, k: int, rng: np.random.Generator) -> np.ndarray:
    """k-means++: next centre sampled with probability ∝ D(x)^2."""
    centers = [x[rng.integers(len(x))]]
    for _ in range(1, k):
        d2 = _sq_dists(x, np.array(centers)).min(axis=1)
        probs = d2 / d2.sum() if d2.sum() > 0 else np.full(len(x), 1 / len(x))
        centers.append(x[rng.choice(len(x), p=probs)])
    return np.array(centers)


def kmeans(x: np.ndarray, k: int, n_init: int = 8, max_iter: int = 300,
           tol: float = 1e-6, seed: int = 0) -> KMeansResult:
    """Lloyd's algorithm with k-means++ init; best of ``n_init`` runs."""
    rng = np.random.default_rng(seed)
    best: KMeansResult | None = None
    for _ in range(n_init):
        c = kmeans_pp_init(x, k, rng)
        for it in range(1, max_iter + 1):
            labels = _sq_dists(x, c).argmin(axis=1)                  # assignment step
            new_c = np.array([x[labels == j].mean(axis=0) if np.any(labels == j)
                              else x[rng.integers(len(x))] for j in range(k)])  # update step
            shift = np.abs(new_c - c).max()
            c = new_c
            if shift < tol:
                break
        labels = _sq_dists(x, c).argmin(axis=1)
        inertia = float(((x - c[labels]) ** 2).sum())
        if best is None or inertia < best.inertia:
            best = KMeansResult(labels=labels, centroids=c, inertia=inertia, n_iter=it)
    assert best is not None
    return best


def silhouette_score(x: np.ndarray, labels: np.ndarray, max_n: int = 1500, seed: int = 0) -> float:
    """Mean silhouette s(i) = (b - a) / max(a, b)."""
    if len(np.unique(labels)) < 2:
        return 0.0
    if len(x) > max_n:
        idx = np.random.default_rng(seed).choice(len(x), max_n, replace=False)
        x, labels = x[idx], labels[idx]
    d = np.sqrt(_sq_dists(x, x))
    s = np.zeros(len(x))
    for i in range(len(x)):
        same = labels == labels[i]
        same[i] = False
        if not same.any():
            continue
        a = d[i, same].mean()
        b = min(d[i, labels == other].mean() for other in np.unique(labels) if other != labels[i])
        s[i] = (b - a) / max(a, b) if max(a, b) > 0 else 0.0
    return float(s.mean())


def pca_2d(x: np.ndarray) -> tuple[np.ndarray, np.ndarray]:
    """Project onto the first two principal components (via SVD)."""
    xc = x - x.mean(axis=0)
    _, sv, vt = np.linalg.svd(xc, full_matrices=False)
    explained = sv ** 2 / (sv ** 2).sum()
    return xc @ vt[:2].T, explained[:2]


def adjusted_rand_index(a: np.ndarray, b: np.ndarray) -> float:
    """ARI between two labelings (used to check we recover true archetypes)."""
    _, a = np.unique(a, return_inverse=True)
    _, b = np.unique(b, return_inverse=True)
    table = np.zeros((a.max() + 1, b.max() + 1))
    np.add.at(table, (a, b), 1)
    comb = lambda n: n * (n - 1) / 2  # noqa: E731
    sum_ij = comb(table).sum()
    sum_a, sum_b = comb(table.sum(axis=1)).sum(), comb(table.sum(axis=0)).sum()
    expected = sum_a * sum_b / comb(len(a))
    max_idx = (sum_a + sum_b) / 2
    return float((sum_ij - expected) / (max_idx - expected)) if max_idx != expected else 1.0


def name_clusters(centroids_raw: np.ndarray, scaler: Standardizer) -> list[dict]:
    """Greedy one-to-one matching of centroids to persona prototypes."""
    protos = np.array([p["proto"] for p in PERSONAS.values()])
    names = list(PERSONAS.keys())
    d = _sq_dists(scaler.transform(centroids_raw), scaler.transform(protos))
    result: list[dict | None] = [None] * len(centroids_raw)
    used: dict[str, int] = {}
    order = np.dstack(np.unravel_index(np.argsort(d, axis=None), d.shape))[0]
    for ci, pi in order:
        if result[ci] is None and names[pi] not in used:
            result[ci] = {"key": names[pi], "emoji": PERSONAS[names[pi]]["emoji"], "variant": 0}
            used[names[pi]] = 1
    for ci in range(len(result)):  # k > number of personas: reuse nearest with variant number
        if result[ci] is None:
            pi = int(d[ci].argmin())
            used[names[pi]] = used.get(names[pi], 0) + 1
            result[ci] = {"key": names[pi], "emoji": PERSONAS[names[pi]]["emoji"], "variant": used[names[pi]] - 1}
    return result  # type: ignore[return-value]


def describe_centroid(raw: np.ndarray, pop_mean: np.ndarray, pop_std: np.ndarray) -> list[dict]:
    """Most distinctive traits of a cluster, as z-score deviations."""
    z = (raw - pop_mean) / pop_std
    order = np.argsort(-np.abs(z))[:3]
    return [{"feature": LIFESTYLE_FEATURES[i], "z": round(float(z[i]), 2),
             "value": round(float(raw[i]), 2)} for i in order]


def choose_k(x: np.ndarray, k_range=range(2, 9), seed: int = 0) -> dict:
    """Elbow (inertia) and silhouette for each k."""
    inertias, sils = [], []
    for k in k_range:
        r = kmeans(x, k, n_init=4, seed=seed)
        inertias.append(r.inertia)
        sils.append(silhouette_score(x, r.labels, max_n=600, seed=seed))
    ks = list(k_range)
    return {"k_values": ks, "inertia": [round(v, 1) for v in inertias],
            "silhouette": [round(v, 4) for v in sils],
            "elbow_k": elbow_k(ks, inertias), "silhouette_k": ks[int(np.argmax(sils))]}


def elbow_k(ks: list[int], inertias: list[float]) -> int:
    """Kneedle-style elbow: the point farthest from the straight line joining
    the first and last points of the (normalised) inertia curve."""
    x = (np.array(ks) - ks[0]) / (ks[-1] - ks[0])
    y = (np.array(inertias) - min(inertias)) / (max(inertias) - min(inertias) + 1e-12)
    # line from (0, 1) to (1, 0): distance ∝ |x + y - 1|
    dist = np.abs(x + y - 1) / np.sqrt(2)
    return int(ks[int(np.argmax(dist))])
