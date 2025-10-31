# 🔧 Fixed VPS Deployment - Copy These Commands

## ✅ Fixed Deployment Steps (Run on VPS)

### Quick Fix - Copy and Paste:

```bash
# SSH into VPS
ssh linuxuser@45.77.145.57

# Fix permissions and clone (all in one)
sudo rm -rf /opt/duel-dome 2>/dev/null || true
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .

# Run deployment script
chmod +x deploy-backend.sh
sudo bash deploy-backend.sh 45.77.145.57

# Or with domain (if you have one):
# sudo bash deploy-backend.sh your-domain.com
```

---

## 🏠 Localhost Testing Confirmation

**✅ YES, localhost still works perfectly!**

The deployment changes only affect:
- Production WebSocket URL detection (auto-detects when on VPS)
- Local development automatically uses `ws://localhost:3000/ws`

### Test Localhost Now:

```bash
# Terminal 1: Start server
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
./run.sh

# Terminal 2: Test health endpoint
curl http://localhost:3000/health

# Browser: Open client/index.html
# Should automatically connect to ws://localhost:3000/ws
```

### How It Works:

The client detects backend URL in this order:
1. ✅ Window variable: `window.WS_BACKEND_URL` (not set = uses localhost)
2. ✅ Meta tag: `<meta name="ws-backend-url">` (empty = uses localhost)
3. ✅ Script data attribute (not set = uses localhost)
4. ✅ **Default**: `ws://localhost:3000/ws` (for local dev)

**Since none of these are set locally, it defaults to localhost!**

---

## 📋 Complete VPS Deployment Commands

```bash
# Step 1: SSH in
ssh linuxuser@45.77.145.57

# Step 2: Clean setup
sudo rm -rf /opt/duel-dome
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome

# Step 3: Clone repo
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .

# Step 4: Deploy
chmod +x deploy-backend.sh
sudo bash deploy-backend.sh 45.77.145.57

# Step 5: Check status
sudo systemctl status duel-dome

# Step 6: Check logs
sudo journalctl -u duel-dome -f
```

---

## 🧪 Test After Deployment

```bash
# On VPS or from your local machine:
curl http://45.77.145.57/health

# Should return JSON:
# {"status":"ok","service":"duel-dome","connections":0,"players":0}
```

---

## ✅ Verification Checklist

- [ ] Server running: `sudo systemctl status duel-dome`
- [ ] Nginx running: `sudo systemctl status nginx`
- [ ] Health check works: `curl http://45.77.145.57/health`
- [ ] Localhost still works (test with `./run.sh`)
- [ ] Frontend can connect to backend

---

**All fixed! Localhost works, VPS deployment fixed!** 🚀

