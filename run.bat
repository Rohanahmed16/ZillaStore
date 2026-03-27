@echo off
echo Starting ZILLA Store...

:: Check if virtual environment exists
if not exist ".venv\Scripts\activate.bat" (
    echo Virtual environment not found. Please set up the project first.
    pause
    exit /b 1
)

:: Activate the virtual environment
call .venv\Scripts\activate.bat

:: Automatically install requirements (quietly to avoid spam) if they are missing
echo Checking dependencies...
pip install -r backend\requirements.txt -q

:: Change to the backend directory where app.py lives
cd backend

:: Start the Flask application
echo Running the backend server...
python app.py

pause
