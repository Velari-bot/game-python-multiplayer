# 🔧 IMMEDIATE FIX - Run This on VPS

## Problem Diagnosed

The deployment script tried to configure nginx with SSL **before** getting the SSL certificate. This fails because the certificate doesn't exist yet.

## ✅ FIX: Updated Deployment Script

I've fixed the script to:
1. First setup nginx with HTTP
2. Get SSL certificate
3. Then switch to HTTPS

## 📋 Run These Commands on VPS NOW

```bash
# Pull the fix
cd /opt/duel-dome
git pull

# Re-run deployment
sudo bash deploy-backend.sh dueldome.duckdns.org
```

**Wait for**: "✅ Deployment complete!"

Then test:
```bash
# Test HTTPS
curl https://dueldome.duckdns.org/health

# Should return: {"status":"ok","service":"duel-dome",...}
```

---

## 🔍 If DNS Not Resolving on VPS

If you see `Could not resolve host: dueldome.duckdns.org` on the VPS:

```bash
# Test DNS from VPS
nslookup dueldome.duckdns.org

# If fails, wait 2-3 minutes for DNS propagation
# DuckDNS can take 1-5 minutes to propagate
```

From your Mac, DNS is working (you got "Connection reset" not "Could not resolve").

---

## 🎯 Alternative: Manual SSL Setup

If the script still has issues, run manually:

```bash
# On VPS
cd /opt/duel-dome

# 1. Setup HTTP nginx first
sudo cp nginx-duel-dome-http.conf /etc/nginx/sites-available/duel-dome
sudo sed -i 's/YOUR_IP/dueldome.duckdns.org/g' /etc/nginx/sites-available/duel-dome
sudo ln -sf /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx

# 2. Get SSL certificate
sudo certbot --nginx -d dueldome.duckdns.org

# Follow prompts:
# - Email: your@email.com
# - Terms: Yes
# - Share email: No
# - Redirect HTTP to HTTPS: Yes

# 3. Start backend service
sudo systemctl daemon-reload
sudo systemctl enable duel-dome
sudo systemctl restart duel-dome

# 4. Test
curl https://dueldome.duckdns.org/health
```

---

## ✅ After Deployment Works

Test Vercel:

**https://client-gg7u7hsmx-velari-bots-projects.vercel.app/**

Should connect to `wss://dueldome.duckdns.org/ws` and work!

---

**Pull the updated script and run deployment again!** 🚀

