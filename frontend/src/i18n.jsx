import { createContext, useContext, useEffect, useMemo, useState } from 'react'

/* Three interface languages: English, Russian, Kazakh.
   t('key', {var}) looks up the current language, falls back to English. */

const en = {
  'app.tagline': 'Roommates matched by habits',
  'nav.home': 'Overview', 'nav.survey': 'Survey', 'nav.dorm': 'Dorm map', 'nav.types': 'Resident types',
  'nav.pair': 'Compare two', 'nav.lab': 'Lab',
  'theme.dark': 'Dark theme', 'theme.light': 'Light theme', 'lang': 'Language',

  'common.loading': 'Loading…', 'common.retry': 'Try again', 'common.students': 'students',
  'common.rooms': 'rooms', 'common.beds': 'beds', 'common.floor': 'Floor', 'common.room': 'Room',
  'common.close': 'Close', 'common.search': 'Search by name', 'common.run': 'Run',
  'common.running': 'Running…', 'common.female': 'Women', 'common.male': 'Men', 'common.smoking': 'Smoking room',
  'common.year': 'year {n}', 'common.open': 'Open profile', 'common.export': 'Download CSV',
  'common.noData': 'Nothing here yet.', 'common.seconds': '{n} s', 'common.empty': 'Free bed',
  'err.backend': 'The server is not responding. Start the backend (uvicorn roommatch.api:app) and try again.',

  'home.title': 'Roommates matched by habits, not by the alphabet',
  'home.lead': 'RoomMatch reads a short survey, finds resident types, and settles everyone into rooms so night owls don’t end up with early birds. It explains every decision and learns from how residents rate their roommates.',
  'home.ctaSurvey': 'Take the survey', 'home.ctaDorm': 'Open the dorm map',
  'home.liveCaption': 'Live: rooms settling during optimisation',
  'home.how': 'How a room gets assigned',
  'home.s1.t': 'Survey', 'home.s1.d': 'Sleep schedule, tidiness, guests, noise, a few words about yourself — in Kazakh, Russian or English.',
  'home.s2.t': 'Compatibility', 'home.s2.d': 'Fuzzy logic turns “23:30 vs 00:00” into “almost the same” and scores every pair from 0 to 100.',
  'home.s3.t': 'Resident types', 'home.s3.d': 'K-means groups people into types; TF-IDF finds shared interests in free text.',
  'home.s4.t': 'Rooms', 'home.s4.d': 'Constraint search guarantees the rules; simulated annealing then raises everyone’s satisfaction.',
  'home.s5.t': 'Learning', 'home.s5.d': 'After a month residents rate each other; a decision tree and a genetic algorithm retune the system.',
  'home.now': 'This dormitory right now',

  'kpi.students': 'Residents', 'kpi.mean': 'Average satisfaction', 'kpi.worst': 'Worst-off 10%',
  'kpi.conflict': 'At risk of conflict', 'kpi.rooms': 'Rooms', 'kpi.real': 'Real satisfaction (simulated)',

  'method.random': 'Random', 'method.greedy': 'Greedy CSP', 'method.annealing': 'CSP + annealing',
  'method.fair_annealing': 'CSP + annealing + fairness',
  'method.random.d': 'Any valid assignment — what happens without AI.',
  'method.greedy.d': 'Backtracking with MRV and forward checking, best room first.',
  'method.annealing.d': 'Greedy start, then 25k swaps by simulated annealing.',
  'method.fair_annealing.d': 'Same, but nobody is sacrificed for the average.',

  'dorm.title': 'Dorm map', 'dorm.lead': 'Each tile is a room; colour shows how well its residents match. Click a room to see who lives there and why.',
  'dorm.method': 'Method', 'dorm.fairness': 'Fairness λ', 'dorm.reassign': 'Reassign everyone',
  'dorm.replay': 'Replay optimisation', 'dorm.legend.low': 'conflict', 'dorm.legend.high': 'great match',
  'dorm.roomTitle': 'Room {id}', 'dorm.roomScore': 'Room match', 'dorm.why': 'Why together',
  'dorm.pickRoom': 'Pick a room on the map to see its residents.', 'dorm.done': 'Reassigned in {s} s',
  'dorm.find': 'Find a student', 'dorm.alone': 'Lives alone for now',

  'types.title': 'Resident types', 'types.lead': 'K-means++ groups residents by seven lifestyle answers. The map is a 2D projection (PCA) of those answers: close dots mean similar habits.',
  'types.k': 'Number of types (k)', 'types.auto': 'auto (elbow)', 'types.size': '{n} residents',
  'types.interests': 'Common interests', 'types.traits': 'Stands out by', 'types.smokers': '{n}% smoke',
  'types.elbow': 'Choosing k', 'types.inertia': 'Inertia (elbow)', 'types.silhouette': 'Silhouette',
  'types.quality': 'Silhouette {s}; matches hidden archetypes: ARI {a}',
  'types.pca': 'PCA explains {v}% of variance',
  'type.quiet_scholar': 'Quiet scholar', 'type.night_owl': 'Night owl', 'type.early_bird': 'Early bird',
  'type.social_butterfly': 'Social butterfly', 'type.easygoing': 'Easygoing',
  'type.quiet_scholar.d': 'Early to bed, tidy, studies in the room and values silence.',
  'type.night_owl.d': 'Comes alive after midnight, relaxed about mess and noise.',
  'type.early_bird.d': 'Up at six, sporty, tidy and practical.',
  'type.social_butterfly.d': 'Friends over all the time, loud evenings, rarely studies at home.',
  'type.easygoing.d': 'Middle of the road on everything — easy to live with.',

  'pair.title': 'Compare two residents', 'pair.lead': 'See exactly how the fuzzy system reasons about a pair: memberships, fired rules and the final score.',
  'pair.a': 'First resident', 'pair.b': 'Second resident', 'pair.score': 'Compatibility',
  'pair.true': 'Simulated real satisfaction: {n}', 'pair.sameRoom': 'They already share a room',
  'pair.habits': 'Habits side by side', 'pair.reasons': 'In plain words', 'pair.trace': 'Fuzzy inference trace',
  'pair.memberships': 'How each difference is perceived', 'pair.rules': 'Rules that fired',
  'pair.output': 'Aggregated output and centroid', 'pair.if': 'if', 'pair.then': 'then', 'pair.and': 'and',
  'pair.strength': 'strength', 'pair.random': 'Random pair', 'pair.goodPair': 'Show a great pair',

  'term.small': 'small', 'term.medium': 'medium', 'term.large': 'large',
  'term.very_low': 'very low', 'term.low': 'low', 'term.high': 'high', 'term.very_high': 'very high',
  'in.sleep_diff': 'bedtime difference', 'in.clean_diff': 'tidiness difference',
  'in.noise_conflict': 'noise conflict', 'in.social_diff': 'sociability difference',
  'in.same_language': 'same language', 'in.interest_sim': 'shared interests', 'in.smoker_mismatch': 'smoker vs non-smoker',
  'out': 'compatibility',

  'f.bedtime': 'Bedtime', 'f.wake_time': 'Wake-up', 'f.cleanliness': 'Tidiness', 'f.noise_tolerance': 'Noise tolerance',
  'f.guests': 'Guests', 'f.study_in_room': 'Studies in room', 'f.social': 'Sociability',

  'r.sleep_close': 'Both go to bed around the same time ({a} and {b})',
  'r.sleep_far': 'Very different bedtimes ({a} vs {b})',
  'r.clean_close': 'Similar ideas about tidiness', 'r.clean_far': 'Very different standards of tidiness',
  'r.noise_ok': 'Neither will be bothered by the other’s guests or noise',
  'r.noise_conflict': 'One brings guests, the other needs quiet',
  'r.social_close': 'Similar energy — both {x}', 'r.social_far': 'Introvert meets extrovert',
  'r.social_close.x': 'equally sociable',
  'r.same_language': 'Same everyday language ({lang})', 'r.shared_interests': 'Shared interests: {items}',
  'r.smoker_mismatch': 'One smokes, the other doesn’t',
  'lang.kk': 'Kazakh', 'lang.ru': 'Russian', 'lang.en': 'English',

  'student.title': 'Resident profile', 'student.room': 'Room {id}', 'student.satisfaction': 'Satisfaction with roommates',
  'student.roommates': 'Roommates', 'student.matches': 'Best possible matches', 'student.swaps': 'Swap market',
  'student.swaps.d': 'Swaps that make this resident happier without hurting anyone much.',
  'student.swaps.none': 'No swap would improve things — this room is already a good fit.',
  'student.swap': 'Swap', 'student.gainSelf': '+{n} for this resident', 'student.gainOther': '{n} for {name}',
  'student.swapped': 'Swapped. New room: {id}', 'student.friend': 'Moved in together with a friend',

  'survey.title': 'Find your roommates', 'survey.step': 'Question {i} of {n}', 'survey.next': 'Next', 'survey.back': 'Back',
  'survey.finish': 'See my type', 'survey.name': 'What should we call you?', 'survey.namePh': 'e.g. Aruzhan',
  'survey.gender': 'Which floor do you live on?', 'survey.bedtime': 'When do you usually go to sleep?',
  'survey.wake': 'And when do you wake up?', 'survey.clean': 'How tidy do you keep your space?',
  'survey.clean.1': 'Creative chaos', 'survey.clean.5': 'Everything in its place',
  'survey.noise': 'How much does noise bother you?', 'survey.noise.1': 'I need silence', 'survey.noise.5': 'I can sleep through a concert',
  'survey.guests': 'How often do friends come over?', 'survey.guests.1': 'Almost never', 'survey.guests.5': 'Nearly every day',
  'survey.study': 'Where do you study?', 'survey.study.1': 'Library or café', 'survey.study.5': 'Always in my room',
  'survey.social': 'Introvert or extrovert?', 'survey.social.1': 'Introvert', 'survey.social.5': 'Extrovert',
  'survey.smoke': 'Do you smoke?', 'survey.yes': 'Yes', 'survey.no': 'No',
  'survey.lang': 'Which language do you speak most at home?',
  'survey.about': 'Tell us a little about yourself', 'survey.aboutHint': 'Hobbies help us find shared interests. Any language works.',
  'survey.aboutPh': 'Маған шахмат пен аниме ұнайды…',
  'survey.passport': 'Your resident passport', 'survey.youAre': 'You are', 'survey.matches': 'People you’d get along with',
  'survey.moveIn': 'Move in', 'survey.moved': 'Welcome! You’ve been placed in room {room} (match {score}).',
  'survey.again': 'Fill in again', 'survey.seeRoom': 'See my room',

  'lab.title': 'Lab', 'lab.lead': 'Experiments behind the system: compare assignment methods, watch simulated annealing work, and let the system learn from feedback.',
  'lab.tab.compare': 'Compare methods', 'lab.tab.sa': 'Annealing live', 'lab.tab.learn': 'Learning',
  'lab.compare.run': 'Run comparison', 'lab.compare.d': 'Every method on the same residents, averaged over {n} random seeds. “Real” numbers come from a hidden satisfaction model the algorithms never see.',
  'lab.col.method': 'Method', 'lab.col.mean': 'Mean', 'lab.col.worst': 'Worst 10%', 'lab.col.conflict': 'Conflict %',
  'lab.col.trueMean': 'Real mean', 'lab.col.trueWorst': 'Real worst 10%', 'lab.col.time': 'Time',
  'lab.sa.run': 'Run annealing', 'lab.sa.iter': 'Iterations', 'lab.sa.d': 'Starting from the greedy solution, the algorithm swaps residents. Early on (high temperature) it accepts worse moves to escape local optima; as it cools it only keeps improvements.',
  'lab.sa.temperature': 'temperature', 'lab.sa.mean': 'mean', 'lab.sa.worst': 'worst 10%',
  'lab.sa.stats': '{acc} accepted moves, {imp} improvements, {s} s',
  'lab.learn.run': 'Learn from feedback', 'lab.learn.d': '{n} pairs of last year’s residents rated each other from 1 to 5. A pair with rating ≤ 2 counts as a conflict.',
  'lab.learn.importance': 'What actually causes conflicts', 'lab.learn.importance.d': 'Random-forest feature importance. The hand-written fuzzy rules assumed tidiness matters most — the data disagree.',
  'lab.learn.ga': 'Genetic algorithm tuning the fuzzy rules', 'lab.learn.ga.d': 'Fitness = correlation between the fuzzy score and real ratings.',
  'lab.learn.best': 'best', 'lab.learn.avg': 'population mean', 'lab.learn.gen': 'generation',
  'lab.learn.models': 'Predicting conflicts (test set)', 'lab.learn.model': 'Model',
  'lab.learn.baseline': 'Always “no conflict”', 'lab.learn.tree': 'Decision tree', 'lab.learn.forest': 'Random forest',
  'lab.learn.corr': 'Correlation with real ratings (test)', 'lab.learn.before': 'hand-written', 'lab.learn.after': 'after GA',
  'lab.learn.apply': 'Use tuned rules and reassign', 'lab.learn.applied': 'Tuned rules are in use',
  'lab.learn.reset': 'Back to hand-written rules', 'lab.learn.effect': 'Effect on real satisfaction',
  'lab.learn.treeRules': 'Decision tree', 'lab.learn.conflictP': 'conflict {p}%',
  'lab.data': 'Data', 'lab.data.d': 'Generate a fresh synthetic dormitory or upload your own survey as CSV.',
  'lab.data.n': 'Students', 'lab.data.generate': 'Generate', 'lab.data.upload': 'Upload CSV',
}

