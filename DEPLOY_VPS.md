# 🚀 VPS Deployment Instructions

## Quick Deploy to Your VPS (45.77.145.57)

### Option 1: One-Command Deploy (Recommended)

```bash
# SSH into your VPS
ssh linuxuser@45.77.145.57

# Run deployment script (replace YOUR_DOMAIN with your actual domain)
bash <(curl -sL https://raw.githubusercontent.com/Velari-bot/game-python-multiplayer/main/deploy-backend.sh) YOUR_DOMAIN

# Example with domain:
bash <(curl -sL https://raw.githubusercontent.com/Velari-bot/game-python-multiplayer/main/deploy-backend.sh) api.dueldome.com
```

### Option 2: Manual Deploy via SSH

```bash
# From your local machine, copy script to VPS
scp deploy-backend.sh linuxuser@45.77.145.57:~/

# SSH into VPS
ssh linuxuser@45.77.145.57

# Run the script
chmod +x deploy-backend.sh
sudo bash deploy-backend.sh YOUR_DOMAIN
```

### Option 3: Step-by-Step Manual Deploy

```bash
# 1. SSH into VPS
ssh linuxuser@45.77.145.57

# 2. Install dependencies
sudo apt update
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx git

# 3. Clone repository
sudo mkdir -p /opt/duel-dome
sudo chown $USER:$USER /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .

# 4. Setup Python environment
python3 -m venv venv
source venv/bin/activate
pip install -r server/requirements.txt

# 5. Configure nginx (replace YOUR_DOMAIN)
sudo nano nginx-duel-dome.conf  # Update YOUR_DOMAIN
sudo cp nginx-duel-dome.conf /etc/nginx/sites-available/duel-dome
sudo ln -s /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default  # Remove default
sudo nginx -t
sudo systemctl reload nginx

# 6. Setup SSL
sudo certbot --nginx -d YOUR_DOMAIN

# 7. Setup systemd service
sudo cp duel-dome.service /etc/systemd/system/
sudo nano /etc/systemd/system/duel-dome.service  # Update paths if needed
sudo systemctl daemon-reload
sudo systemctl enable --now duel-dome

# 8. Configure firewall
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## 🔒 Important: Security Note

⚠️ **You shared your SSH password publicly - please change it immediately!**

```bash
# On your VPS, change password:
passwd

# Better: Use SSH keys instead
# On your local machine:
ssh-copy-id linuxuser@45.77.145.57
```

## 📋 Post-Deployment Checklist

- [ ] Service is running: `sudo systemctl status duel-dome`
- [ ] Nginx is running: `sudo systemctl status nginx`
- [ ] SSL certificate valid: `sudo certbot certificates`
- [ ] Firewall configured: `sudo ufw status`
- [ ] WebSocket test passes (see below)
- [ ] Health check works: `curl https://YOUR_DOMAIN/health`

## 🧪 Testing

```bash
# Test health endpoint
curl https://YOUR_DOMAIN/health

# Test WebSocket (in browser console on any page)
const ws = new WebSocket('wss://YOUR_DOMAIN/ws');
ws.onopen = () => console.log('✅ Connected!');
ws.onerror = (e) => console.error('❌ Error:', e);
```

## 🔍 Troubleshooting

```bash
# Check service logs
sudo journalctl -u duel-dome -f

# Check nginx logs
sudo tail -f /var/log/nginx/duel-dome-error.log

# Restart service
sudo systemctl restart duel-dome

# Check service status
sudo systemctl status duel-dome
```

## 📝 Next Steps

1. **Get a domain name** (or use IP-based setup)
2. **Update nginx config** with your domain
3. **Get SSL certificate** with certbot
4. **Deploy frontend to Vercel** (see Vercel deployment guide)
5. **Update frontend** with your backend URL

---

**Need help?** Check `DEPLOYMENT.md` for detailed instructions.

