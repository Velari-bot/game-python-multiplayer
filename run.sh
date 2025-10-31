#!/bin/bash
# Run Duel Dome server using the parent directory's virtual environment

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/server"

# Try to find venv in parent directories
VENV_PYTHON="$SCRIPT_DIR/../.venv/bin/python"
if [ ! -f "$VENV_PYTHON" ]; then
    VENV_PYTHON="$(cd "$SCRIPT_DIR/../.." && pwd)/.venv/bin/python"
fi

if [ ! -f "$VENV_PYTHON" ]; then
    echo "Virtual environment not found at $VENV_PYTHON"
    echo "Please run ./setup.sh first or install dependencies manually."
    exit 1
fi

# Check if port 3000 is already in use
PORT=${PORT:-3000}
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1 ; then
    PID=$(lsof -Pi :$PORT -sTCP:LISTEN -t 2>/dev/null | head -1)
    echo "⚠️  Port $PORT is already in use by process $PID"
    echo ""
    echo "Options:"
    echo "  1. Kill the existing process: kill $PID"
    echo "  2. Use a different port: PORT=3001 ./run.sh"
    echo "  3. Kill and start: kill $PID && ./run.sh"
    echo ""
    read -p "Kill process $PID and start server? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        kill $PID 2>/dev/null || true
        sleep 1
    else
        echo "Exiting. Please free port $PORT or use a different port."
        exit 1
    fi
fi

echo "Starting Duel Dome server on port $PORT using $VENV_PYTHON"
PORT=$PORT "$VENV_PYTHON" main.py

