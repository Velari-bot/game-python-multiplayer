# 🔧 Fix VPS Deployment - Run These Commands NOW

## Issue: Nginx config expects SSL certificates that don't exist

Since you're using an IP (45.77.145.57) instead of a domain, you can't get SSL certificates. We need to use HTTP-only config.

## ✅ Quick Fix Commands (Run on VPS)

```bash
# You're already SSH'd in and at /opt/duel-dome, so run:

# Pull latest changes (includes HTTP-only nginx config)
git pull

# Re-run deployment with updated script
sudo bash deploy-backend.sh 45.77.145.57
```

That's it! The script now detects IP addresses and uses HTTP-only config.

---

## What Changed

The deployment script now:
- ✅ Detects if you're using IP vs domain
- ✅ Uses `nginx-duel-dome-http.conf` for IPs (no SSL)
- ✅ Uses `nginx-duel-dome.conf` for domains (with SSL)
- ✅ Skips certbot when using IP

---

## After Deployment

### 1. Check Service Status
```bash
sudo systemctl status duel-dome
```

Should show:
```
● duel-dome.service - Duel Dome FastAPI WebSocket Server
   Loaded: loaded (/etc/systemd/system/duel-dome.service; enabled)
   Active: active (running)
```

### 2. Test Health Endpoint
```bash
curl http://45.77.145.57/health
```

Should return:
```json
{"status":"ok","service":"duel-dome","connections":0,"players":0}
```

### 3. Test WebSocket
```bash
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" -H "Sec-WebSocket-Version: 13" -H "Sec-WebSocket-Key: test" http://45.77.145.57/ws
```

Should show:
```
HTTP/1.1 101 Switching Protocols
```

---

## Update Frontend

Since you're using HTTP (not HTTPS), update `client/index.html`:

```html
<!-- Line 8 - Update to: -->
<meta name="ws-backend-url" content="ws://45.77.145.57/ws">
```

**OR** uncomment line 149:
```html
<script>
    window.WS_BACKEND_URL = 'ws://45.77.145.57/ws';
</script>
```

Commit and push:
```bash
# On your local machine
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
git add client/index.html
git commit -m "Update backend URL to VPS IP"
git push
```

---

## Deploy Frontend to Vercel

```bash
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
vercel login
vercel
# Follow prompts
vercel --prod
```

Set environment variable in Vercel dashboard:
- Key: `WS_BACKEND_URL`
- Value: `ws://45.77.145.57/ws`

---

## ✅ Localhost Still Works

**YES!** Localhost is completely unaffected.

Test it:
```bash
# On your Mac
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
./run.sh

# Open client/index.html in browser
# Automatically connects to ws://localhost:3000/ws
```

---

## 🔒 Security Note

**Using HTTP (ws://) is NOT secure for production.** For production, you should:

1. Get a domain name (e.g., `api.dueldome.com`)
2. Point it to your VPS IP (45.77.145.57)
3. Re-run deployment with domain: `sudo bash deploy-backend.sh api.dueldome.com`
4. Script will automatically get SSL certificate (HTTPS/WSS)

But for testing, HTTP works fine!

---

## Quick Summary

**On VPS (run now):**
```bash
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh 45.77.145.57
sudo systemctl status duel-dome
curl http://45.77.145.57/health
```

**Localhost (still works):**
```bash
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
./run.sh
# Open client/index.html
```

**Frontend update:**
```html
<meta name="ws-backend-url" content="ws://45.77.145.57/ws">
```

---

Everything is fixed and ready to go! 🚀

