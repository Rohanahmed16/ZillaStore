#!/bin/bash
echo "Starting ZILLA Store..."

# Check if virtual environment exists
if [ ! -f ".venv/bin/activate" ]; then
    echo "Virtual environment not found. Please set up the project first:"
    echo "python3 -m venv .venv"
    exit 1
fi

# Activate the virtual environment
source .venv/bin/activate

# Automatically install requirements (quietly to avoid spam) if they are missing
echo "Checking dependencies..."
pip3 install -r backend/requirements.txt -q

# Change to the backend directory where app.py lives
cd backend || exit 1

# Start the Flask application
echo "Running the backend server..."
python3 app.py