const ru = {
  'app.tagline': 'Соседи по привычкам',
  'nav.home': 'Обзор', 'nav.survey': 'Анкета', 'nav.dorm': 'Карта общежития', 'nav.types': 'Типы жильцов',
  'nav.pair': 'Сравнить двоих', 'nav.lab': 'Лаборатория',
  'theme.dark': 'Тёмная тема', 'theme.light': 'Светлая тема', 'lang': 'Язык',

  'common.loading': 'Загрузка…', 'common.retry': 'Повторить', 'common.students': 'студентов',
  'common.rooms': 'комнат', 'common.beds': 'мест', 'common.floor': 'Этаж', 'common.room': 'Комната',
  'common.close': 'Закрыть', 'common.search': 'Поиск по имени', 'common.run': 'Запустить',
  'common.running': 'Считаем…', 'common.female': 'Девушки', 'common.male': 'Парни', 'common.smoking': 'Комната для курящих',
  'common.year': '{n} курс', 'common.open': 'Открыть профиль', 'common.export': 'Скачать CSV',
  'common.noData': 'Пока пусто.', 'common.seconds': '{n} с', 'common.empty': 'Свободное место',
  'err.backend': 'Сервер не отвечает. Запустите бэкенд (uvicorn roommatch.api:app) и попробуйте снова.',

  'home.title': 'Соседи по привычкам, а не по алфавиту',
  'home.lead': 'RoomMatch читает короткую анкету, находит типы жильцов и расселяет всех так, чтобы «совы» не жили с «жаворонками». Каждое решение объясняется, а система учится на том, как жильцы оценивают соседей.',
  'home.ctaSurvey': 'Пройти анкету', 'home.ctaDorm': 'Открыть карту общежития',
  'home.liveCaption': 'Вживую: комнаты перестраиваются во время оптимизации',
  'home.how': 'Как назначается комната',
  'home.s1.t': 'Анкета', 'home.s1.d': 'Режим сна, аккуратность, гости, шум и пара слов о себе — на казахском, русском или английском.',
  'home.s2.t': 'Совместимость', 'home.s2.d': 'Нечёткая логика понимает, что «23:30 и 00:00» — почти одно и то же, и оценивает каждую пару от 0 до 100.',
  'home.s3.t': 'Типы жильцов', 'home.s3.d': 'K-means делит людей на типы, TF-IDF находит общие интересы в свободном тексте.',
  'home.s4.t': 'Комнаты', 'home.s4.d': 'Поиск с ограничениями гарантирует правила, а имитация отжига повышает удовлетворённость всех.',
  'home.s5.t': 'Обучение', 'home.s5.d': 'Через месяц жильцы оценивают соседей; дерево решений и генетический алгоритм перенастраивают систему.',
  'home.now': 'Общежитие сейчас',

  'kpi.students': 'Жильцов', 'kpi.mean': 'Средняя удовлетворённость', 'kpi.worst': 'Худшие 10%',
  'kpi.conflict': 'Риск конфликта', 'kpi.rooms': 'Комнат', 'kpi.real': 'Реальная удовлетворённость (симуляция)',

  'method.random': 'Случайно', 'method.greedy': 'Жадный CSP', 'method.annealing': 'CSP + отжиг',
  'method.fair_annealing': 'CSP + отжиг + справедливость',
  'method.random.d': 'Любое допустимое расселение — как без ИИ.',
  'method.greedy.d': 'Перебор с возвратом, MRV и forward checking, лучшая комната первой.',
  'method.annealing.d': 'Жадный старт, затем 25 тыс. обменов имитацией отжига.',
  'method.fair_annealing.d': 'То же, но никем не жертвуют ради среднего.',

  'dorm.title': 'Карта общежития', 'dorm.lead': 'Каждая плитка — комната, цвет показывает, насколько жильцы подходят друг другу. Нажмите на комнату, чтобы увидеть, кто там живёт и почему.',
  'dorm.method': 'Метод', 'dorm.fairness': 'Справедливость λ', 'dorm.reassign': 'Расселить заново',
  'dorm.replay': 'Повтор оптимизации', 'dorm.legend.low': 'конфликт', 'dorm.legend.high': 'идеально',
  'dorm.roomTitle': 'Комната {id}', 'dorm.roomScore': 'Совместимость комнаты', 'dorm.why': 'Почему вместе',
  'dorm.pickRoom': 'Выберите комнату на карте, чтобы увидеть жильцов.', 'dorm.done': 'Расселено за {s} с',
  'dorm.find': 'Найти студента', 'dorm.alone': 'Пока живёт один',

  'types.title': 'Типы жильцов', 'types.lead': 'K-means++ группирует жильцов по семи ответам о привычках. Карта — двумерная проекция (PCA): близкие точки означают похожий образ жизни.',
  'types.k': 'Число типов (k)', 'types.auto': 'авто (локоть)', 'types.size': '{n} жильцов',
  'types.interests': 'Частые интересы', 'types.traits': 'Отличается', 'types.smokers': '{n}% курят',
  'types.elbow': 'Выбор k', 'types.inertia': 'Инерция (локоть)', 'types.silhouette': 'Силуэт',
  'types.quality': 'Силуэт {s}; совпадение со скрытыми архетипами: ARI {a}',
  'types.pca': 'PCA объясняет {v}% дисперсии',
  'type.quiet_scholar': 'Тихий отличник', 'type.night_owl': 'Сова', 'type.early_bird': 'Жаворонок',
  'type.social_butterfly': 'Душа компании', 'type.easygoing': 'Лёгкий характер',
  'type.quiet_scholar.d': 'Рано ложится, аккуратен, учится в комнате и ценит тишину.',
  'type.night_owl.d': 'Оживает после полуночи, спокойно относится к беспорядку и шуму.',
  'type.early_bird.d': 'Встаёт в шесть, спортивный, аккуратный и практичный.',
  'type.social_butterfly.d': 'Друзья в гостях постоянно, шумные вечера, дома учится редко.',
  'type.easygoing.d': 'Во всём золотая середина — с ним легко ужиться.',

  'pair.title': 'Сравнить двух жильцов', 'pair.lead': 'Как именно нечёткая система рассуждает о паре: степени принадлежности, сработавшие правила и итоговая оценка.',
  'pair.a': 'Первый жилец', 'pair.b': 'Второй жилец', 'pair.score': 'Совместимость',
  'pair.true': 'Реальная удовлетворённость (симуляция): {n}', 'pair.sameRoom': 'Уже живут в одной комнате',
  'pair.habits': 'Привычки рядом', 'pair.reasons': 'Простыми словами', 'pair.trace': 'Ход нечёткого вывода',
  'pair.memberships': 'Как воспринимается каждая разница', 'pair.rules': 'Сработавшие правила',
  'pair.output': 'Агрегированный выход и центр тяжести', 'pair.if': 'если', 'pair.then': 'то', 'pair.and': 'и',
  'pair.strength': 'сила', 'pair.random': 'Случайная пара', 'pair.goodPair': 'Показать отличную пару',

  'term.small': 'малая', 'term.medium': 'средняя', 'term.large': 'большая',
  'term.very_low': 'очень низкая', 'term.low': 'низкая', 'term.high': 'высокая', 'term.very_high': 'очень высокая',
  'in.sleep_diff': 'разница во времени сна', 'in.clean_diff': 'разница в аккуратности',
  'in.noise_conflict': 'конфликт по шуму', 'in.social_diff': 'разница в общительности',
  'in.same_language': 'один язык', 'in.interest_sim': 'общие интересы', 'in.smoker_mismatch': 'курит / не курит',
  'out': 'совместимость',

  'f.bedtime': 'Отбой', 'f.wake_time': 'Подъём', 'f.cleanliness': 'Аккуратность', 'f.noise_tolerance': 'Терпимость к шуму',
  'f.guests': 'Гости', 'f.study_in_room': 'Учёба в комнате', 'f.social': 'Общительность',

  'r.sleep_close': 'Оба ложатся примерно в одно время ({a} и {b})',
  'r.sleep_far': 'Очень разное время отбоя ({a} и {b})',
  'r.clean_close': 'Похожие представления о порядке', 'r.clean_far': 'Совсем разные представления о порядке',
  'r.noise_ok': 'Гости и шум одного не помешают другому',
  'r.noise_conflict': 'Один зовёт гостей, другому нужна тишина',
  'r.social_close': 'Похожий темперамент — {x}', 'r.social_far': 'Интроверт и экстраверт',
  'r.social_close.x': 'одинаково общительны',
  'r.same_language': 'Общий язык в быту ({lang})', 'r.shared_interests': 'Общие интересы: {items}',
  'r.smoker_mismatch': 'Один курит, другой нет',
  'lang.kk': 'казахский', 'lang.ru': 'русский', 'lang.en': 'английский',

  'student.title': 'Профиль жильца', 'student.room': 'Комната {id}', 'student.satisfaction': 'Удовлетворённость соседями',
  'student.roommates': 'Соседи', 'student.matches': 'Лучшие возможные соседи', 'student.swaps': 'Биржа обмена',
  'student.swaps.d': 'Обмены, после которых этому жильцу станет лучше, а другим — почти не хуже.',
  'student.swaps.none': 'Обмены ничего не улучшат — комната уже подходит хорошо.',
  'student.swap': 'Обменять', 'student.gainSelf': '+{n} этому жильцу', 'student.gainOther': '{n} для {name}',
  'student.swapped': 'Готово. Новая комната: {id}', 'student.friend': 'Заселён вместе с другом',

  'survey.title': 'Найдите своих соседей', 'survey.step': 'Вопрос {i} из {n}', 'survey.next': 'Дальше', 'survey.back': 'Назад',
  'survey.finish': 'Узнать мой тип', 'survey.name': 'Как вас зовут?', 'survey.namePh': 'например, Аружан',
  'survey.gender': 'На каком этаже вы живёте?', 'survey.bedtime': 'Во сколько вы обычно ложитесь спать?',
  'survey.wake': 'А во сколько встаёте?', 'survey.clean': 'Насколько вы аккуратны?',
  'survey.clean.1': 'Творческий беспорядок', 'survey.clean.5': 'Всё на своих местах',
  'survey.noise': 'Насколько вам мешает шум?', 'survey.noise.1': 'Нужна тишина', 'survey.noise.5': 'Усну даже на концерте',
  'survey.guests': 'Как часто к вам приходят друзья?', 'survey.guests.1': 'Почти никогда', 'survey.guests.5': 'Почти каждый день',
  'survey.study': 'Где вы учитесь?', 'survey.study.1': 'В библиотеке или кафе', 'survey.study.5': 'Всегда в комнате',
  'survey.social': 'Интроверт или экстраверт?', 'survey.social.1': 'Интроверт', 'survey.social.5': 'Экстраверт',
  'survey.smoke': 'Вы курите?', 'survey.yes': 'Да', 'survey.no': 'Нет',
  'survey.lang': 'На каком языке вы чаще говорите дома?',
  'survey.about': 'Расскажите немного о себе', 'survey.aboutHint': 'Хобби помогают найти общие интересы. Писать можно на любом языке.',
  'survey.aboutPh': 'Люблю шахматы и аниме…',
  'survey.passport': 'Паспорт жильца', 'survey.youAre': 'Ваш тип', 'survey.matches': 'С кем вы поладите',
  'survey.moveIn': 'Заселиться', 'survey.moved': 'Добро пожаловать! Вы заселены в комнату {room} (совместимость {score}).',
  'survey.again': 'Заполнить заново', 'survey.seeRoom': 'Моя комната',

  'lab.title': 'Лаборатория', 'lab.lead': 'Эксперименты, на которых держится система: сравнение методов расселения, имитация отжига вживую и обучение на отзывах.',
  'lab.tab.compare': 'Сравнение методов', 'lab.tab.sa': 'Отжиг вживую', 'lab.tab.learn': 'Обучение',
  'lab.compare.run': 'Сравнить', 'lab.compare.d': 'Все методы на одних и тех же жильцах, среднее по {n} случайным запускам. «Реальные» значения считаются по скрытой модели удовлетворённости, которую алгоритмы не видят.',
  'lab.col.method': 'Метод', 'lab.col.mean': 'Среднее', 'lab.col.worst': 'Худшие 10%', 'lab.col.conflict': 'Конфликты %',
  'lab.col.trueMean': 'Реальное среднее', 'lab.col.trueWorst': 'Реальные худшие 10%', 'lab.col.time': 'Время',
  'lab.sa.run': 'Запустить отжиг', 'lab.sa.iter': 'Итераций', 'lab.sa.d': 'Начиная с жадного решения, алгоритм меняет жильцов местами. В начале (высокая температура) он принимает и ухудшения, чтобы выбраться из локальных оптимумов; остывая, оставляет только улучшения.',
  'lab.sa.temperature': 'температура', 'lab.sa.mean': 'среднее', 'lab.sa.worst': 'худшие 10%',
  'lab.sa.stats': 'принято ходов: {acc}, улучшений: {imp}, {s} с',
  'lab.learn.run': 'Обучиться на отзывах', 'lab.learn.d': '{n} пар прошлогодних жильцов оценили друг друга от 1 до 5. Оценка ≤ 2 считается конфликтом.',
  'lab.learn.importance': 'Что на самом деле вызывает конфликты', 'lab.learn.importance.d': 'Важность признаков по случайному лесу. Ручные нечёткие правила считали главным аккуратность — данные с этим не согласны.',
  'lab.learn.ga': 'Генетический алгоритм настраивает нечёткие правила', 'lab.learn.ga.d': 'Приспособленность = корреляция нечёткой оценки с реальными отзывами.',
  'lab.learn.best': 'лучшая', 'lab.learn.avg': 'средняя по популяции', 'lab.learn.gen': 'поколение',
  'lab.learn.models': 'Предсказание конфликтов (тестовая выборка)', 'lab.learn.model': 'Модель',
  'lab.learn.baseline': 'Всегда «без конфликта»', 'lab.learn.tree': 'Дерево решений', 'lab.learn.forest': 'Случайный лес',
  'lab.learn.corr': 'Корреляция с реальными оценками (тест)', 'lab.learn.before': 'ручные правила', 'lab.learn.after': 'после ГА',
  'lab.learn.apply': 'Применить и расселить заново', 'lab.learn.applied': 'Используются настроенные правила',
  'lab.learn.reset': 'Вернуть ручные правила', 'lab.learn.effect': 'Эффект на реальную удовлетворённость',
  'lab.learn.treeRules': 'Дерево решений', 'lab.learn.conflictP': 'конфликт {p}%',
  'lab.data': 'Данные', 'lab.data.d': 'Сгенерируйте новое общежитие или загрузите свою анкету в CSV.',
  'lab.data.n': 'Студентов', 'lab.data.generate': 'Сгенерировать', 'lab.data.upload': 'Загрузить CSV',
}

