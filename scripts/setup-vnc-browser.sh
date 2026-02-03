#!/bin/bash
###############################################################################
# NgaboPay - VNC Browser Setup Script
# Sets up Xvfb, x11vnc, and noVNC for remote Binance login
###############################################################################

set -e

echo "=========================================="
echo "NgaboPay VNC Browser Setup"
echo "=========================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}Error: Please run as root (sudo)${NC}"
    exit 1
fi

echo -e "${GREEN}[1/7] Updating package lists...${NC}"
apt-get update -y

echo -e "${GREEN}[2/7] Installing Xvfb (Virtual Display)...${NC}"
apt-get install -y xvfb

echo -e "${GREEN}[3/7] Installing x11vnc (VNC Server)...${NC}"
apt-get install -y x11vnc

echo -e "${GREEN}[4/7] Installing noVNC (Web VNC Client)...${NC}"
apt-get install -y novnc python3-websockify

echo -e "${GREEN}[5/7] Installing Chromium Browser...${NC}"
apt-get install -y chromium-browser

echo -e "${GREEN}[6/7] Installing dependencies...${NC}"
apt-get install -y \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils

echo -e "${GREEN}[7/7] Creating systemd services...${NC}"

# Create Xvfb service
cat > /etc/systemd/system/xvfb.service <<'EOF'
[Unit]
Description=X Virtual Frame Buffer Service
After=network.target

[Service]
Type=simple
User=ngabopay
Environment=DISPLAY=:99
ExecStart=/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create x11vnc service
cat > /etc/systemd/system/x11vnc.service <<'EOF'
[Unit]
Description=x11vnc VNC Server
After=xvfb.service
Requires=xvfb.service

[Service]
Type=simple
User=ngabopay
Environment=DISPLAY=:99
ExecStart=/usr/bin/x11vnc -display :99 -forever -shared -rfbport 5900 -nopw -xkb
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create noVNC service
cat > /etc/systemd/system/novnc.service <<'EOF'
[Unit]
Description=noVNC WebSocket Proxy
After=x11vnc.service
Requires=x11vnc.service

[Service]
Type=simple
User=ngabopay
ExecStart=/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

# Create Chromium launcher script
mkdir -p /home/ngabopay/bin
cat > /home/ngabopay/bin/launch-chromium.sh <<'EOF'
#!/bin/bash
export DISPLAY=:99

# Kill any existing chromium instances
pkill -f chromium || true
sleep 2

# Launch Chromium with remote debugging
chromium-browser \
    --remote-debugging-port=9222 \
    --user-data-dir=/home/ngabopay/.chromium-profile \
    --no-first-run \
    --no-default-browser-check \
    --disable-features=TranslateUI \
    --disable-infobars \
    --window-size=1920,1080 \
    --start-maximized \
    "https://p2p.binance.com/en/trade/sell/USDT?fiat=UGX&payment=ALL" \
    > /tmp/chromium.log 2>&1 &

echo "Chromium launched on DISPLAY :99"
echo "Remote debugging available on port 9222"
echo "VNC available on port 5900"
echo "noVNC available on http://localhost:6080"
EOF

chmod +x /home/ngabopay/bin/launch-chromium.sh
chown ngabopay:ngabopay /home/ngabopay/bin/launch-chromium.sh

# Reload systemd
systemctl daemon-reload

# Enable and start services
systemctl enable xvfb.service
systemctl enable x11vnc.service
systemctl enable novnc.service

systemctl start xvfb.service
sleep 2
systemctl start x11vnc.service
sleep 2
systemctl start novnc.service

# Open firewall ports
ufw allow 6080/tcp comment "noVNC Web Interface"
ufw allow 9222/tcp comment "Chrome Remote Debugging"

echo ""
echo -e "${GREEN}=========================================="
echo "VNC Browser Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Services Status:"
systemctl status xvfb.service --no-pager | grep "Active:"
systemctl status x11vnc.service --no-pager | grep "Active:"
systemctl status novnc.service --no-pager | grep "Active:"
echo ""
echo -e "${YELLOW}Access URLs:${NC}"
echo "  noVNC Web Interface: http://$(hostname -I | awk '{print $1}'):6080"
echo "  Chrome Remote Debug: http://$(hostname -I | awk '{print $1}'):9222"
echo ""
echo -e "${YELLOW}To launch Chromium:${NC}"
echo "  sudo -u ngabopay /home/ngabopay/bin/launch-chromium.sh"
echo ""
echo -e "${YELLOW}To check logs:${NC}"
echo "  journalctl -u xvfb.service -f"
echo "  journalctl -u x11vnc.service -f"
echo "  journalctl -u novnc.service -f"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Launch Chromium using the command above"
echo "2. Access noVNC in your browser"
echo "3. Log into Binance P2P"
echo "4. Session will be saved automatically"
echo ""
