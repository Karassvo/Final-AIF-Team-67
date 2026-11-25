# Как выложить проект на GitHub (≈10 минут)

1. Один участник создаёт **пустой** репозиторий `roommatch` на github.com (без README) и добавляет остальных: Settings → Collaborators.
2. Он же загружает основу:
   ```bash
   cd roommatch
   git init
   git add README.md .gitignore .github run.sh run.bat data docs backend/requirements.txt backend/pytest.ini frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/index.html frontend/public
   git commit -m "Project skeleton, docs and data templates"
   git branch -M main
   git remote add origin https://github.com/<team>/roommatch.git
   git push -u origin main
   ```
3. Каждый участник клонирует репозиторий и **со своего аккаунта** добавляет свой модуль: сначала разобрать код, по возможности что-то улучшить, потом закоммитить.
   - Участник 1: `backend/roommatch/algorithms/fuzzy.py`, `backend/roommatch/features.py`, `frontend/src/pages/Pair.jsx`
   - Участник 2: `algorithms/clustering.py`, `algorithms/text.py`, `data/interests.py`, `frontend/src/pages/Survey.jsx`, `Types.jsx`, `i18n.jsx`
   - Участник 3: `algorithms/assignment.py`, `engine.py`, `models.py`, `frontend/src/pages/Dorm.jsx`, `components/`
   - Участник 4: `algorithms/learning.py`, `data/generator.py`, `data/ground_truth.py`, `api.py`, `tests/`, `experiments/`, `frontend/src/pages/Lab.jsx`, `Student.jsx`, `Home.jsx`, остальное из `frontend/src`
4. Проверка: вкладка **Actions** в GitHub должна быть зелёной (тесты + сборка фронтенда).
5. Видео лучше не класть в git (11 МБ): загрузите на YouTube (unlisted) или в GitHub Releases и вставьте ссылку в README.

Не подделывайте историю коммитов (чужие имена, задним числом): честная история плюс AI Usage Declaration выглядят лучше.
