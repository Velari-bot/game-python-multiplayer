# Duel Dome - Web Deployment Guide

## Migration Plan: Local → Web-Based

This guide migrates Duel Dome from local-only to fully web-based:
- **Frontend**: Vercel (Static Hosting)
- **Backend**: Ubuntu VPS (FastAPI + WebSocket)
- **Security**: wss:// with nginx reverse proxy

---

## Step 1: Update Frontend for Remote Backend

### 1.1 Update `client/script.js`

The client now connects to a configurable backend URL instead of localhost.

**Key Changes:**
- Environment-based backend URL detection
- WebSocket reconnection logic with exponential backoff
- Connection status indicators

### 1.2 Create `vercel.json` for Frontend

Deployment configuration for Vercel.

---

## Step 2: Update Backend for Production

### 2.1 Update `server/main.py`

**Key Changes:**
- Add CORS middleware
- Remove static file serving (handled by Vercel)
- Production-ready configuration

### 2.2 Create `systemd` service file

For running the backend as a service on Ubuntu VPS.

### 2.3 Create `nginx` configuration

Reverse proxy for secure WebSocket (wss://).

---

## Step 3: Deployment Steps

### 3.1 Backend (Ubuntu VPS)

1. **Install dependencies:**
   ```bash
   sudo apt update
   sudo apt install python3-pip python3-venv nginx certbot python3-certbot-nginx
   ```

2. **Clone/upload code to VPS:**
   ```bash
   cd /opt
   sudo mkdir -p duel-dome
   sudo chown $USER:$USER duel-dome
   # Upload your code here or git clone
   ```

3. **Setup Python environment:**
   ```bash
   cd /opt/duel-dome
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```

4. **Configure nginx:**
   - Copy `nginx-duel-dome.conf` to `/etc/nginx/sites-available/duel-dome`
   - Update `YOUR_DOMAIN` and paths
   - Enable site: `sudo ln -s /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/`
   - Test: `sudo nginx -t`
   - Reload: `sudo systemctl reload nginx`

5. **Setup SSL (Let's Encrypt):**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

6. **Setup systemd service:**
   - Copy `duel-dome.service` to `/etc/systemd/system/`
   - Update paths in the service file
   - Enable and start:
     ```bash
     sudo systemctl daemon-reload
     sudo systemctl enable duel-dome
     sudo systemctl start duel-dome
     sudo systemctl status duel-dome
     ```

### 3.2 Frontend (Vercel)

1. **Install Vercel CLI:**
   ```bash
   npm i -g vercel
   ```

2. **Deploy:**
   ```bash
   cd duel_dome/client
   vercel login
   vercel --prod
   ```

3. **Set environment variable:**
   - In Vercel dashboard → Project Settings → Environment Variables
   - Add: `VITE_WS_BACKEND_URL=wss://your-domain.com`
   - Redeploy

4. **Or use `.env.production`:**
   Create `client/.env.production`:
   ```
   VITE_WS_BACKEND_URL=wss://your-domain.com
   ```

---

## Step 4: Testing

### 4.1 Test WebSocket Connection

Open browser console on your Vercel-deployed frontend:
```javascript
const ws = new WebSocket('wss://your-domain.com/ws');
ws.onopen = () => console.log('Connected!');
ws.onerror = (e) => console.error('Error:', e);
```

### 4.2 Test from Different Device

1. Open your Vercel URL on a phone/tablet
2. Create a game room
3. Join from another device
4. Verify gameplay works

---

## Step 5: Firewall & Security

### 5.1 Ubuntu Firewall (ufw)

```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

### 5.2 VPS Security

- Disable root SSH login
- Use SSH keys
- Keep system updated

---

## Troubleshooting

### Connection Refused
- Check backend is running: `sudo systemctl status duel-dome`
- Check nginx: `sudo systemctl status nginx`
- Check firewall: `sudo ufw status`
- Check logs: `sudo journalctl -u duel-dome -f`

### WebSocket Upgrade Failed
- Verify nginx config has `proxy_set_header Upgrade $http_upgrade;`
- Check SSL certificate is valid
- Verify wss:// protocol (not ws://)

### CORS Errors
- Verify backend has CORS middleware enabled
- Check `allowed_origins` includes your Vercel domain

---

## Files Modified/Created

### Modified:
- `client/script.js` - Remote backend connection
- `server/main.py` - CORS + production config

### Created:
- `vercel.json` - Vercel deployment config
- `nginx-duel-dome.conf` - Nginx reverse proxy
- `duel-dome.service` - Systemd service file
- `DEPLOYMENT.md` - This file

---

## Performance Notes

**Server Requirements (1vCPU/1GB RAM):**
- Supports 2-4 concurrent games (~8 players)
- Each game uses ~50MB RAM
- WebSocket overhead: ~5KB/sec per player
- Optimized for lightweight operation

**Scaling Tips:**
- Use PM2 or similar for multi-process
- Consider Redis for session storage if scaling
- Monitor with `htop` and `nginx -T`

