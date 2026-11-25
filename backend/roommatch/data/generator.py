"""Synthetic data generator.

Students are sampled from five latent lifestyle archetypes. The archetype is
stored on the student only for evaluation (e.g. checking that K-means
recovers it) and is never used by the matching algorithms.
"""

from __future__ import annotations

import numpy as np

from ..models import FEATURE_RANGES, LIFESTYLE_FEATURES, Student, build_dorm, Dorm
from .interests import INTERESTS, surface

ARCHETYPES: dict[str, dict] = {
    #                bed   wake  clean noise guests study social
    "quiet_scholar": {"mean": [22.8, 7.0, 4.3, 1.8, 1.4, 4.5, 1.8], "smoke": 0.04,
                      "interests": ["reading", "math", "chess", "programming", "podcasts", "coffee"]},
    "night_owl": {"mean": [25.7, 10.3, 2.4, 3.9, 2.8, 3.1, 2.6], "smoke": 0.22,
                  "interests": ["gaming", "anime", "programming", "music", "movies", "kpop"]},
    "early_bird": {"mean": [22.1, 6.0, 4.1, 2.8, 2.2, 2.0, 3.2], "smoke": 0.05,
                   "interests": ["gym", "running", "football", "basketball", "volleyball", "hiking", "cooking"]},
    "social_butterfly": {"mean": [24.6, 9.0, 3.0, 4.4, 4.5, 1.6, 4.6], "smoke": 0.28,
                         "interests": ["dance", "music", "travel", "movies", "football", "kpop", "startups", "photography"]},
    "easygoing": {"mean": [23.8, 8.2, 3.2, 3.4, 2.8, 2.8, 3.3], "smoke": 0.08,
                  "interests": ["cooking", "movies", "dombra", "guitar", "travel", "drawing", "photography", "hiking"]},
}
ARCHETYPE_WEIGHTS = np.array([0.22, 0.22, 0.2, 0.16, 0.2])
STD = np.array([0.6, 0.7, 0.6, 0.6, 0.6, 0.6, 0.6])

FEMALE_NAMES = ["Aigerim", "Dana", "Aruzhan", "Madina", "Dariga", "Zhansaya", "Kamila",
                "Asel", "Tomiris", "Ayaulym", "Alina", "Sofia", "Anel", "Diana", "Saule",
                "Inkar", "Moldir", "Akbota", "Karina", "Yasmin", "Aisha", "Balnur",
                "Nazerke", "Gulnaz", "Zarina", "Togzhan", "Meruyert", "Ainur"]
MALE_NAMES = ["Arman", "Daniyar", "Nurlan", "Yerlan", "Alikhan", "Temirlan", "Askar",
              "Dias", "Sanzhar", "Bekzat", "Nursultan", "Aidos", "Timur", "Artem",
              "Ilyas", "Miras", "Adil", "Rustam", "Zhandos", "Erasyl", "Abylai",
              "Dauren", "Madi", "Olzhas", "Ruslan", "Yernar", "Kairat", "Batyr"]
SURNAME_INITIALS = list("ABDEGIKMNOSTUZ")
FACULTIES = ["IT", "Engineering", "Business", "Medicine", "Law", "Design"]

ABOUT_TEMPLATES = {
    "en": ["I love {a} and {b}. Also into {c}.", "Big fan of {a}, {b} and {c}.",
           "Free time = {a} + {b}. Sometimes {c}."],
    "ru": ["Люблю {a} и {b}. Ещё увлекаюсь: {c}.", "Мне нравится {a}, {b} и {c}.",
           "В свободное время {a}, {b}, иногда {c}."],
    "kk": ["Маған {a} пен {b} ұнайды. Сондай-ақ {c}.", "{a}, {b} және {c} қызықтырады.",
           "Бос уақытта {a}, {b}, кейде {c}."],
}


def _round_features(v: np.ndarray) -> np.ndarray:
    out = v.copy()
    out[0] = np.round(out[0] * 2) / 2          # bedtime to 30 min
    out[1] = np.round(out[1] * 2) / 2          # wake time to 30 min
    out[2:] = np.round(out[2:])                # Likert 1..5
    for i, f in enumerate(LIFESTYLE_FEATURES):
        lo, hi = FEATURE_RANGES[f]
        out[i] = np.clip(out[i], lo, hi)
    return out


def make_about(rng: np.random.Generator, archetype: str, lang: str) -> str:
    pool = ARCHETYPES[archetype]["interests"]
    if rng.random() < 0.8:
        picks = list(rng.choice(pool, size=3, replace=False))
    else:
        picks = list(rng.choice(pool, size=2, replace=False)) + \
            [str(rng.choice(list(INTERESTS.keys())))]
    words = [surface(p, lang) for p in picks]
    template = str(rng.choice(ABOUT_TEMPLATES[lang]))
    text = template.format(a=words[0], b=words[1], c=words[2])
    return text[0].upper() + text[1:]


def generate_students(n: int, seed: int = 42, friend_rate: float = 0.05,
                      start_id: int = 1) -> list[Student]:
    rng = np.random.default_rng(seed)
    names = list(ARCHETYPES.keys())
    students: list[Student] = []
    for i in range(n):
        arch = str(rng.choice(names, p=ARCHETYPE_WEIGHTS))
        spec = ARCHETYPES[arch]
        vec = _round_features(rng.normal(spec["mean"], STD))
        gender = str(rng.choice(["F", "M"]))
        first = str(rng.choice(FEMALE_NAMES if gender == "F" else MALE_NAMES))
        lang = str(rng.choice(["kk", "ru", "en"], p=[0.45, 0.4, 0.15]))
        students.append(Student(
            id=start_id + i,
            name=f"{first} {rng.choice(SURNAME_INITIALS)}.",
            gender=gender,
            year=int(rng.choice([1, 2, 3, 4], p=[0.4, 0.3, 0.2, 0.1])),
            faculty=str(rng.choice(FACULTIES)),
            **{f: float(vec[j]) for j, f in enumerate(LIFESTYLE_FEATURES)},
            smoker=bool(rng.random() < spec["smoke"]),
            language=lang,
            about=make_about(rng, arch, lang),
            archetype=arch,
        ))

    # Mutual friend requests: pair up some students of the same gender,
    # smoking status and (usually) archetype.
    n_pairs = int(n * friend_rate / 2)
    free = list(rng.permutation(len(students)))
    made = 0
    while made < n_pairs and len(free) > 1:
        a = students[free.pop()]
        for k in range(len(free) - 1, -1, -1):
            b = students[free[k]]
            if b.gender == a.gender and b.smoker == a.smoker and \
                    (b.archetype == a.archetype or rng.random() < 0.3):
                a.friend_id, b.friend_id = b.id, a.id
                free.pop(k)
                made += 1
                break
    return students


def generate_world(n: int = 240, seed: int = 42) -> tuple[list[Student], Dorm]:
    students = generate_students(n, seed=seed)
    n_f = sum(s.gender == "F" for s in students)
    dorm = build_dorm(n_female=n_f, n_male=n - n_f, seed=seed)
    return students, dorm
