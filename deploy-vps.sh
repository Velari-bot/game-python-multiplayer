#!/bin/bash
# Automated VPS deployment script
# Usage: Run this ON your VPS via SSH: bash <(curl -sL https://raw.githubusercontent.com/Velari-bot/game-python-multiplayer/main/deploy-backend.sh) your-domain.com
# Or: ssh user@45.77.145.57 "bash -s" < deploy-backend.sh your-domain.com

set -e

DOMAIN="${1}"
if [ -z "$DOMAIN" ]; then
    echo "❌ Please provide a domain name: bash deploy-backend.sh your-domain.com"
    echo "💡 Example: bash deploy-backend.sh api.dueldome.com"
    exit 1
fi

echo "🚀 Deploying Duel Dome Backend to VPS"
echo "Domain: $DOMAIN"
echo "========================================"

INSTALL_DIR="/opt/duel-dome"

# Install dependencies
echo "📦 Installing system dependencies..."
sudo apt update
sudo apt install -y python3-pip python3-venv nginx certbot python3-certbot-nginx git

# Create installation directory
echo "📁 Setting up installation directory..."
sudo mkdir -p $INSTALL_DIR
sudo chown $USER:$USER $INSTALL_DIR
cd $INSTALL_DIR

# Clone or update from GitHub
if [ -d ".git" ]; then
    echo "🔄 Updating from GitHub..."
    git pull
else
    echo "📥 Cloning from GitHub..."
    git clone https://github.com/Velari-bot/game-python-multiplayer.git .
fi

# Setup Python environment
echo "🐍 Setting up Python virtual environment..."
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi
source venv/bin/activate
pip install --upgrade pip
pip install -r server/requirements.txt

# Configure nginx
echo "🔧 Configuring nginx..."
sudo sed "s/YOUR_DOMAIN/$DOMAIN/g" nginx-duel-dome.conf | sudo tee /etc/nginx/sites-available/duel-dome > /dev/null
sudo ln -sf /etc/nginx/sites-available/duel-dome /etc/nginx/sites-enabled/

# Remove default nginx site
if [ -f /etc/nginx/sites-enabled/default ]; then
    sudo rm /etc/nginx/sites-enabled/default
fi

# Test nginx config
echo "🧪 Testing nginx configuration..."
sudo nginx -t

# Reload nginx
sudo systemctl reload nginx

# Setup SSL (optional - will prompt if domain not pointing to server)
echo "🔒 Setting up SSL certificate..."
echo "⚠️  Make sure your domain $DOMAIN points to this server's IP!"
read -p "Press Enter to continue with SSL setup (or Ctrl+C to skip)..."
sudo certbot --nginx -d $DOMAIN --non-interactive --agree-tos --register-unsafely-without-email || {
    echo "⚠️  SSL setup failed. You can run manually later: sudo certbot --nginx -d $DOMAIN"
}

# Configure systemd service
echo "⚙️  Configuring systemd service..."
sudo sed "s|/opt/duel-dome|$INSTALL_DIR|g" duel-dome.service | sudo tee /etc/systemd/system/duel-dome.service > /dev/null

sudo systemctl daemon-reload
sudo systemctl enable duel-dome
sudo systemctl restart duel-dome

# Configure firewall
echo "🔥 Configuring firewall..."
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 80/tcp    # HTTP
sudo ufw allow 443/tcp   # HTTPS
echo "y" | sudo ufw enable || true

# Show status
echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Service Status:"
sudo systemctl status duel-dome --no-pager | head -15
echo ""
echo "🔍 Useful commands:"
echo "  Check logs: sudo journalctl -u duel-dome -f"
echo "  Restart: sudo systemctl restart duel-dome"
echo "  Stop: sudo systemctl stop duel-dome"
echo ""
echo "🌐 Test WebSocket: wss://$DOMAIN/ws"
echo "📡 Health check: curl https://$DOMAIN/health"
echo ""

