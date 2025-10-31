# How to Connect from Another Device

## Quick Steps

1. **Server is running** (you should see `Uvicorn running on http://0.0.0.0:3000`)

2. **Find your server's IP address:**
   ```bash
   # Mac/Linux:
   ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1
   
   # Or simpler:
   hostname -I  # Linux
   ipconfig getifaddr en0  # Mac (Wi-Fi)
   ```

3. **On the other device:**
   - Connect to the **same Wi-Fi network** as the server
   - Open a web browser
   - Go to: `http://YOUR_SERVER_IP:3000`
   - Example: `http://172.16.0.71:3000`

## Your Current Server IP

Based on your network, your server IP is likely: **`172.16.0.71`**

So on another device, go to: **`http://172.16.0.71:3000`**

## Troubleshooting

### "Connection Failed" or Can't Connect

1. **Check both devices are on same Wi-Fi:**
   - Server device and client device must be on the same network

2. **Check firewall:**
   - macOS: System Preferences → Security & Privacy → Firewall
   - Allow Python/Terminal through firewall or temporarily disable

3. **Check server is running:**
   - Look for: `INFO: Uvicorn running on http://0.0.0.0:3000`
   - If it says `127.0.0.1` instead, the server won't accept external connections

4. **Try IP address instead of hostname:**
   - Use `http://172.16.0.71:3000` instead of `http://localhost:3000`

5. **Check the port:**
   - Make sure you're using port `3000` (or whatever PORT you set)
   - Some networks block certain ports

### Server Shows "Connection Refused"

- The server might only be listening on localhost
- Make sure `main.py` runs with `host="0.0.0.0"` (it does by default)
- Restart the server if needed

## Testing Locally First

Before connecting from another device, test with two browser tabs on the same computer:
1. Open `http://localhost:3000` in first tab
2. Open `http://localhost:3000` in second tab
3. Game should start automatically

Once that works, try from another device using the IP address!

