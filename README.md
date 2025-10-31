# ⚔️ DUEL DOME - 2-Player Real-Time Arena Game

A fast-paced 2-player arena combat game built with Python FastAPI (WebSocket backend) and HTML5 Canvas (frontend).

## 🎮 Features

- ⚡ Real-time multiplayer combat (60Hz tick rate)
- 🎨 Neon-themed visual design
- 💥 Power-ups system (Speed, Double Shot, Shield, Invisibility, Ricochet)
- 🌪️ Arena events (Fast Mode, Reverse Gravity, Darkness, Shrink Zone)
- 🎯 Combo system (Perfect Dash, Chain Kills, Bullet Reflect)
- 📊 End-of-match stats
- 🏆 Sudden-death finale
- 🔊 Sound effects (Web Audio API)

## 🚀 Quick Start

### Local Development

```bash
# Backend
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Frontend
# Open client/index.html in browser
# Or serve with: python -m http.server 8000
```

### Web Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment guide or [QUICK_START.md](QUICK_START.md) for quick setup.

## 📁 Project Structure

```
duel_dome/
├── server/              # FastAPI backend
│   ├── main.py         # WebSocket server
│   ├── game.py         # Game logic
│   └── arena.py        # Arena events
├── client/             # Frontend
│   ├── index.html      # Main page
│   ├── style.css       # Styling
│   └── script.js       # Game client
├── DEPLOYMENT.md       # Deployment guide
├── QUICK_START.md      # Quick setup
└── deploy-backend.sh   # VPS deployment script
```

## 🛠️ Tech Stack

- **Backend**: Python 3.8+, FastAPI, WebSockets, Uvicorn
- **Frontend**: HTML5, Canvas API, JavaScript (ES6+)
- **Deployment**: Vercel (frontend), Ubuntu VPS + nginx (backend)

## 📖 Documentation

- [DEPLOYMENT.md](DEPLOYMENT.md) - Full deployment guide
- [QUICK_START.md](QUICK_START.md) - 15-minute quick setup
- [README_DEPLOYMENT.md](README_DEPLOYMENT.md) - Deployment summary

## 🎯 Gameplay

- **Movement**: WASD keys
- **Shoot**: SPACE
- **Dash**: SHIFT
- **Health**: 3 HP per player
- **Win**: First to 3 rounds

## 📝 License

MIT License - See LICENSE file for details

## 🤝 Contributing

Contributions welcome! Please open an issue or pull request.

---

**Ready to play?** Follow the deployment guide to get your game online!
