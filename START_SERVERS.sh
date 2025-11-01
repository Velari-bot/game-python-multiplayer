#!/bin/bash
# Start all dev servers for Duel Dome

echo "🚀 Starting Duel Dome Servers..."
echo ""

# Kill any existing servers
lsof -ti:3000 | xargs kill -9 2>/dev/null
lsof -ti:8000 | xargs kill -9 2>/dev/null
sleep 1

# Start backend server
echo "1️⃣  Starting Backend (Port 3000)..."
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
./run.sh > /tmp/duel-dome-backend.log 2>&1 &
BACKEND_PID=$!
echo "   Backend PID: $BACKEND_PID"

sleep 3

# Start frontend server
echo "2️⃣  Starting Frontend (Port 8000)..."
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
python3 -m http.server 8000 > /tmp/duel-dome-frontend.log 2>&1 &
FRONTEND_PID=$!
echo "   Frontend PID: $FRONTEND_PID"

sleep 2

# Get WiFi IP
MY_IP=$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)

# Test servers
echo ""
echo "🧪 Testing servers..."
curl -s http://localhost:3000/health | python3 -m json.tool
echo ""

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ SERVERS RUNNING!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Status:"
echo "  Backend:  http://0.0.0.0:3000 (PID: $BACKEND_PID)"
echo "  Frontend: http://0.0.0.0:8000 (PID: $FRONTEND_PID)"
echo ""
echo "🎮 Play URLs:"
echo ""
echo "  THIS PC:"
echo "    http://localhost:8000"
echo ""
echo "  OTHER PC (same WiFi):"
echo "    http://$MY_IP:8000"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎯 To Stop Servers:"
echo "  kill $BACKEND_PID $FRONTEND_PID"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Opening browser..."
open http://localhost:8000
