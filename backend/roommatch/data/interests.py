"""Multilingual interest vocabulary (English / Russian / Kazakh).

Students write their "About me" in any of the three languages. Before
TF-IDF we normalise known interest words to a canonical English token so
that "шахматы", "шахмат" and "chess" are recognised as the same interest.
"""

from __future__ import annotations

# canonical -> (english surface form, russian form, kazakh form)
INTERESTS: dict[str, tuple[str, str, str]] = {
    "chess": ("chess", "шахматы", "шахмат"),
    "football": ("football", "футбол", "футбол"),
    "basketball": ("basketball", "баскетбол", "баскетбол"),
    "volleyball": ("volleyball", "волейбол", "волейбол"),
    "anime": ("anime", "аниме", "аниме"),
    "gaming": ("video games", "видеоигры", "ойындар"),
    "music": ("music", "музыка", "музыка"),
    "guitar": ("guitar", "гитара", "гитара"),
    "dombra": ("dombra", "домбра", "домбыра"),
    "reading": ("reading", "чтение", "кітап"),
    "programming": ("programming", "программирование", "бағдарламалау"),
    "math": ("math", "математика", "математика"),
    "gym": ("gym", "спортзал", "спортзал"),
    "running": ("running", "бег", "жүгіру"),
    "cooking": ("cooking", "готовка", "аспаздық"),
    "movies": ("movies", "фильмы", "фильмдер"),
    "travel": ("travel", "путешествия", "саяхат"),
    "photography": ("photography", "фотография", "фотография"),
    "drawing": ("drawing", "рисование", "сурет"),
    "dance": ("dance", "танцы", "би"),
    "startups": ("startups", "стартапы", "стартаптар"),
    "hiking": ("hiking", "походы", "тау"),
    "kpop": ("kpop", "кпоп", "кпоп"),
    "podcasts": ("podcasts", "подкасты", "подкасттар"),
    "coffee": ("coffee", "кофе", "кофе"),
}

INTEREST_EMOJI: dict[str, str] = {
    "chess": "♟️", "football": "⚽", "basketball": "🏀", "volleyball": "🏐",
    "anime": "🍥", "gaming": "🎮", "music": "🎧", "guitar": "🎸",
    "dombra": "🪕", "reading": "📚", "programming": "💻", "math": "📐",
    "gym": "🏋️", "running": "🏃", "cooking": "🍳", "movies": "🎬",
    "travel": "✈️", "photography": "📷", "drawing": "🎨", "dance": "💃",
    "startups": "🚀", "hiking": "🏔️", "kpop": "🎤", "podcasts": "🎙️",
    "coffee": "☕",
}

# Every surface form (and a few common extra forms) -> canonical token.
SYNONYMS: dict[str, str] = {}
for canon, forms in INTERESTS.items():
    for form in forms:
        for word in form.lower().split():
            SYNONYMS.setdefault(word, canon)
    SYNONYMS[canon] = canon

SYNONYMS.update({
    "games": "gaming", "game": "gaming", "videogames": "gaming", "игры": "gaming",
    "игр": "gaming", "ойын": "gaming", "books": "reading", "книги": "reading",
    "кітаптар": "reading", "code": "programming", "coding": "programming",
    "кодинг": "programming", "зал": "gym", "workout": "gym", "фитнес": "gym",
    "кино": "movies", "films": "movies", "film": "movies", "фильм": "movies",
    "photo": "photography", "фото": "photography", "art": "drawing",
    "dancing": "dance", "танец": "dance", "k-pop": "kpop", "mountains": "hiking",
    "горы": "hiking", "таулар": "hiking", "video": "gaming",
})
# "video games" -> both tokens map to gaming; drop the generic "video" only
# when it stands alone in other contexts is acceptable for this domain.

STOPWORDS: set[str] = {
    # english
    "i", "love", "and", "also", "into", "like", "the", "a", "an", "my", "in",
    "am", "really", "enjoy", "of", "to", "me", "is", "with", "for",
    # russian
    "люблю", "и", "ещё", "еще", "увлекаюсь", "я", "в", "на", "мне", "нравится",
    "очень", "а", "также", "тоже", "с",
    # kazakh
    "маған", "пен", "мен", "ұнайды", "сондай", "ақ", "және", "мен", "де",
    "да", "қызықтырады", "жақсы", "көремін",
}


def surface(canon: str, lang: str) -> str:
    en, ru, kk = INTERESTS[canon]
    return {"en": en, "ru": ru, "kk": kk}[lang]
