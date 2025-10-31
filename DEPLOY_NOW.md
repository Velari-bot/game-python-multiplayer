# ⚡ QUICK DEPLOYMENT - Run These Commands Now

## Step 1: Deploy Backend to VPS (5 minutes)

```bash
# SSH into your VPS
ssh linuxuser@45.77.145.57

# Run this command (replace YOUR_DOMAIN with your domain, or use IP)
bash <(curl -sL https://raw.githubusercontent.com/Velari-bot/game-python-multiplayer/main/deploy-backend.sh) YOUR_DOMAIN

# If you don't have a domain yet, you can use IP temporarily:
# First, get your server's public IP (should be 45.77.145.57)
# Then configure nginx manually without SSL for now
```

**Or manual deploy:**
```bash
ssh linuxuser@45.77.145.57
sudo mkdir -p /opt/duel-dome
cd /opt/duel-dome
git clone https://github.com/Velari-bot/game-python-multiplayer.git .
sudo bash deploy-backend.sh YOUR_DOMAIN
```

## Step 2: Update Frontend with Backend URL (2 minutes)

Edit `client/index.html` and add your backend URL:

```html
<!-- Line 8 - Add this: -->
<meta name="ws-backend-url" content="wss://YOUR_DOMAIN/ws">

<!-- OR line 149 - Uncomment and update: -->
<script>
    window.WS_BACKEND_URL = 'wss://YOUR_DOMAIN/ws';
</script>
```

**Commit the change:**
```bash
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
git add client/index.html
git commit -m "Update backend URL"
git push
```

## Step 3: Deploy Frontend to Vercel (3 minutes)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
vercel login
vercel
# Follow prompts

# Deploy to production
vercel --prod

# Set environment variable in Vercel dashboard:
# VITE_WS_BACKEND_URL = wss://YOUR_DOMAIN/ws
```

## Step 4: Test! (1 minute)

1. Open your Vercel URL
2. Open browser console (F12)
3. Should see: "Connecting to: wss://..."
4. Create a game and test!

---

## 🔒 CRITICAL: Change Your Password!

You shared your SSH password publicly. Change it immediately:

```bash
ssh linuxuser@45.77.145.57
passwd
# Enter new password
```

Better yet, use SSH keys:
```bash
# On your local machine:
ssh-copy-id linuxuser@45.77.145.57
```

---

## ✅ Quick Checklist

- [ ] Backend deployed to VPS
- [ ] Service running: `sudo systemctl status duel-dome`
- [ ] Nginx configured and SSL setup
- [ ] Frontend updated with backend URL
- [ ] Frontend deployed to Vercel
- [ ] Test connection works
- [ ] Password changed!

---

**Total time: ~10 minutes**

If you need help at any step, check:
- `DEPLOY_VPS.md` - Detailed VPS instructions
- `VERCEL_DEPLOY.md` - Detailed Vercel instructions
- `DEPLOYMENT.md` - Full deployment guide

