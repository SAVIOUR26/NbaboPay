#!/bin/bash

# NgaboPay VPS Setup Script
# This script automates the complete VPS setup process
# Run as root: sudo bash setup-vps.sh

set -e

echo "🚀 NgaboPay VPS Setup Starting..."
echo "=================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then 
    print_error "Please run as root: sudo bash setup-vps.sh"
    exit 1
fi

print_info "Starting VPS setup for NgaboPay..."
echo ""

# Update system
print_info "Updating system packages..."
apt update && apt upgrade -y
print_status "System updated"

# Create ngabopay user
print_info "Creating ngabopay user..."
if id "ngabopay" &>/dev/null; then
    print_warning "User ngabopay already exists"
else
    adduser --disabled-password --gecos "" ngabopay
    echo "ngabopay:NgaboPay2025!Temp" | chpasswd
    usermod -aG sudo ngabopay
    print_status "User ngabopay created (password: NgaboPay2025!Temp - CHANGE THIS!)"
fi

# Setup SSH directory
print_info "Setting up SSH..."
mkdir -p /home/ngabopay/.ssh
chmod 700 /home/ngabopay/.ssh
touch /home/ngabopay/.ssh/authorized_keys
chmod 600 /home/ngabopay/.ssh/authorized_keys
chown -R ngabopay:ngabopay /home/ngabopay/.ssh
print_status "SSH directory configured"

# Configure SSH daemon
print_info "Configuring SSH daemon..."
cp /etc/ssh/sshd_config /etc/ssh/sshd_config.backup
sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config
sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
sed -i 's/PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config
systemctl restart sshd
print_status "SSH daemon configured (root login disabled)"

# Setup firewall
print_info "Configuring UFW firewall..."
ufw --force reset
ufw default deny incoming
ufw default allow outgoing
ufw allow 22/tcp comment 'SSH'
ufw allow 80/tcp comment 'HTTP'
ufw allow 443/tcp comment 'HTTPS'
ufw --force enable
print_status "Firewall configured and enabled"

# Install fail2ban
print_info "Installing fail2ban..."
apt install -y fail2ban
cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local

cat > /etc/fail2ban/jail.local << 'F2B_EOF'
[DEFAULT]
bantime = 3600
findtime = 600
maxretry = 3

[sshd]
enabled = true
port = 22
logpath = %(sshd_log)s
F2B_EOF

systemctl enable fail2ban
systemctl start fail2ban
print_status "fail2ban installed and configured"

# Install essential packages
print_info "Installing essential packages..."
apt install -y \
    curl \
    wget \
    git \
    build-essential \
    software-properties-common \
    ca-certificates \
    gnupg \
    lsb-release \
    nginx \
    certbot \
    python3-certbot-nginx \
    postgresql \
    postgresql-contrib \
    redis-server \
    vim \
    htop \
    unzip
print_status "Essential packages installed"

# Install Node.js 20
print_info "Installing Node.js 20..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs
npm install -g pnpm pm2
print_status "Node.js 20 and package managers installed"

# Install Playwright dependencies
print_info "Installing Playwright dependencies..."
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
    libasound2 \
    libpangocairo-1.0-0 \
    libgtk-3-0 \
    libxshmfence1 \
    fonts-liberation \
    libappindicator3-1 \
    xdg-utils
print_status "Playwright dependencies installed"

# Start and enable services
print_info "Starting services..."
systemctl start nginx
systemctl enable nginx
systemctl start postgresql
systemctl enable postgresql
systemctl start redis-server
systemctl enable redis-server
print_status "Services started and enabled"

# Configure PostgreSQL
print_info "Configuring PostgreSQL..."
sudo -u postgres psql -c "CREATE USER ngabopay_user WITH PASSWORD 'TempPass123!ChangeMe';" || print_warning "PostgreSQL user may already exist"
sudo -u postgres psql -c "CREATE DATABASE ngabopay_prod OWNER ngabopay_user;" || print_warning "PostgreSQL database may already exist"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ngabopay_prod TO ngabopay_user;"
print_status "PostgreSQL configured"

# Configure Redis
print_info "Configuring Redis..."
sed -i 's/^# maxmemory <bytes>/maxmemory 256mb/' /etc/redis/redis.conf
sed -i 's/^# maxmemory-policy noeviction/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl restart redis-server
print_status "Redis configured"

# Create project directory
print_info "Creating project directory..."
mkdir -p /home/ngabopay/ngabopay-system
chown -R ngabopay:ngabopay /home/ngabopay
print_status "Project directory created"

# Setup log directory
mkdir -p /home/ngabopay/logs
chown -R ngabopay:ngabopay /home/ngabopay/logs
print_status "Log directory created"

# Create welcome message
cat > /home/ngabopay/WELCOME.txt << 'WELCOME_EOF'
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║              🚀 WELCOME TO NGABOPAY VPS 🚀                 ║
║                                                            ║
║  Your VPS is now configured and ready for deployment!     ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝

📋 NEXT STEPS:

1. Change your password:
   $ passwd

2. Add your SSH public key:
   $ nano ~/.ssh/authorized_keys
   (Paste your public key and save)

3. Clone the repository:
   $ cd ~
   $ git clone https://github.com/YOUR_USERNAME/ngabopay-system.git

4. Setup environment:
   $ cd ngabopay-system
   $ cp .env.example .env.production
   $ nano .env.production
   (Fill in your credentials)

5. Run database setup:
   $ chmod +x scripts/setup-database.sh
   $ ./scripts/setup-database.sh

6. Install dependencies and build:
   $ pnpm install
   $ pnpm build

7. Deploy with PM2:
   $ pm2 start deployment/pm2/ecosystem.config.js
   $ pm2 save
   $ pm2 startup

8. Configure Nginx and SSL:
   $ sudo cp deployment/nginx/ngabopay.conf /etc/nginx/sites-available/
   $ sudo ln -s /etc/nginx/sites-available/ngabopay.conf /etc/nginx/sites-enabled/
   $ sudo nginx -t
   $ sudo systemctl reload nginx
   $ sudo certbot --nginx -d ngabopay.online -d www.ngabopay.online

📚 Documentation: Check the /docs folder in the repository

🆘 Support: support@ngabopay.online

Good luck! 🚀
WELCOME_EOF

chown ngabopay:ngabopay /home/ngabopay/WELCOME.txt

echo ""
echo "=================================="
print_status "VPS Setup Complete!"
echo "=================================="
echo ""
print_info "IMPORTANT SECURITY NOTES:"
echo "  1. Change ngabopay user password: sudo passwd ngabopay"
echo "  2. Add your SSH public key to: /home/ngabopay/.ssh/authorized_keys"
echo "  3. Default PostgreSQL password: TempPass123!ChangeMe (CHANGE THIS!)"
echo ""
print_info "INSTALLED VERSIONS:"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  pnpm: $(pnpm --version)"
echo "  PM2: $(pm2 --version)"
echo "  PostgreSQL: $(psql --version | head -n1)"
echo "  Redis: $(redis-cli --version)"
echo "  Nginx: $(nginx -v 2>&1)"
echo ""
print_info "NEXT STEP:"
echo "  Switch to ngabopay user: su - ngabopay"
echo "  Read WELCOME.txt for detailed instructions"
echo ""
print_status "Setup script completed successfully!"
