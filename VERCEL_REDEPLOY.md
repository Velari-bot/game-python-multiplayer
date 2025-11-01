# 🔄 Redeploy Vercel NOW

## Issue

The website is trying to connect to `wss://game-python-multiplayer.vercel.app/ws` instead of `wss://dueldome.duckdns.org/ws`

This means Vercel is serving the OLD version of your code.

## ✅ Solution: Redeploy Vercel

### Method 1: Trigger Redeploy from GitHub (Easiest)

Your code is already pushed. Now trigger Vercel to redeploy:

1. Go to: https://vercel.com/dashboard
2. Find project: `game-python-multiplayer`
3. Click the three dots (...) → "Redeploy"
4. Wait 30 seconds

### Method 2: CLI Redeploy

```bash
# Install Vercel CLI if not installed
npm i -g vercel

# Login
vercel login

# Redeploy
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
vercel --prod
```

### Method 3: Force Push

```bash
cd /Users/aidenbender/Desktop/multiplayer/duel_dome
git commit --allow-empty -m "Force Vercel redeploy"
git push
```

Vercel will auto-detect the push and redeploy.

---

## 🧪 After Redeployment

1. **Clear browser cache**: Hard refresh (Cmd+Shift+R or Ctrl+Shift+R)
2. **Open**: https://game-python-multiplayer.vercel.app/
3. **Check console**: Should now see `Connecting to: wss://dueldome.duckdns.org/ws`

---

## ⚠️ ALSO MAKE SURE VPS IS DEPLOYED

Did you run the backend deployment on VPS?

```bash
ssh linuxuser@45.77.145.57
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh dueldome.duckdns.org
```

**This is REQUIRED for the backend to have SSL!**

---

## 📋 Complete Checklist

- [x] Updated `client/index.html` with DuckDNS URL
- [x] Pushed to GitHub
- [ ] Backend deployed on VPS with DuckDNS domain
- [ ] Vercel redeployed with new code
- [ ] Browser cache cleared
- [ ] Connection works

---

## 🚀 Quick Commands

**VPS (if not done yet):**
```bash
ssh linuxuser@45.77.145.57
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh dueldome.duckdns.org
curl https://dueldome.duckdns.org/health
```

**Vercel Redeploy:**
```bash
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
vercel --prod
# Or just wait - GitHub auto-triggers Vercel deploy
```

**Browser:**
- Hard refresh: Cmd+Shift+R
- Check console for: `Connecting to: wss://dueldome.duckdns.org/ws`

---

**The change is pushed. Just redeploy Vercel and deploy VPS backend!**