const kk = {
  'app.tagline': 'Әдетке қарай көршілер',
  'nav.home': 'Шолу', 'nav.survey': 'Сауалнама', 'nav.dorm': 'Жатақхана картасы', 'nav.types': 'Тұрғын түрлері',
  'nav.pair': 'Екеуін салыстыру', 'nav.lab': 'Зертхана',
  'theme.dark': 'Қараңғы тақырып', 'theme.light': 'Ашық тақырып', 'lang': 'Тіл',

  'common.loading': 'Жүктелуде…', 'common.retry': 'Қайталау', 'common.students': 'студент',
  'common.rooms': 'бөлме', 'common.beds': 'орын', 'common.floor': 'Қабат', 'common.room': 'Бөлме',
  'common.close': 'Жабу', 'common.search': 'Атымен іздеу', 'common.run': 'Іске қосу',
  'common.running': 'Есептелуде…', 'common.female': 'Қыздар', 'common.male': 'Ұлдар', 'common.smoking': 'Темекі шегетіндер бөлмесі',
  'common.year': '{n} курс', 'common.open': 'Профильді ашу', 'common.export': 'CSV жүктеу',
  'common.noData': 'Әзірге бос.', 'common.seconds': '{n} с', 'common.empty': 'Бос орын',
  'err.backend': 'Сервер жауап бермейді. Бэкендті іске қосып (uvicorn roommatch.api:app), қайталап көріңіз.',

  'home.title': 'Көршілер әліпби бойынша емес, әдетке қарай',
  'home.lead': 'RoomMatch қысқа сауалнаманы оқып, тұрғын түрлерін анықтайды және «жапалақтар» «торғайлармен» бірге тұрмайтындай етіп орналастырады. Әр шешім түсіндіріледі, ал жүйе тұрғындардың бір-бірін бағалауынан үйренеді.',
  'home.ctaSurvey': 'Сауалнамадан өту', 'home.ctaDorm': 'Жатақхана картасын ашу',
  'home.liveCaption': 'Тікелей: оңтайландыру кезінде бөлмелер қайта құрылуда',
  'home.how': 'Бөлме қалай беріледі',
  'home.s1.t': 'Сауалнама', 'home.s1.d': 'Ұйқы кестесі, ұқыптылық, қонақтар, шу және өзің туралы бірер сөз — қазақша, орысша немесе ағылшынша.',
  'home.s2.t': 'Үйлесімділік', 'home.s2.d': 'Анық емес логика «23:30 пен 00:00» дерлік бірдей екенін түсініп, әр жұпты 0-ден 100-ге дейін бағалайды.',
  'home.s3.t': 'Тұрғын түрлері', 'home.s3.d': 'K-means адамдарды түрлерге бөледі, TF-IDF еркін мәтіннен ортақ қызығушылықтарды табады.',
  'home.s4.t': 'Бөлмелер', 'home.s4.d': 'Шектеулермен іздеу ережелерді сақтайды, ал жасанды күйдіру барлығының қанағатын арттырады.',
  'home.s5.t': 'Оқыту', 'home.s5.d': 'Бір айдан кейін тұрғындар көршілерін бағалайды; шешім ағашы мен генетикалық алгоритм жүйені қайта баптайды.',
  'home.now': 'Жатақхана қазір',

  'kpi.students': 'Тұрғындар', 'kpi.mean': 'Орташа қанағат', 'kpi.worst': 'Ең нашар 10%',
  'kpi.conflict': 'Жанжал қаупі', 'kpi.rooms': 'Бөлмелер', 'kpi.real': 'Нақты қанағат (симуляция)',

  'method.random': 'Кездейсоқ', 'method.greedy': 'Ашкөз CSP', 'method.annealing': 'CSP + күйдіру',
  'method.fair_annealing': 'CSP + күйдіру + әділдік',
  'method.random.d': 'Кез келген рұқсат етілген орналастыру — ЖИ-сыз.',
  'method.greedy.d': 'MRV және forward checking бар кері қадамды іздеу, ең жақсы бөлме бірінші.',
  'method.annealing.d': 'Ашкөз бастама, содан кейін жасанды күйдірумен 25 мың алмасу.',
  'method.fair_annealing.d': 'Дәл солай, бірақ орташа үшін ешкім құрбан болмайды.',

  'dorm.title': 'Жатақхана картасы', 'dorm.lead': 'Әр тақта — бөлме, түсі тұрғындардың бір-біріне қаншалықты сай екенін көрсетеді. Кім тұратынын және неге екенін көру үшін бөлмені басыңыз.',
  'dorm.method': 'Әдіс', 'dorm.fairness': 'Әділдік λ', 'dorm.reassign': 'Қайта орналастыру',
  'dorm.replay': 'Оңтайландыруды қайталау', 'dorm.legend.low': 'жанжал', 'dorm.legend.high': 'тамаша',
  'dorm.roomTitle': '{id} бөлме', 'dorm.roomScore': 'Бөлме үйлесімділігі', 'dorm.why': 'Неге бірге',
  'dorm.pickRoom': 'Тұрғындарды көру үшін картадан бөлме таңдаңыз.', 'dorm.done': '{s} с ішінде орналастырылды',
  'dorm.find': 'Студентті табу', 'dorm.alone': 'Әзірге жалғыз тұрады',

  'types.title': 'Тұрғын түрлері', 'types.lead': 'K-means++ тұрғындарды әдет туралы жеті жауап бойынша топтайды. Карта — сол жауаптардың екі өлшемді проекциясы (PCA): жақын нүктелер ұқсас өмір салтын білдіреді.',
  'types.k': 'Түрлер саны (k)', 'types.auto': 'авто (шынтақ)', 'types.size': '{n} тұрғын',
  'types.interests': 'Жиі қызығушылықтар', 'types.traits': 'Ерекшелігі', 'types.smokers': '{n}% темекі шегеді',
  'types.elbow': 'k таңдау', 'types.inertia': 'Инерция (шынтақ)', 'types.silhouette': 'Силуэт',
  'types.quality': 'Силуэт {s}; жасырын архетиптермен сәйкестік: ARI {a}',
  'types.pca': 'PCA дисперсияның {v}%-ын түсіндіреді',
  'type.quiet_scholar': 'Тыныш оқушы', 'type.night_owl': 'Жапалақ', 'type.early_bird': 'Торғай',
  'type.social_butterfly': 'Көпшіл', 'type.easygoing': 'Жайбарақат',
  'type.quiet_scholar.d': 'Ерте жатады, ұқыпты, бөлмеде оқиды және тыныштықты бағалайды.',
  'type.night_owl.d': 'Түн ортасынан кейін сергиді, тәртіпсіздік пен шуға салқын қарайды.',
  'type.early_bird.d': 'Алтыда тұрады, спортшыл, ұқыпты және іскер.',
  'type.social_butterfly.d': 'Қонақтар үнемі, кештер шулы, үйде сирек оқиды.',
  'type.easygoing.d': 'Бәрінде орташа — бірге тұру оңай.',

  'pair.title': 'Екі тұрғынды салыстыру', 'pair.lead': 'Анық емес жүйе жұп туралы қалай ой қорытатынын көріңіз: тиістілік дәрежелері, іске қосылған ережелер және қорытынды баға.',
  'pair.a': 'Бірінші тұрғын', 'pair.b': 'Екінші тұрғын', 'pair.score': 'Үйлесімділік',
  'pair.true': 'Нақты қанағат (симуляция): {n}', 'pair.sameRoom': 'Бір бөлмеде тұрады',
  'pair.habits': 'Әдеттер қатар', 'pair.reasons': 'Қарапайым тілмен', 'pair.trace': 'Анық емес шығару барысы',
  'pair.memberships': 'Әр айырмашылық қалай қабылданады', 'pair.rules': 'Іске қосылған ережелер',
  'pair.output': 'Біріктірілген шығыс және ауырлық орталығы', 'pair.if': 'егер', 'pair.then': 'онда', 'pair.and': 'және',
  'pair.strength': 'күші', 'pair.random': 'Кездейсоқ жұп', 'pair.goodPair': 'Тамаша жұпты көрсету',

  'term.small': 'аз', 'term.medium': 'орташа', 'term.large': 'үлкен',
  'term.very_low': 'өте төмен', 'term.low': 'төмен', 'term.high': 'жоғары', 'term.very_high': 'өте жоғары',
  'in.sleep_diff': 'ұйқы уақытының айырмасы', 'in.clean_diff': 'ұқыптылық айырмасы',
  'in.noise_conflict': 'шу бойынша қайшылық', 'in.social_diff': 'көпшілдік айырмасы',
  'in.same_language': 'бір тіл', 'in.interest_sim': 'ортақ қызығушылық', 'in.smoker_mismatch': 'шегеді / шекпейді',
  'out': 'үйлесімділік',

  'f.bedtime': 'Ұйқыға жату', 'f.wake_time': 'Ояну', 'f.cleanliness': 'Ұқыптылық', 'f.noise_tolerance': 'Шуға төзімділік',
  'f.guests': 'Қонақтар', 'f.study_in_room': 'Бөлмеде оқу', 'f.social': 'Көпшілдік',

  'r.sleep_close': 'Екеуі де шамамен бір уақытта жатады ({a} және {b})',
  'r.sleep_far': 'Ұйқыға жату уақыты мүлде басқа ({a} және {b})',
  'r.clean_close': 'Тәртіп туралы түсінігі ұқсас', 'r.clean_far': 'Тәртіп туралы түсінігі мүлде басқа',
  'r.noise_ok': 'Бірінің қонағы мен шуы екіншісіне кедергі болмайды',
  'r.noise_conflict': 'Бірі қонақ шақырады, екіншісіне тыныштық керек',
  'r.social_close': 'Мінезі ұқсас — {x}', 'r.social_far': 'Интроверт пен экстраверт',
  'r.social_close.x': 'бірдей көпшіл',
  'r.same_language': 'Күнделікті тілі ортақ ({lang})', 'r.shared_interests': 'Ортақ қызығушылықтар: {items}',
  'r.smoker_mismatch': 'Бірі темекі шегеді, екіншісі жоқ',
  'lang.kk': 'қазақ тілі', 'lang.ru': 'орыс тілі', 'lang.en': 'ағылшын тілі',

  'student.title': 'Тұрғын профилі', 'student.room': '{id} бөлме', 'student.satisfaction': 'Көршілерге қанағат',
  'student.roommates': 'Көршілер', 'student.matches': 'Ең сәйкес көршілер', 'student.swaps': 'Алмасу биржасы',
  'student.swaps.d': 'Бұл тұрғынға жақсырақ болатын, ал басқаларға айтарлықтай зиян келтірмейтін алмасулар.',
  'student.swaps.none': 'Алмасу ештеңені жақсартпайды — бөлме онсыз да жақсы сай.',
  'student.swap': 'Алмасу', 'student.gainSelf': 'осы тұрғынға +{n}', 'student.gainOther': '{name} үшін {n}',
  'student.swapped': 'Дайын. Жаңа бөлме: {id}', 'student.friend': 'Досымен бірге орналастырылды',

  'survey.title': 'Көршілеріңді тап', 'survey.step': '{n} сұрақтың {i}-сі', 'survey.next': 'Әрі қарай', 'survey.back': 'Артқа',
  'survey.finish': 'Түрімді білу', 'survey.name': 'Есіміңіз кім?', 'survey.namePh': 'мысалы, Аружан',
  'survey.gender': 'Қай қабатта тұрасыз?', 'survey.bedtime': 'Әдетте қашан ұйықтайсыз?',
  'survey.wake': 'Ал қашан тұрасыз?', 'survey.clean': 'Қаншалықты ұқыптысыз?',
  'survey.clean.1': 'Шығармашылық ретсіздік', 'survey.clean.5': 'Бәрі өз орнында',
  'survey.noise': 'Шу сізге қаншалықты кедергі?', 'survey.noise.1': 'Тыныштық керек', 'survey.noise.5': 'Концертте де ұйықтаймын',
  'survey.guests': 'Достарыңыз қаншалықты жиі келеді?', 'survey.guests.1': 'Ешқашан дерлік', 'survey.guests.5': 'Күн сайын дерлік',
  'survey.study': 'Қайда оқисыз?', 'survey.study.1': 'Кітапханада не кафеде', 'survey.study.5': 'Әрқашан бөлмеде',
  'survey.social': 'Интроверт пе, экстраверт пе?', 'survey.social.1': 'Интроверт', 'survey.social.5': 'Экстраверт',
  'survey.smoke': 'Темекі шегесіз бе?', 'survey.yes': 'Иә', 'survey.no': 'Жоқ',
  'survey.lang': 'Үйде қай тілде жиі сөйлейсіз?',
  'survey.about': 'Өзіңіз туралы аздап айтыңыз', 'survey.aboutHint': 'Хоббилер ортақ қызығушылықты табуға көмектеседі. Кез келген тілде жазуға болады.',
  'survey.aboutPh': 'Маған шахмат пен аниме ұнайды…',
  'survey.passport': 'Тұрғын төлқұжаты', 'survey.youAre': 'Сіздің түріңіз', 'survey.matches': 'Кіммен тіл табысасыз',
  'survey.moveIn': 'Қоныстану', 'survey.moved': 'Қош келдіңіз! Сіз {room} бөлмесіне орналастырылдыңыз (үйлесімділік {score}).',
  'survey.again': 'Қайта толтыру', 'survey.seeRoom': 'Менің бөлмем',

  'lab.title': 'Зертхана', 'lab.lead': 'Жүйенің негізіндегі тәжірибелер: орналастыру әдістерін салыстыру, жасанды күйдіруді тікелей бақылау және пікірлерден үйрену.',
  'lab.tab.compare': 'Әдістерді салыстыру', 'lab.tab.sa': 'Күйдіру тікелей', 'lab.tab.learn': 'Оқыту',
  'lab.compare.run': 'Салыстыру', 'lab.compare.d': 'Барлық әдіс бірдей тұрғындарда, {n} кездейсоқ іске қосудың орташасы. «Нақты» мәндер алгоритмдер көрмейтін жасырын қанағат моделінен алынады.',
  'lab.col.method': 'Әдіс', 'lab.col.mean': 'Орташа', 'lab.col.worst': 'Нашар 10%', 'lab.col.conflict': 'Жанжал %',
  'lab.col.trueMean': 'Нақты орташа', 'lab.col.trueWorst': 'Нақты нашар 10%', 'lab.col.time': 'Уақыт',
  'lab.sa.run': 'Күйдіруді бастау', 'lab.sa.iter': 'Итерация', 'lab.sa.d': 'Ашкөз шешімнен бастап алгоритм тұрғындарды алмастырады. Басында (жоғары температура) жергілікті оптимумнан шығу үшін нашар қадамдарды да қабылдайды; суыған сайын тек жақсартуларды қалдырады.',
  'lab.sa.temperature': 'температура', 'lab.sa.mean': 'орташа', 'lab.sa.worst': 'нашар 10%',
  'lab.sa.stats': 'қабылданған қадам: {acc}, жақсарту: {imp}, {s} с',
  'lab.learn.run': 'Пікірлерден үйрену', 'lab.learn.d': 'Өткен жылғы тұрғындардың {n} жұбы бір-бірін 1-ден 5-ке дейін бағалады. ≤ 2 баға жанжал саналады.',
  'lab.learn.importance': 'Жанжалға шын мәнінде не себеп', 'lab.learn.importance.d': 'Кездейсоқ орман бойынша белгілердің маңыздылығы. Қолмен жазылған ережелер ұқыптылықты басты деп санаған — деректер келіспейді.',
  'lab.learn.ga': 'Генетикалық алгоритм анық емес ережелерді баптайды', 'lab.learn.ga.d': 'Бейімділік = анық емес баға мен нақты бағалардың корреляциясы.',
  'lab.learn.best': 'үздік', 'lab.learn.avg': 'популяция орташасы', 'lab.learn.gen': 'ұрпақ',
  'lab.learn.models': 'Жанжалды болжау (тест жиыны)', 'lab.learn.model': 'Модель',
  'lab.learn.baseline': 'Әрқашан «жанжал жоқ»', 'lab.learn.tree': 'Шешім ағашы', 'lab.learn.forest': 'Кездейсоқ орман',
  'lab.learn.corr': 'Нақты бағалармен корреляция (тест)', 'lab.learn.before': 'қолмен', 'lab.learn.after': 'ГА-дан кейін',
  'lab.learn.apply': 'Қолданып, қайта орналастыру', 'lab.learn.applied': 'Бапталған ережелер қолданыста',
  'lab.learn.reset': 'Қолмен жазылған ережелерге қайту', 'lab.learn.effect': 'Нақты қанағатқа әсері',
  'lab.learn.treeRules': 'Шешім ағашы', 'lab.learn.conflictP': 'жанжал {p}%',
  'lab.data': 'Деректер', 'lab.data.d': 'Жаңа жатақхана жасаңыз немесе өз сауалнамаңызды CSV ретінде жүктеңіз.',
  'lab.data.n': 'Студенттер', 'lab.data.generate': 'Жасау', 'lab.data.upload': 'CSV жүктеу',
}

