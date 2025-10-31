#!/bin/bash
# Setup script for Duel Dome

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR/server"

# Check for venv in parent directory
PARENT_VENV="$(cd "$SCRIPT_DIR/.." && pwd)/.venv"
if [ -d "$PARENT_VENV" ]; then
    echo "Using existing virtual environment at $PARENT_VENV"
    VENV_PYTHON="$PARENT_VENV/bin/python"
    VENV_PIP="$PARENT_VENV/bin/pip"
else
    echo "Creating new virtual environment at $PARENT_VENV..."
    python3 -m venv "$PARENT_VENV"
    VENV_PYTHON="$PARENT_VENV/bin/python"
    VENV_PIP="$PARENT_VENV/bin/pip"
fi

echo "Installing dependencies..."
"$VENV_PIP" install -r requirements.txt

echo ""
echo "Setup complete! Run the server with:"
echo "  cd $SCRIPT_DIR && ./run.sh"
echo ""
echo "Or manually:"
echo "  $VENV_PYTHON $SCRIPT_DIR/server/main.py"

