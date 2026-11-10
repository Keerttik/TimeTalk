@echo off
echo Starting TimeTalk Backend on port 8000...
start cmd /k "cd backend && py -m uvicorn app.main:app --reload --port 8000"
echo Starting TimeTalk Frontend on port 5173...
start cmd /k "cd frontend && npm run dev"
echo TimeTalk services launched!
echo Open http://localhost:5173 in your browser.

