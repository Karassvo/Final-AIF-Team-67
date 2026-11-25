"""TF-IDF + cosine similarity, implemented from scratch.

Used to find shared interests in the free-text "About me" answers, which
may be written in Kazakh, Russian or English.
"""

from __future__ import annotations

import re
from collections import Counter

import numpy as np

from ..data.interests import INTERESTS, STOPWORDS, SYNONYMS

TOKEN_RE = re.compile(r"[a-zа-яёәғқңөұүһі\-]+", re.IGNORECASE)


def normalize_token(tok: str) -> str:
    """Map a word to its canonical interest token if known.

    Uses an exact dictionary lookup first and then a light-weight suffix
    stripping fallback (Russian/Kazakh are highly inflected:
    "шахматами" -> "шахмат" -> chess)."""
    tok = tok.lower().strip("-")
    if tok in SYNONYMS:
        return SYNONYMS[tok]
    if len(tok) >= 5:
        for cut in range(1, 4):
            stem = tok[:-cut]
            if stem in SYNONYMS:
                return SYNONYMS[stem]
    return tok


def tokenize(text: str) -> list[str]:
    tokens = [normalize_token(t) for t in TOKEN_RE.findall(text or "")]
    return [t for t in tokens if t and t not in STOPWORDS and len(t) > 1]


def extract_interests(text: str) -> list[str]:
    """Canonical interests mentioned in the text (order preserved, unique)."""
    seen: list[str] = []
    for t in tokenize(text):
        if t in INTERESTS and t not in seen:
            seen.append(t)
    return seen


class TfidfModel:
    """Minimal TF-IDF vectoriser (smooth idf, L2-normalised rows)."""

    def __init__(self) -> None:
        self.vocab: dict[str, int] = {}
        self.idf: np.ndarray = np.zeros(0)

    def fit(self, docs: list[str]) -> "TfidfModel":
        tokenized = [tokenize(d) for d in docs]
        df: Counter = Counter()
        for toks in tokenized:
            df.update(set(toks))
        self.vocab = {t: i for i, t in enumerate(sorted(df))}
        n = len(docs)
        self.idf = np.array([np.log((1 + n) / (1 + df[t])) + 1.0 for t in sorted(df)])
        return self

    def transform(self, docs: list[str]) -> np.ndarray:
        m = np.zeros((len(docs), len(self.vocab)))
        for i, d in enumerate(docs):
            counts = Counter(t for t in tokenize(d) if t in self.vocab)
            total = sum(counts.values()) or 1
            for t, c in counts.items():
                m[i, self.vocab[t]] = c / total
        m *= self.idf
        norms = np.linalg.norm(m, axis=1, keepdims=True)
        norms[norms == 0] = 1.0
        return m / norms

    def fit_transform(self, docs: list[str]) -> np.ndarray:
        return self.fit(docs).transform(docs)


def cosine_similarity_matrix(x: np.ndarray) -> np.ndarray:
    """Rows of ``x`` are already L2-normalised -> cosine = dot product."""
    sim = x @ x.T
    return np.clip(sim, 0.0, 1.0)


def shared_interests(text_a: str, text_b: str) -> list[str]:
    a = extract_interests(text_a)
    b = set(extract_interests(text_b))
    return [t for t in a if t in b]
