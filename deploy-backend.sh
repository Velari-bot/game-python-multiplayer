#!/bin/bash
# Backend deployment script for Ubuntu VPS
# Run this script on your VPS: bash deploy-backend.sh

set -e

echo "🚀 Duel Dome Backend Deployment Script"
echo "========================================"

# Configuration
DOMAIN="${1:-your-domain.com}"  # Pass domain as first argument
INSTALL_DIR="/opt/duel-dome"
SERVICE_USER="www-data"

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    echo "❌ Please run as root: sudo bash deploy-backend.sh your-domain.com"
    exit 1
fi

echo "📦 Installing dependencies..."
apt update
apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx

echo "📁 Creating installation directory..."
mkdir -p $INSTALL_DIR
# Ensure proper ownership even if directory exists
chown -R $SUDO_USER:$SUDO_USER $INSTALL_DIR 2>/dev/null || true
cd $INSTALL_DIR

# If git repo exists, pull updates
if [ -d ".git" ]; then
    echo "🔄 Updating from Git..."
    sudo -u $SUDO_USER git pull || {
        echo "⚠️  Git pull failed, trying fresh clone..."
        cd ..
        rm -rf $INSTALL_DIR
        mkdir -p $INSTALL_DIR
        chown -R $SUDO_USER:$SUDO_USER $INSTALL_DIR
        cd $INSTALL_DIR
        sudo -u $SUDO_USER git clone https://github.com/Velari-bot/game-python-multiplayer.git .
    }
else
    echo "📥 Cloning from GitHub..."
    # Clone as the user who ran sudo, not root
    sudo -u $SUDO_USER git clone https://github.com/Velari-bot/game-python-multiplayer.git .
fi

# Ensure all files belong to regular user
chown -R $SUDO_USER:$SUDO_USER $INSTALL_DIR

echo "🐍 Setting up Python environment..."
if [ ! -d "venv" ]; then
    sudo -u $SUDO_USER python3 -m venv venv
fi
chown -R $SUDO_USER:$SUDO_USER venv
# Run pip as regular user
sudo -u $SUDO_USER bash -c "source venv/bin/activate && pip install --upgrade pip && pip install -r server/requirements.txt"

echo "🔧 Configuring nginx..."

# Check if using IP or domain
if [[ $DOMAIN =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "📍 Detected IP address - using HTTP-only config (no SSL)"
    sed "s/YOUR_IP/$DOMAIN/g" nginx-duel-dome-http.conf > /tmp/duel-dome.conf
    USE_SSL=false
else
    echo "🌐 Detected domain - will setup with SSL"
    # FIRST: Use HTTP-only config to get nginx running
    echo "   Step 1/2: Setting up HTTP first..."
    sed "s/YOUR_IP/$DOMAIN/g" nginx-duel-dome-http.conf > /tmp/duel-dome.conf
    USE_SSL=true
fi

cp /tmp/duel-dome.conf /etc/nginx/sites-available/duel-dome
ln -sf /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test nginx config (should work now - no SSL yet)
nginx -t

# Start nginx with HTTP config
systemctl reload nginx || systemctl start nginx

# Only try SSL if using a domain
if [ "$USE_SSL" = true ]; then
    echo "🔒 Step 2/2: Getting SSL certificate..."
    # Get SSL certificate using HTTP-01 challenge
    certbot certonly --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN --redirect || {
        echo "⚠️  SSL setup failed. Trying standalone method..."
        systemctl stop nginx
        certbot certonly --standalone -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
            echo "❌ SSL failed. Continuing with HTTP only."
            echo "   You can try manually: sudo certbot --nginx -d $DOMAIN"
            systemctl start nginx
            USE_SSL=false
        }
        systemctl start nginx
    }
    
    # If SSL succeeded, update to HTTPS config
    if [ "$USE_SSL" = true ] && [ -f "/etc/letsencrypt/live/$DOMAIN/fullchain.pem" ]; then
        echo "✅ SSL certificate obtained! Updating nginx to HTTPS..."
        sed "s/YOUR_DOMAIN/$DOMAIN/g" nginx-duel-dome.conf > /tmp/duel-dome.conf
        cp /tmp/duel-dome.conf /etc/nginx/sites-available/duel-dome
        nginx -t && systemctl reload nginx
    fi
else
    echo "⚠️  Using HTTP only (no SSL). For production, use a domain name and SSL."
fi

echo "⚙️  Configuring systemd service..."
sed "s|/opt/duel-dome|$INSTALL_DIR|g" duel-dome.service > /tmp/duel-dome.service
cp /tmp/duel-dome.service /etc/systemd/system/duel-dome.service

systemctl daemon-reload
systemctl enable duel-dome
systemctl restart duel-dome

echo "🔥 Configuring firewall..."
ufw allow 22/tcp    # SSH
ufw allow 80/tcp    # HTTP
ufw allow 443/tcp   # HTTPS
ufw --force enable || true

echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
systemctl status duel-dome --no-pager | head -10
echo ""
echo "🔍 Check logs with: sudo journalctl -u duel-dome -f"
echo "🌐 Test WebSocket: wss://$DOMAIN/ws"
echo ""

