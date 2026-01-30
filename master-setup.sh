#!/bin/bash

# ╔═══════════════════════════════════════════════════════════════════════════╗
# ║                    NGABOPAY MASTER SETUP SCRIPT                           ║
# ║                                                                           ║
# ║  This script sets up a fresh Ubuntu VPS for NgaboPay deployment          ║
# ║  Run as root: bash master-setup.sh                                        ║
# ╚═══════════════════════════════════════════════════════════════════════════╝

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# Configuration
DB_PASSWORD="NgaboSecure2026!"
APP_USER="ngabopay"
APP_DIR="/home/ngabopay/ngabopay-system"
DOMAIN="ngabopay.online"

echo -e "${CYAN}"
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           🚀 NGABOPAY MASTER SETUP SCRIPT 🚀                  ║"
echo "║                                                               ║"
echo "║  This will install and configure:                             ║"
echo "║  • Node.js 20 + pnpm + PM2                                   ║"
echo "║  • PostgreSQL 15 + Redis 7                                   ║"
echo "║  • Nginx + Certbot (SSL)                                     ║"
echo "║  • Security hardening (UFW, fail2ban)                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo -e "${NC}"
echo ""

# Check root
if [ "$EUID" -ne 0 ]; then
    echo -e "${RED}ERROR: Please run as root${NC}"
    exit 1
fi

print_step() {
    echo ""
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "${CYAN}  $1${NC}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_done() {
    echo -e "${GREEN}  ✓ $1${NC}"
}

print_warn() {
    echo -e "${YELLOW}  ⚠ $1${NC}"
}

# ============================================
# STEP 1: System Update
# ============================================
print_step "STEP 1/10: Updating System Packages"
apt update && apt upgrade -y
print_done "System updated"

# ============================================
# STEP 2: Create Application User
# ============================================
print_step "STEP 2/10: Creating Application User"
if id "$APP_USER" &>/dev/null; then
    print_warn "User $APP_USER already exists"
else
    adduser --disabled-password --gecos "" $APP_USER
    usermod -aG sudo $APP_USER
    echo "$APP_USER ALL=(ALL) NOPASSWD:ALL" >> /etc/sudoers.d/$APP_USER
    print_done "User $APP_USER created with sudo access"
fi

# Setup directories
mkdir -p /home/$APP_USER/.ssh
mkdir -p /home/$APP_USER/logs
chmod 700 /home/$APP_USER/.ssh
chown -R $APP_USER:$APP_USER /home/$APP_USER

# ============================================
# STEP 3: Install Essential Packages
# ============================================
print_step "STEP 3/10: Installing Essential Packages"
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release \
    vim \
    htop \
    unzip \
    jq
print_done "Essential packages installed"

# ============================================
# STEP 4: Install Node.js 20
# ============================================
print_step "STEP 4/10: Installing Node.js 20"
if command -v node &> /dev/null; then
    print_warn "Node.js already installed: $(node --version)"
else
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
npm install -g pnpm pm2
print_done "Node.js $(node --version), pnpm $(pnpm --version), PM2 installed"

# ============================================
# STEP 5: Install PostgreSQL
# ============================================
print_step "STEP 5/10: Installing PostgreSQL"
apt install -y postgresql postgresql-contrib
systemctl start postgresql
systemctl enable postgresql

# Create database and user
sudo -u postgres psql -c "DROP DATABASE IF EXISTS ngabopay_prod;" 2>/dev/null || true
sudo -u postgres psql -c "DROP USER IF EXISTS ngabopay_user;" 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER ngabopay_user WITH PASSWORD '$DB_PASSWORD';"
sudo -u postgres psql -c "CREATE DATABASE ngabopay_prod OWNER ngabopay_user;"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ngabopay_prod TO ngabopay_user;"
sudo -u postgres psql -c "ALTER USER ngabopay_user CREATEDB;"
print_done "PostgreSQL installed and configured"
echo -e "${YELLOW}    Database: ngabopay_prod${NC}"
echo -e "${YELLOW}    User: ngabopay_user${NC}"
echo -e "${YELLOW}    Password: $DB_PASSWORD${NC}"

# ============================================
# STEP 6: Install Redis
# ============================================
print_step "STEP 6/10: Installing Redis"
apt install -y redis-server
sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl restart redis-server
systemctl enable redis-server
print_done "Redis installed and configured"

# ============================================
# STEP 7: Install Nginx
# ============================================
print_step "STEP 7/10: Installing Nginx"
apt install -y nginx certbot python3-certbot-nginx
systemctl start nginx
systemctl enable nginx
print_done "Nginx installed"

# ============================================
# STEP 8: Install Playwright Dependencies
# ============================================
print_step "STEP 8/10: Installing Playwright Dependencies"
apt install -y \
    libnss3 \
    libnspr4 \
    libatk1.0-0 \
    libatk-bridge2.0-0 \
    libcups2 \
    libdrm2 \
    libxkbcommon0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxrandr2 \
    libgbm1 \
    libasound2t64 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    fonts-liberation \
    xdg-utils \
    2>/dev/null || apt install -y libasound2 2>/dev/null || true
