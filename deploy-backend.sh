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
cd $INSTALL_DIR

# If git repo exists, pull updates
if [ -d ".git" ]; then
    echo "🔄 Updating from Git..."
    git pull
else
    echo "📥 Cloning from GitHub..."
    git clone https://github.com/Velari-bot/game-python-multiplayer.git .
fi

echo "🐍 Setting up Python environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r server/requirements.txt

echo "🔧 Configuring nginx..."
sed "s/YOUR_DOMAIN/$DOMAIN/g" nginx-duel-dome.conf > /tmp/duel-dome.conf
cp /tmp/duel-dome.conf /etc/nginx/sites-available/duel-dome
ln -sf /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/

# Remove default nginx site if it exists
if [ -f /etc/nginx/sites-enabled/default ]; then
    rm /etc/nginx/sites-enabled/default
fi

# Test nginx config
nginx -t

echo "🔒 Setting up SSL certificate..."
systemctl reload nginx
certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN || {
    echo "⚠️  SSL setup failed. You may need to run: certbot --nginx -d $DOMAIN"
}

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

