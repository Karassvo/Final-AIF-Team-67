@echo off
REM One-command start on Windows: http://localhost:8000
cd /d %~dp0
if not exist frontend\dist (
  cd frontend
  call npm install
  call npm run build
  cd ..
)
cd backend
python -m pip install -q -r requirements.txt
python -m uvicorn roommatch.api:app --port 8000
