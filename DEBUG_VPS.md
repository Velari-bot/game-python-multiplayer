# 🔍 Debug VPS Connection

## Error: "Connection reset by peer"

This means:
- ✅ DNS is working (`dueldome.duckdns.org` resolves to `45.77.145.57`)
- ❌ Nginx/SSL not configured or not running on VPS
- ❌ Port 443 (HTTPS) not accessible

## 🔧 Check VPS Status

Run these commands on your VPS to diagnose:

```bash
# Check if backend service is running
sudo systemctl status duel-dome

# Check if nginx is running
sudo systemctl status nginx

# Check which ports are listening
sudo netstat -tlnp | grep -E ':(80|443|3000)'

# Check if SSL certificate exists
sudo ls -la /etc/letsencrypt/live/dueldome.duckdns.org/ 2>/dev/null || echo "SSL cert not found"

# Check nginx config
sudo nginx -t

# Check firewall
sudo ufw status
```

## 🎯 Most Likely Issue

**You haven't run the deployment with the domain yet!**

The error on VPS earlier showed:
```
curl: (7) Failed to connect to dueldome.duckdns.org port 443: Connection refused
```

This means the deployment script with `dueldome.duckdns.org` hasn't been run.

## ✅ FIX: Run Deployment with Domain

```bash
# On VPS
cd /opt/duel-dome
git pull
sudo bash deploy-backend.sh dueldome.duckdns.org
```

**This will**:
- Configure nginx for HTTPS
- Get SSL certificate from Let's Encrypt
- Enable port 443
- Start services

## 🧪 After Deployment, Test:

```bash
# Test HTTP (should redirect to HTTPS)
curl -I http://dueldome.duckdns.org/health

# Test HTTPS
curl https://dueldome.duckdns.org/health

# Should return: {"status":"ok","service":"duel-dome",...}
```

## 🔍 If Still Failing After Deployment

### Check SSL Certificate:
```bash
sudo certbot certificates
```

### Check nginx logs:
```bash
sudo tail -f /var/log/nginx/duel-dome-error.log
```

### Restart services:
```bash
sudo systemctl restart duel-dome
sudo systemctl restart nginx
```

### Test port 443:
```bash
sudo lsof -i :443
```

Should show nginx listening.

## 📋 Complete Diagnostic Commands

```bash
# Run all of these on VPS for full diagnosis
echo "=== Service Status ===" && sudo systemctl status duel-dome --no-pager | head -10
echo "" && echo "=== Nginx Status ===" && sudo systemctl status nginx --no-pager | head -10
echo "" && echo "=== Ports ===" && sudo netstat -tlnp | grep -E ':(80|443|3000)'
echo "" && echo "=== SSL Cert ===" && sudo ls -la /etc/letsencrypt/live/ 2>/dev/null || echo "No certs"
echo "" && echo "=== Firewall ===" && sudo ufw status
echo "" && echo "=== Backend Logs ===" && sudo journalctl -u duel-dome -n 20 --no-pager
```

---

**MOST LIKELY: You just need to run the deployment command with the domain!**

