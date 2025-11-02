# 🎮 PLAY NOW - Simple Instructions

## ✅ Servers Running

Backend (PID 33552): Port 3000  
Frontend (PID 33725): Port 8000

## 🚨 IMPORTANT: Use Incognito Mode

Your browsers have cached old code that connects to VPS instead of local backend.

**Incognito mode bypasses all cache!**

---

## 📋 Step-by-Step (BOTH PCs)

### THIS PC (Your Mac):

1. **Press `Cmd+Shift+N`** (opens Incognito/Private window)
2. **Type in address bar**: `http://localhost:8000`
3. **Press Enter**
4. **Click "Create Game"**
5. **Wait** - you're Player 1

### OTHER PC:

1. **Press `Cmd+Shift+N`** (Mac) or `Ctrl+Shift+N`** (Windows)
2. **Type in address bar**: `http://172.16.0.71:8000`
3. **Press Enter**
4. **Click "Create Game"** (doesn't matter - joins same room)
5. **Wait** - you're Player 2

### After 2-3 Seconds:

**BOTH screens should show**:
- Player 1: ✅
- Player 2: ✅

**Click START MATCH** and play!

---

## 🔧 If Still Only Shows 1 Player

Check this terminal:
```bash
curl http://localhost:3000/health
```

Should show `"connections": 2` when both are connected.

If it shows `"connections": 0`, the browsers aren't connecting to local backend.

---

## 🎯 Why Incognito?

Normal browser tabs have **cached JavaScript** from when the config was set to VPS (`ws://45.77.145.57/ws`).

Incognito mode = **fresh load** = uses correct config (`ws://172.16.0.71:3000/ws`)

---

## ✅ Success Criteria

When working, you'll see in console:
```
Connecting to: ws://172.16.0.71:3000/ws
Connected! Player ID: ...
Updating lobby for 2 players
```

NOT:
```
Connecting to: ws://45.77.145.57/ws
```

---

**Open Incognito windows on BOTH PCs now!** 🚀

