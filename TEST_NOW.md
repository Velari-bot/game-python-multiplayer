# 🎮 TEST THE GAME NOW (HTTP Mode)

## ✅ Good News

Your backend IS working on HTTP!

Line 272-273 shows:
```json
{"status":"ok","service":"duel-dome","connections":0,"players":0,"match_active":false}
```

## 🎯 Test Game NOW (While Waiting for SSL)

Since Vercel HTTPS can't connect to HTTP WebSocket, test using local file:

### Method 1: Local File (Works Now)

```bash
# On your Mac
open /Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html
```

This will connect to `ws://45.77.145.57/ws` and work!

Open on 2 browsers/devices:
1. **Browser 1**: Click "Create Game" → Note the code
2. **Browser 2**: Click "Join Game" → Enter code
3. **Play!**

### Method 2: Serve Locally to Test on Phone

```bash
# On your Mac
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
python3 -m http.server 8000

# On your phone/tablet (same WiFi):
# Open: http://YOUR_MAC_IP:8000
# Find your Mac IP with: ipconfig getifaddr en0
```

---

## 🔒 Get SSL Working (Wait 10 Minutes)

DNS was created 2 minutes ago. Let's Encrypt needs time to see it globally.

**Wait 10 minutes**, then run on VPS:

```bash
# Test DNS propagation globally
nslookup dueldome.duckdns.org 8.8.8.8

# If shows 45.77.145.57, try SSL again:
sudo certbot --nginx -d dueldome.duckdns.org

# If successful, test:
curl https://dueldome.duckdns.org/health
```

Then update frontend:
```html
window.WS_BACKEND_URL = 'wss://dueldome.duckdns.org/ws';
```

And redeploy Vercel!

---

## ⚡ FASTEST PATH: Test HTTP Now

**Run on VPS** (line 271+):
```bash
# Backend is running - test HTTP
curl http://45.77.145.57/health
curl http://dueldome.duckdns.org/health
```

**Run on your Mac:**
```bash
# Test from outside
curl http://45.77.145.57/health

# Open local file
open /Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html
```

**Play the game!** It should work via HTTP right now!

---

## 🕐 Timeline

**NOW (0 min):**
- ✅ Backend running on HTTP
- ✅ Test via local file
- ❌ Vercel can't connect (HTTPS→ws:// blocked)

**+10 minutes:**
- ⏳ DNS fully propagated globally
- ⏳ Run certbot again for SSL
- ⏳ Update frontend to wss://
- ✅ Vercel works!

---

## 📋 Commands to Test NOW

**On VPS:**
```bash
# Verify HTTP works
curl http://45.77.145.57/health
curl http://dueldome.duckdns.org/health
```

**On your Mac:**
```bash
# Test from outside
curl http://45.77.145.57/health

# Play game
open /Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html
```

---

## ⏰ After 10 Minutes: Add SSL

```bash
# On VPS
sudo certbot --nginx -d dueldome.duckdns.org

# If successful:
curl https://dueldome.duckdns.org/health

# Then update frontend and redeploy Vercel
```

---

**The game works NOW on HTTP! Test it with local file while waiting for DNS to propagate globally.** 🚀

