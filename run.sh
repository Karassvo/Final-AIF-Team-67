#!/usr/bin/env bash
# One-command start: builds the frontend (first time) and serves everything on http://localhost:8000
set -e
cd "$(dirname "$0")"
if [ ! -d frontend/dist ]; then
  (cd frontend && npm install && npm run build)
fi
cd backend
python -m pip install -q -r requirements.txt
python -m uvicorn roommatch.api:app --port 8000
