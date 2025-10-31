# Quick Start - Web Deployment

## Prerequisites
- Ubuntu VPS (1vCPU/1GB RAM minimum)
- Domain name pointing to your VPS IP
- Vercel account (free tier works)

---

## Backend Setup (Ubuntu VPS) - 10 minutes

### 1. Install Dependencies
```bash
sudo apt update && sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx
```

### 2. Setup Project
```bash
cd /opt
sudo mkdir -p duel-dome && sudo chown $USER:$USER duel-dome
cd duel-dome

# Upload your code or git clone here
# Then:
cd server
python3 -m venv ../venv
source ../venv/bin/activate
pip install -r requirements.txt
```

### 3. Configure Nginx
```bash
# Copy nginx config
sudo cp nginx-duel-dome.conf /etc/nginx/sites-available/duel-dome

# Edit and update YOUR_DOMAIN
sudo nano /etc/nginx/sites-available/duel-dome
# Replace YOUR_DOMAIN with your actual domain

# Enable site
sudo ln -s /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

### 4. Get SSL Certificate
```bash
sudo certbot --nginx -d your-domain.com
# Follow prompts, use your email
```

### 5. Setup Systemd Service
```bash
# Update paths in duel-dome.service if needed
sudo cp duel-dome.service /etc/systemd/system/

# Edit if paths differ:
sudo nano /etc/systemd/system/duel-dome.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable duel-dome
sudo systemctl start duel-dome
sudo systemctl status duel-dome
```

### 6. Open Firewall
```bash
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
sudo ufw enable
```

---

## Frontend Setup (Vercel) - 5 minutes

### 1. Install Vercel CLI
```bash
npm i -g vercel
```

### 2. Deploy to Vercel
```bash
cd duel_dome/client
vercel login
vercel
# Follow prompts, answer:
# - Set up? Yes
# - Link? Yes (create new project)
# - Directory? ./
# - Override? No
```

### 3. Set Environment Variable
In Vercel dashboard:
1. Go to Project Settings → Environment Variables
2. Add:
   - Key: `VITE_WS_BACKEND_URL`
   - Value: `wss://your-domain.com/ws`
   - Environments: Production, Preview, Development
3. Redeploy

**OR** create `client/.env.production`:
```
VITE_WS_BACKEND_URL=wss://your-domain.com/ws
```

### 4. Redeploy
```bash
vercel --prod
```

---

## Testing

1. **Test Backend:**
   ```bash
   curl https://your-domain.com/health
   # Should return JSON
   ```

2. **Test WebSocket (browser console):**
   ```javascript
   const ws = new WebSocket('wss://your-domain.com/ws');
   ws.onopen = () => console.log('✅ Connected!');
   ws.onerror = (e) => console.error('❌ Error:', e);
   ```

3. **Test Full Game:**
   - Open Vercel URL on two devices
   - Create game on one, join on the other
   - Verify gameplay works

---

## Troubleshooting

**Connection refused:**
```bash
sudo systemctl status duel-dome  # Check service
sudo journalctl -u duel-dome -f  # Check logs
sudo systemctl status nginx      # Check nginx
```

**WebSocket upgrade failed:**
- Verify nginx config has `proxy_set_header Upgrade $http_upgrade;`
- Check SSL certificate is valid: `sudo certbot certificates`
- Ensure using `wss://` not `ws://`

**CORS errors:**
- Check backend has CORS middleware enabled
- Verify `allowed_origins` includes Vercel domain

---

## Files to Update Before Deploying

1. **nginx-duel-dome.conf**: Replace `YOUR_DOMAIN` with your domain
2. **duel-dome.service**: Update paths if different from `/opt/duel-dome`
3. **Vercel environment**: Set `VITE_WS_BACKEND_URL`

---

## Success Checklist

- [ ] Backend service running (`sudo systemctl status duel-dome`)
- [ ] Nginx configured and running (`sudo nginx -t`)
- [ ] SSL certificate installed (`sudo certbot certificates`)
- [ ] Frontend deployed on Vercel
- [ ] Environment variable set in Vercel
- [ ] WebSocket connection test passes
- [ ] Game works from two different devices

---

**Total time: ~15 minutes**