const INTERESTS = {
  chess: ['chess', 'шахматы', 'шахмат'], football: ['football', 'футбол', 'футбол'],
  basketball: ['basketball', 'баскетбол', 'баскетбол'], volleyball: ['volleyball', 'волейбол', 'волейбол'],
  anime: ['anime', 'аниме', 'аниме'], gaming: ['video games', 'видеоигры', 'ойындар'],
  music: ['music', 'музыка', 'музыка'], guitar: ['guitar', 'гитара', 'гитара'], dombra: ['dombra', 'домбра', 'домбыра'],
  reading: ['books', 'книги', 'кітап'], programming: ['programming', 'программирование', 'бағдарламалау'],
  math: ['math', 'математика', 'математика'], gym: ['gym', 'спортзал', 'спортзал'], running: ['running', 'бег', 'жүгіру'],
  cooking: ['cooking', 'готовка', 'аспаздық'], movies: ['movies', 'фильмы', 'фильмдер'], travel: ['travel', 'путешествия', 'саяхат'],
  photography: ['photography', 'фотография', 'фотография'], drawing: ['drawing', 'рисование', 'сурет'],
  dance: ['dance', 'танцы', 'би'], startups: ['startups', 'стартапы', 'стартаптар'], hiking: ['hiking', 'походы', 'тау'],
  kpop: ['k-pop', 'k-pop', 'k-pop'], podcasts: ['podcasts', 'подкасты', 'подкасттар'], coffee: ['coffee', 'кофе', 'кофе'],
}
export const INTEREST_EMOJI = {
  chess: '♟️', football: '⚽', basketball: '🏀', volleyball: '🏐', anime: '🍥', gaming: '🎮', music: '🎧',
  guitar: '🎸', dombra: '🪕', reading: '📚', programming: '💻', math: '📐', gym: '🏋️', running: '🏃',
  cooking: '🍳', movies: '🎬', travel: '✈️', photography: '📷', drawing: '🎨', dance: '💃', startups: '🚀',
  hiking: '🏔️', kpop: '🎤', podcasts: '🎙️', coffee: '☕',
}

