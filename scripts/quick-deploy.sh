#!/bin/bash
###############################################################################
# NgaboPay - Quick Deployment Script
# Automates the complete deployment process
###############################################################################

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
VPS_USER="ngabopay"
VPS_IP="104.37.184.215"
DB_NAME="ngabopay_prod"
DB_USER="ngabopay_user"
DB_PASSWORD="SecurePassword123!"
MERCHANT_EMAIL="admin@ngabopay.com"
MERCHANT_PASSWORD="NgaboPay2024!"

echo -e "${BLUE}"
cat << "EOF"
╔═══════════════════════════════════════════╗
║                                           ║
║        NgaboPay Quick Deployment          ║
║                                           ║
╚═══════════════════════════════════════════╝
EOF
echo -e "${NC}"

# Check if running on VPS or local
if [ "$(hostname -I | awk '{print $1}')" == "$VPS_IP" ]; then
    echo -e "${GREEN}Running on VPS - proceeding with deployment${NC}"
    ON_VPS=true
else
    echo -e "${YELLOW}Running on local machine - will SSH to VPS${NC}"
    ON_VPS=false
fi

# Function to run command on VPS
run_on_vps() {
    if [ "$ON_VPS" = true ]; then
        bash -c "$1"
    else
        ssh -o StrictHostKeyChecking=no ${VPS_USER}@${VPS_IP} "$1"
    fi
}

# Function to run command as root on VPS
run_as_root() {
    if [ "$ON_VPS" = true ]; then
        sudo bash -c "$1"
    else
        ssh -o StrictHostKeyChecking=no root@${VPS_IP} "$1"
    fi
}

echo -e "${GREEN}[1/10] Checking VPS connectivity...${NC}"
if ping -c 1 $VPS_IP &> /dev/null; then
    echo -e "${GREEN}✓ VPS is reachable${NC}"
else
    echo -e "${RED}✗ Cannot reach VPS at $VPS_IP${NC}"
    exit 1
fi

echo -e "${GREEN}[2/10] Installing system dependencies...${NC}"
run_as_root "apt-get update && apt-get install -y \
    postgresql postgresql-contrib \
    redis-server \
    nginx \
    curl \
    git"

echo -e "${GREEN}[3/10] Installing Node.js 20...${NC}"
run_as_root "curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && \
    apt-get install -y nodejs && \
    npm install -g pnpm pm2"

echo -e "${GREEN}[4/10] Setting up VNC browser infrastructure...${NC}"
if [ "$ON_VPS" = false ]; then
    scp -o StrictHostKeyChecking=no scripts/setup-vnc-browser.sh ${VPS_USER}@${VPS_IP}:/tmp/
fi
run_as_root "bash /tmp/setup-vnc-browser.sh"

echo -e "${GREEN}[5/10] Configuring database...${NC}"
run_as_root "sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS $DB_NAME;
DROP USER IF EXISTS $DB_USER;
CREATE DATABASE $DB_NAME;
CREATE USER $DB_USER WITH ENCRYPTED PASSWORD '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
ALTER DATABASE $DB_NAME OWNER TO $DB_USER;
\q
EOF"

echo -e "${GREEN}[6/10] Cloning repository...${NC}"
run_on_vps "cd /home/$VPS_USER && \
    rm -rf ngabopay-system && \
    git clone https://github.com/SAVIOUR26/NbaboPay.git ngabopay-system"

echo -e "${GREEN}[7/10] Installing dependencies and building...${NC}"
run_on_vps "cd /home/$VPS_USER/ngabopay-system && \
    pnpm install && \
    npx playwright install chromium && \
    npx playwright install-deps chromium"

echo -e "${GREEN}[8/10] Configuring environment...${NC}"
run_on_vps "cd /home/$VPS_USER/ngabopay-system && cat > .env.production <<EOF
DATABASE_URL=\"postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME\"
REDIS_URL=\"redis://localhost:6379\"
JWT_SECRET=\"$(openssl rand -hex 32)\"
JWT_EXPIRES_IN=\"7d\"
NODE_ENV=\"production\"
API_PORT=3000
DASHBOARD_PORT=3001
CORS_ORIGINS=\"http://$VPS_IP:3001,https://ngabopay.online\"
DISPLAY=\":99\"
VNC_PORT=6080
EOF"

echo -e "${GREEN}[9/10] Running database migrations...${NC}"
run_on_vps "cd /home/$VPS_USER/ngabopay-system/packages/shared/database && \
    npx prisma generate && \
    npx prisma migrate deploy"

# Create merchant account
echo -e "${GREEN}[9.5/10] Creating merchant account...${NC}"
PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync('$MERCHANT_PASSWORD', 12))")
run_as_root "sudo -u postgres psql $DB_NAME <<EOF
INSERT INTO merchants (id, email, password_hash, business_name, phone, country, is_active)
VALUES (
  gen_random_uuid(),
  '$MERCHANT_EMAIL',
  '$PASSWORD_HASH',
  'NgaboPay Operations',
  '+256772123456',
  'UG',
  true
);
EOF"

echo -e "${GREEN}[10/10] Building and starting services...${NC}"
run_on_vps "cd /home/$VPS_USER/ngabopay-system && \
    pnpm build && \
    pm2 delete all || true && \
    pm2 start deployment/pm2/ecosystem.config.js && \
    pm2 save"

# Configure PM2 startup
run_on_vps "pm2 startup | tail -1 | bash"

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN}   🎉 Deployment Complete! 🎉${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e "${YELLOW}Access Points:${NC}"
echo -e "  Dashboard:  ${BLUE}http://$VPS_IP:3001${NC}"
echo -e "  API:        ${BLUE}http://$VPS_IP:3000${NC}"
echo -e "  VNC Browser:${BLUE}http://$VPS_IP:6080/vnc.html${NC}"
echo ""
echo -e "${YELLOW}Login Credentials:${NC}"
echo -e "  Email:    ${BLUE}$MERCHANT_EMAIL${NC}"
echo -e "  Password: ${BLUE}$MERCHANT_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}Next Steps:${NC}"
echo "1. Open dashboard: http://$VPS_IP:3001"
echo "2. Login with credentials above"
echo "3. Go to 'Binance P2P' page"
echo "4. Click 'Launch Browser'"
echo "5. Open VNC URL and log into Binance"
echo "6. Save session and start monitoring"
echo ""
echo -e "${YELLOW}To check status:${NC}"
echo "  ssh $VPS_USER@$VPS_IP"
echo "  pm2 status"
echo "  pm2 logs"
echo ""
echo -e "${GREEN}Deployment successful!${NC}"
