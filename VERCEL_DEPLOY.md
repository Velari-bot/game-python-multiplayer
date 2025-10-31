# 🚀 Vercel Frontend Deployment

## Quick Deploy to Vercel

### Option 1: Vercel CLI (Recommended)

```bash
# Install Vercel CLI globally
npm i -g vercel

# Navigate to client directory
cd duel_dome/client

# Login to Vercel
vercel login

# Deploy (first time)
vercel

# Follow prompts:
# - Set up? Yes
# - Link? Yes (create new project)
# - Directory? ./
# - Override? No

# Deploy to production
vercel --prod
```

### Option 2: Vercel Dashboard

1. Go to [vercel.com](https://vercel.com) and sign in
2. Click "Add New Project"
3. Import from GitHub:
   - Connect to: `Velari-bot/game-python-multiplayer`
   - Root Directory: `duel_dome/client`
   - Framework Preset: Other
4. Add Environment Variable:
   - Key: `VITE_WS_BACKEND_URL`
   - Value: `wss://YOUR_DOMAIN/ws` (replace with your backend domain)
5. Deploy!

### Option 3: GitHub Integration

1. Push code to GitHub (already done ✅)
2. Connect Vercel to GitHub
3. Select repository: `Velari-bot/game-python-multiplayer`
4. Configure:
   - Root Directory: `duel_dome/client`
   - Framework: Other
5. Add environment variable in Vercel dashboard
6. Deploy!

## 🔧 Configuration

### Method 1: Environment Variable (Vercel Dashboard)

1. Go to Project Settings → Environment Variables
2. Add:
   - **Key**: `VITE_WS_BACKEND_URL`
   - **Value**: `wss://YOUR_DOMAIN/ws`
   - **Environments**: Production, Preview, Development
3. Redeploy

### Method 2: Meta Tag (Edit index.html)

Before deploying, edit `client/index.html`:

```html
<meta name="ws-backend-url" content="wss://YOUR_DOMAIN/ws">
```

### Method 3: Script Tag (Edit index.html)

Before deploying, edit `client/index.html`:

```html
<script src="script.js" data-ws-backend-url="wss://YOUR_DOMAIN/ws"></script>
```

### Method 4: Runtime (Edit index.html)

Before deploying, edit `client/index.html`:

```html
<script>
    window.WS_BACKEND_URL = 'wss://YOUR_DOMAIN/ws';
</script>
```

## 📝 Recommended Setup

1. **Deploy backend first** (get your domain/SSL working)
2. **Get your backend URL**: `wss://your-domain.com/ws`
3. **Deploy frontend** with environment variable set
4. **Test connection** from Vercel URL

## 🧪 Testing

After deployment:

1. Open your Vercel URL
2. Open browser console (F12)
3. Check connection: Should see "Connecting to: wss://..."
4. Create game and test

## 🔄 Updating Frontend

```bash
# Make changes to client files
# Commit and push
git add client/
git commit -m "Update frontend"
git push

# Vercel will auto-deploy if connected to GitHub
# Or manually deploy:
cd client
vercel --prod
```

## 📋 Checklist

- [ ] Backend deployed and accessible
- [ ] Backend URL confirmed: `wss://your-domain.com/ws`
- [ ] Frontend deployed to Vercel
- [ ] Environment variable set in Vercel
- [ ] Connection test passes
- [ ] Game works from Vercel URL

---

**Ready?** Deploy your backend first, then deploy frontend with the backend URL!

