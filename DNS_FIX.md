# 🔧 DNS FIX - VPS Can't Resolve Domains

## Problem

Your VPS has DNS resolution issues:
```
nslookup dueldome.duckdns.org
;; no servers could be reached
```

This prevents:
- SSL certificate verification
- Domain lookups from VPS

## ✅ IMMEDIATE FIX: Use HTTP for Now

The backend service IS running! Test with HTTP:

```bash
# On VPS - Test with IP
curl http://45.77.145.57/health

# Should work and return JSON
```

Then update frontend to use HTTP temporarily:

```html
<!-- client/index.html -->
<script>
    window.WS_BACKEND_URL = 'ws://45.77.145.57/ws';
</script>
```

## 🔧 Fix DNS on VPS (Permanent Solution)

```bash
# On VPS
sudo nano /etc/resolv.conf

# Add these lines at the top:
nameserver 8.8.8.8
nameserver 8.8.4.4
nameserver 1.1.1.1

# Save and exit (Ctrl+X, Y, Enter)

# Make it persistent
sudo chattr +i /etc/resolv.conf

# Test DNS now
nslookup dueldome.duckdns.org
# Should show: Address: 45.77.145.57
```

## ⚡ After DNS Fix: Get SSL

```bash
# Re-run deployment
sudo bash deploy-backend.sh dueldome.duckdns.org

# Or manually:
sudo certbot --nginx -d dueldome.duckdns.org

# Test HTTPS
curl https://dueldome.duckdns.org/health
```

## 🎯 QUICK TEST NOW (HTTP)

The backend is already running on HTTP. Test it:

**On VPS:**
```bash
curl http://45.77.145.57/health
curl http://localhost:3000/health
```

**From your Mac:**
```bash
curl http://45.77.145.57/health
```

Should all return: `{"status":"ok",...}`

**From Vercel** (update frontend to use HTTP):
- Won't work because Vercel HTTPS → ws:// is blocked
- Need SSL for this to work

---

## 🚀 RECOMMENDED PATH

### Option 1: Fix DNS and Get SSL (Best)

```bash
# 1. Fix DNS on VPS
sudo bash -c 'echo -e "nameserver 8.8.8.8\nnameserver 8.8.4.4\nnameserver 1.1.1.1" > /etc/resolv.conf'

# 2. Test DNS
nslookup dueldome.duckdns.org

# 3. Get SSL certificate
sudo certbot --nginx -d dueldome.duckdns.org

# 4. Test HTTPS
curl https://dueldome.duckdns.org/health
```

### Option 2: Use HTTP Temporarily

Test the game works first with HTTP before fixing SSL:

**Update frontend:**
```html
window.WS_BACKEND_URL = 'ws://45.77.145.57/ws';
```

**Test from local file:**
```bash
open /Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html
```

This bypasses Vercel HTTPS and lets you test the backend!

---

## 📋 Commands to Run NOW on VPS

```bash
# Fix DNS
sudo bash -c 'echo -e "nameserver 8.8.8.8\nnameserver 8.8.4.4" > /etc/resolv.conf'

# Test DNS works
nslookup google.com
nslookup dueldome.duckdns.org

# Test HTTP backend (should work now)
curl http://45.77.145.57/health

# If DNS works, get SSL
sudo certbot --nginx -d dueldome.duckdns.org

# Test HTTPS
curl https://dueldome.duckdns.org/health
```

---

**Start with fixing DNS, then everything else will work!** 🚀

