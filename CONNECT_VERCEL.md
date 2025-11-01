# 🌐 Connect Vercel Frontend to VPS Backend

## 🚨 CRITICAL ISSUE: Mixed Content

**Problem**: Vercel uses HTTPS (`https://game-python-multiplayer.vercel.app/`)  
**Your Backend**: HTTP only (`ws://45.77.145.57/ws`)  
**Result**: Browsers block HTTPS pages from connecting to insecure WebSocket (ws://)

## ✅ Solutions

### Option 1: Get SSL for Your Backend (RECOMMENDED)

**You need a domain name for this.**

1. **Get a free domain** (or use existing):
   - Freenom.com (free)
   - Namecheap.com (~$10/year)
   - Or use subdomain from existing domain

2. **Point domain to your VPS**:
   - Add A record: `api.dueldome.com` → `45.77.145.57`
   - Wait 5-10 minutes for DNS propagation

3. **Re-deploy backend with domain**:
   ```bash
   ssh linuxuser@45.77.145.57
   cd /opt/duel-dome
   git pull
   sudo bash deploy-backend.sh api.dueldome.com
   # Script will automatically get SSL certificate
   ```

4. **Update frontend**:
   ```html
   <!-- client/index.html line 149 -->
   <script>
       window.WS_BACKEND_URL = 'wss://api.dueldome.com/ws';
   </script>
   ```

5. **Redeploy Vercel**:
   ```bash
   cd duel_dome/client
   vercel --prod
   ```

**✅ Now everything is HTTPS/WSS and will work!**

---

### Option 2: Temporary Testing with HTTP

**For testing only, not production.**

You can access the HTTP version of your Vercel deployment:

1. **Find HTTP preview URL**:
   - Go to Vercel dashboard
   - Look for preview deployments
   - Some may use HTTP (rare)

2. **Or use local file**:
   ```bash
   # Update client/index.html with VPS backend
   # Open file:///Users/.../duel_dome/client/index.html
   ```

---

### Option 3: Self-Signed SSL (NOT Recommended)

This creates browser warnings but allows testing:

```bash
# On VPS
ssh linuxuser@45.77.145.57
cd /opt/duel-dome

# Generate self-signed cert
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
  -keyout /etc/nginx/ssl/duel-dome.key \
  -out /etc/nginx/ssl/duel-dome.crt \
  -subj "/CN=45.77.145.57"

# Update nginx config to use self-signed cert
# Then update frontend to use wss://45.77.145.57/ws
```

Browsers will show security warnings you'll need to accept.

---

## 🎯 RECOMMENDED PATH (Best Solution)

### Step 1: Get a Domain (5 minutes)

Go to Namecheap or Freenom and get a domain. Point it to `45.77.145.57`.

Example: `api.dueldome.com` → `45.77.145.57`

### Step 2: Deploy Backend with SSL (5 minutes)

```bash
ssh linuxuser@45.77.145.57
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh api.dueldome.com
# Script automatically gets SSL certificate
sudo systemctl status duel-dome
curl https://api.dueldome.com/health
```

### Step 3: Update Frontend (2 minutes)

```bash
# On your Mac
cd /Users/aidenbender/Desktop/multiplayer/duel_dome

# Edit client/index.html line 149:
# window.WS_BACKEND_URL = 'wss://api.dueldome.com/ws';
```

Or update with this command:
```bash
cat > temp_update.txt << 'EOF'
    <script>
        // Backend URL for Vercel deployment
        window.WS_BACKEND_URL = 'wss://api.dueldome.com/ws';
    </script>
EOF
```

### Step 4: Redeploy Vercel (1 minute)

```bash
cd duel_dome/client
vercel --prod
```

**Done!** Now https://game-python-multiplayer.vercel.app/ connects to wss://api.dueldome.com/ws securely.

---

## 🧪 Current Workaround (Testing Only)

If you want to test NOW without a domain:

### Use Local File with VPS Backend

1. **Frontend is already updated** to connect to `ws://45.77.145.57/ws`
2. **Open local file** instead of Vercel:
   ```
   file:///Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html
   ```
3. **This bypasses HTTPS** and allows ws:// connection

### Complete VPS Deployment

On your VPS, run:
```bash
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh 45.77.145.57
sudo systemctl status duel-dome
```

Then test from local file (not Vercel HTTPS).

---

## 📊 What's Working Now

✅ **Localhost**: Perfect (tested and working)  
✅ **GitHub**: All code pushed  
✅ **Vercel**: Frontend deployed  
✅ **VPS Backend**: Ready to deploy  

❌ **Connection**: Blocked by browser (HTTPS → ws:// mixed content)  

---

## 🎯 Your Two Choices

### Choice 1: Get Domain + SSL (Production Ready)
- Time: ~15 minutes
- Cost: Free (Freenom) or $10/year (Namecheap)
- Result: Fully secure, works everywhere
- **This is what you want for real deployment**

### Choice 2: Test with Local File
- Time: 2 minutes
- Cost: Free
- Result: Works for testing, not accessible publicly
- **Good for testing before buying domain**

---

## 🚀 Quick Commands for Choice 2 (Test Now)

**On VPS:**
```bash
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh 45.77.145.57
```

**On Your Mac:**
```bash
# Open local file in browser
open /Users/aidenbender/Desktop/multiplayer/duel_dome/client/index.html

# Test on another device:
# Open http://YOUR_MAC_IP:8000 after running:
cd /Users/aidenbender/Desktop/multiplayer/duel_dome/client
python3 -m http.server 8000
```

Both will connect to `ws://45.77.145.57/ws`!

---

**What do you want to do?**
1. Get a domain and make it fully secure? (I can guide you)
2. Test with local file first to verify VPS works?
