# 🔧 Fixed Deployment Instructions

## Issue: Permission Denied

The directory was created with `sudo` but you're cloning as a regular user. Here's the fix:

## ✅ Correct Deployment Steps

### Step 1: Fix Permissions and Clone

```bash
# SSH into VPS
ssh linuxuser@45.77.145.57

# Create directory with proper permissions
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome

# Now clone (as regular user)
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .

# Or if directory already exists with wrong permissions:
sudo rm -rf /opt/duel-dome
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .
```

### Step 2: Run Deployment Script

```bash
# Make script executable
chmod +x deploy-backend.sh

# Run with sudo (script handles user permissions correctly)
sudo bash deploy-backend.sh YOUR_DOMAIN

# Or if you don't have a domain yet, use IP (without SSL):
sudo bash deploy-backend.sh 45.77.145.57
```

### Step 3: If No Domain (Use IP Only)

If you don't have a domain, we'll need to modify nginx config:

```bash
# After cloning, edit nginx config
cd /opt/duel-dome
sudo nano nginx-duel-dome.conf

# Change:
# server_name YOUR_DOMAIN;
# To:
# server_name 45.77.145.57;

# Then run deployment WITHOUT SSL first
sudo bash deploy-backend.sh 45.77.145.57
```

---

## 🏠 Localhost Still Works

**Yes, it still works on localhost!** 

The changes only affect:
1. **WebSocket connection URL detection** - Automatically detects backend URL
2. **Production deployment configs** - Only used on VPS

### Test Localhost:

```bash
# On your local machine
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
cd server
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
python main.py

# Then open client/index.html in browser
# It will automatically connect to ws://localhost:3000/ws
```

The client automatically detects:
- If no backend URL is set → uses `ws://localhost:3000/ws` (for local dev)
- If backend URL is set → uses that (for production)

---

## 🔧 Quick Fix for Your Current Situation

Run these commands on your VPS:

```bash
# Fix permissions and clone
sudo rm -rf /opt/duel-dome 2>/dev/null || true
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .

# Run deployment
chmod +x deploy-backend.sh
sudo bash deploy-backend.sh 45.77.145.57
```

---

## 📝 Complete Deployment Command Sequence

```bash
# On VPS
ssh linuxuser@45.77.145.57

# Setup and deploy
sudo rm -rf /opt/duel-dome 2>/dev/null || true
sudo mkdir -p /opt/duel-dome
sudo chown -R linuxuser:linuxuser /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .
chmod +x deploy-backend.sh

# Deploy (use your domain if you have one, or IP for now)
sudo bash deploy-backend.sh 45.77.145.57

# Or with domain:
# sudo bash deploy-backend.sh your-domain.com
```

---

**Localhost testing remains unchanged - everything still works locally!**