const DICTS = { en, ru, kk }
const LANG_INDEX = { en: 0, ru: 1, kk: 2 }
export const LANGS = [
  { code: 'kk', label: 'Қаз' },
  { code: 'ru', label: 'Рус' },
  { code: 'en', label: 'Eng' },
]

const I18nCtx = createContext(null)

function readStored(key, fallback) {
  try { return localStorage.getItem(key) || fallback } catch { return fallback }
}
function writeStored(key, value) {
  try { localStorage.setItem(key, value) } catch { /* storage unavailable */ }
}

export function I18nProvider({ children }) {
  const [lang, setLang] = useState(() => readStored('rm.lang', 'en'))
  useEffect(() => {
    writeStored('rm.lang', lang)
    document.documentElement.lang = lang
  }, [lang])
  const value = useMemo(() => {
    const dict = DICTS[lang] || en
    const t = (key, vars) => {
      let s = dict[key] ?? en[key] ?? key
      if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v)
      return s
    }
    const interest = (k) => (INTERESTS[k] ? INTERESTS[k][LANG_INDEX[lang]] : k)
    const typeName = (c) => (c ? t(`type.${c.key}`) + (c.variant ? ` ${c.variant + 1}` : '') : '')
    return { lang, setLang, t, interest, typeName }
  }, [lang])
  return <I18nCtx.Provider value={value}>{children}</I18nCtx.Provider>
}

export const useI18n = () => useContext(I18nCtx)