print_done "Playwright dependencies installed"

# ============================================
# STEP 9: Configure Firewall
# ============================================
print_step "STEP 9/10: Configuring Firewall (UFW)"
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
print_done "Firewall configured (ports 22, 80, 443 open)"

# Install fail2ban
apt install -y fail2ban
cat > /etc/fail2ban/jail.local << 'F2BEOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 5

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
F2BEOF
systemctl enable fail2ban
systemctl restart fail2ban
print_done "fail2ban installed and configured"

# ============================================
# STEP 10: Create Project Structure
# ============================================
print_step "STEP 10/10: Creating Project Structure"
mkdir -p $APP_DIR
chown -R $APP_USER:$APP_USER $APP_DIR

# Generate secrets
API_SECRET=$(openssl rand -hex 32)
JWT_SECRET=$(openssl rand -hex 32)
ENCRYPTION_KEY=$(openssl rand -hex 32)

# Create .env.production
cat > $APP_DIR/.env.production << ENVEOF
# NgaboPay Production Environment
# Generated on $(date)

# Database
DATABASE_URL=postgresql://ngabopay_user:$DB_PASSWORD@localhost:5432/ngabopay_prod
DB_USER=ngabopay_user
DB_PASSWORD=$DB_PASSWORD
DB_NAME=ngabopay_prod
DB_HOST=localhost
DB_PORT=5432

# Redis
REDIS_URL=redis://localhost:6379

# Application
NODE_ENV=production
API_PORT=3000
DASHBOARD_PORT=3001

# Secrets (auto-generated)
API_SECRET=$API_SECRET
JWT_SECRET=$JWT_SECRET
ENCRYPTION_KEY=$ENCRYPTION_KEY
JWT_EXPIRES_IN=86400

# Domain
PUBLIC_URL=https://$DOMAIN
DOMAIN=$DOMAIN
WWW_DOMAIN=www.$DOMAIN

# Blockchain (add your keys)
TRONGRID_API_KEY=
BSCSCAN_API_KEY=
BLOCKCHAIN_POLL_INTERVAL=30000
BINANCE_POLL_INTERVAL=30000

# WhatsApp (add your credentials)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_VERIFY_TOKEN=
WHATSAPP_RECIPIENT_NUMBER=

# Telegram (optional)
TELEGRAM_BOT_TOKEN=
TELEGRAM_ADMIN_CHAT_ID=

# Business Logic
MIN_ORDER_AMOUNT_UGX=10000
MAX_ORDER_AMOUNT_UGX=5000000
TRANSACTION_FEE_PERCENT=2.0

# Security
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
CORS_ORIGINS=https://$DOMAIN,https://www.$DOMAIN

# Logging
LOG_LEVEL=info
ENVEOF

chown $APP_USER:$APP_USER $APP_DIR/.env.production
chmod 600 $APP_DIR/.env.production
print_done "Project structure created"
print_done "Environment file created at $APP_DIR/.env.production"

# ============================================
# FINAL SUMMARY
# ============================================
echo ""
echo -e "${GREEN}╔═══════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║           ✅ VPS SETUP COMPLETED SUCCESSFULLY! ✅             ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo -e "${CYAN}📋 INSTALLED COMPONENTS:${NC}"
echo "   • Node.js: $(node --version)"
echo "   • npm: $(npm --version)"
echo "   • pnpm: $(pnpm --version)"
echo "   • PM2: $(pm2 --version)"
echo "   • PostgreSQL: $(psql --version | head -1)"
echo "   • Redis: $(redis-cli --version)"
echo "   • Nginx: $(nginx -v 2>&1)"
echo ""
echo -e "${CYAN}🔐 DATABASE CREDENTIALS:${NC}"
echo "   • Database: ngabopay_prod"
echo "   • User: ngabopay_user"
echo "   • Password: $DB_PASSWORD"
echo "   • Connection: postgresql://ngabopay_user:$DB_PASSWORD@localhost:5432/ngabopay_prod"
echo ""
echo -e "${CYAN}📁 PROJECT LOCATION:${NC}"
echo "   • Directory: $APP_DIR"
echo "   • Env File: $APP_DIR/.env.production"
echo ""
echo -e "${CYAN}🔒 SECURITY:${NC}"
echo "   • Firewall: Active (ports 22, 80, 443)"
echo "   • fail2ban: Active"
echo ""
echo -e "${YELLOW}📝 NEXT STEPS:${NC}"
echo "   1. The application code will be deployed to: $APP_DIR"
echo "   2. Edit .env.production to add your API keys"
echo "   3. Configure DNS: Point $DOMAIN to this server's IP"
echo ""
echo -e "${GREEN}VPS is ready for application deployment!${NC}"
echo ""
