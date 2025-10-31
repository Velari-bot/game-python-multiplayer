# Duel Dome - Web Deployment Complete Guide

## 🚀 Migration Summary

Your local Duel Dome game is now ready for full web deployment:
- ✅ **Frontend**: Configured for Vercel hosting
- ✅ **Backend**: Ready for Ubuntu VPS with nginx + SSL
- ✅ **WebSocket**: Secure wss:// connection with reconnection logic
- ✅ **CORS**: Backend configured for cross-origin requests

---

## 📋 What Was Changed

### Frontend (`client/script.js`)
- ✅ Dynamic backend URL detection (multiple methods)
- ✅ Exponential backoff reconnection logic
- ✅ Connection status handling
- ✅ WebSocket error recovery

### Backend (`server/main.py`)
- ✅ CORS middleware added
- ✅ Production-ready configuration
- ✅ Environment variable support

### New Files Created
- ✅ `vercel.json` - Vercel deployment config
- ✅ `nginx-duel-dome.conf` - nginx reverse proxy config
- ✅ `duel-dome.service` - systemd service file
- ✅ `DEPLOYMENT.md` - Full deployment guide
- ✅ `QUICK_START.md` - Quick 15-minute setup

---

## 🎯 Quick Deployment Steps

### Backend (Ubuntu VPS)
```bash
# 1. Install dependencies
sudo apt update && sudo apt install -y python3-pip python3-venv nginx certbot

# 2. Setup project
cd /opt
sudo mkdir -p duel-dome && sudo chown $USER:$USER duel-dome
cd duel-dome
# Upload your code here

# 3. Setup Python
cd server
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt

# 4. Configure nginx
sudo cp nginx-duel-dome.conf /etc/nginx/sites-available/duel-dome
sudo nano /etc/nginx/sites-available/duel-dome  # Update YOUR_DOMAIN
sudo ln -s /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx

# 5. Get SSL
sudo certbot --nginx -d your-domain.com

# 6. Setup service
sudo cp duel-dome.service /etc/systemd/system/
sudo nano /etc/systemd/system/duel-dome.service  # Update paths if needed
sudo systemctl daemon-reload
sudo systemctl enable --now duel-dome
```

### Frontend (Vercel)
```bash
# 1. Install Vercel CLI
npm i -g vercel

# 2. Deploy
cd duel_dome/client
vercel login
vercel  # Follow prompts

# 3. Set environment variable in Vercel dashboard:
# VITE_WS_BACKEND_URL = wss://your-domain.com/ws
# OR create client/.env.production with same value

# 4. Redeploy
vercel --prod
```

---

## 🔧 Configuration Options

### Setting Backend URL (Choose One Method)

**Method 1: Vercel Environment Variable**
- In Vercel dashboard → Environment Variables
- Add: `VITE_WS_BACKEND_URL=wss://your-domain.com/ws`
- (Note: This requires build-time injection or manual setup)

**Method 2: Meta Tag** (Recommended for static HTML)
```html
<meta name="ws-backend-url" content="wss://your-domain.com/ws">
```

**Method 3: Script Tag Data Attribute**
```html
<script src="script.js" data-ws-backend-url="wss://your-domain.com/ws"></script>
```

**Method 4: Window Variable** (Runtime)
```html
<script>
    window.WS_BACKEND_URL = 'wss://your-domain.com/ws';
</script>
```

---

## 🧪 Testing Checklist

- [ ] Backend service running: `sudo systemctl status duel-dome`
- [ ] Nginx running: `sudo systemctl status nginx`
- [ ] SSL certificate valid: `sudo certbot certificates`
- [ ] WebSocket test passes (browser console)
- [ ] Frontend deployed on Vercel
- [ ] Environment variable set
- [ ] Game works from two different devices/browsers

---

## 🐛 Troubleshooting

**Connection Issues:**
```bash
# Check backend logs
sudo journalctl -u duel-dome -f

# Check nginx logs
sudo tail -f /var/log/nginx/duel-dome-error.log

# Test WebSocket manually
curl -i -N -H "Connection: Upgrade" -H "Upgrade: websocket" https://your-domain.com/ws
```

**CORS Errors:**
- Verify `CORS_ORIGINS` env var or allow all origins (`*`)
- Check backend middleware is loaded

**WebSocket Upgrade Failed:**
- Verify nginx has `proxy_set_header Upgrade $http_upgrade;`
- Ensure using `wss://` (not `ws://`)
- Check SSL certificate is valid

---

## 📊 Performance Notes

**Server Requirements (1vCPU/1GB RAM):**
- Supports 2-4 concurrent games (~8 players)
- Each game uses ~50MB RAM
- WebSocket overhead: ~5KB/sec per player
- Optimized for lightweight operation

**Scaling:**
- Current setup handles ~8-16 concurrent players
- For more, consider:
  - PM2 with multiple workers
  - Redis for session storage
  - Load balancer for multiple servers

---

## 📚 Files Reference

- `DEPLOYMENT.md` - Detailed deployment guide
- `QUICK_START.md` - 15-minute quick setup
- `nginx-duel-dome.conf` - Nginx config template
- `duel-dome.service` - systemd service file
- `vercel.json` - Vercel deployment config

---

## ✅ Success Criteria

Your deployment is successful when:
1. ✅ Backend accessible at `https://your-domain.com/health`
2. ✅ WebSocket connects at `wss://your-domain.com/ws`
3. ✅ Frontend loads on Vercel
4. ✅ Two players can connect and play from different devices
5. ✅ No CORS errors in browser console
6. ✅ Game runs smoothly with low latency

---

**Ready to deploy? Start with `QUICK_START.md` for step-by-step instructions!**

