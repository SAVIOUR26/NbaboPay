# 🚀 NgaboPay VNC Browser Deployment Guide

Complete guide to deploy NgaboPay with VNC browser integration for Binance P2P monitoring.

---

## 📋 Prerequisites

- VPS Server: Ubuntu 22.04 (IP: 104.37.184.215)
- Root access via SSH
- Domain: ngabopay.online (pointed to VPS IP)
- At least 2GB RAM, 20GB storage

---

## 🔧 Step 1: Initial VPS Setup

### 1.1 Connect to VPS
```bash
ssh root@104.37.184.215
```

### 1.2 Create Non-Root User
```bash
adduser ngabopay
usermod -aG sudo ngabopay
```

### 1.3 Set Up SSH Key (Local Machine)
```bash
# On your local machine
ssh-keygen -t ed25519 -C "ngabopay-deploy"

# Copy to VPS
ssh-copy-id ngabopay@104.37.184.215
```

### 1.4 Install Node.js 20
```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install pnpm
npm install -g pnpm

# Verify
node --version  # Should be v20.x
pnpm --version
```

### 1.5 Install PostgreSQL 15
```bash
sudo apt install -y postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql

# Create database and user
sudo -u postgres psql <<EOF
CREATE DATABASE ngabopay_prod;
CREATE USER ngabopay_user WITH ENCRYPTED PASSWORD 'SecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE ngabopay_prod TO ngabopay_user;
\q
EOF
```

### 1.6 Install Redis 7
```bash
sudo apt install -y redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

### 1.7 Install Nginx
```bash
sudo apt install -y nginx
sudo systemctl start nginx
sudo systemctl enable nginx
```

---

## 🖥️ Step 2: Install VNC Browser Infrastructure

### 2.1 Upload and Run VNC Setup Script
```bash
# From local machine, copy script to VPS
scp scripts/setup-vnc-browser.sh ngabopay@104.37.184.215:/tmp/

# SSH to VPS
ssh ngabopay@104.37.184.215

# Run setup script as root
sudo bash /tmp/setup-vnc-browser.sh
```

This script installs:
- ✅ Xvfb (Virtual Display)
- ✅ x11vnc (VNC Server)
- ✅ noVNC (Web VNC Client)
- ✅ Chromium Browser
- ✅ Systemd services for auto-start

### 2.2 Verify Services
```bash
sudo systemctl status xvfb
sudo systemctl status x11vnc
sudo systemctl status novnc
```

All should show "active (running)" in green.

### 2.3 Test VNC Access
Open in browser:
```
http://104.37.184.215:6080/vnc.html
```

You should see the noVNC interface.

---

## 📦 Step 3: Deploy NgaboPay Application

### 3.1 Clone Repository
```bash
cd /home/ngabopay
git clone https://github.com/SAVIOUR26/NbaboPay.git ngabopay-system
cd ngabopay-system
```

### 3.2 Install Dependencies
```bash
pnpm install
```

### 3.3 Install Playwright Browsers
```bash
npx playwright install chromium
npx playwright install-deps chromium
```

### 3.4 Configure Environment
```bash
cp .env.example .env.production
nano .env.production
```

**Add these values:**
```env
# Database
DATABASE_URL="postgresql://ngabopay_user:SecurePassword123!@localhost:5432/ngabopay_prod"

# Redis
REDIS_URL="redis://localhost:6379"

# JWT
JWT_SECRET="GenerateAStrongSecretKeyHere123!@#"
JWT_EXPIRES_IN="7d"

# API
NODE_ENV="production"
API_PORT=3000
DASHBOARD_PORT=3001

# CORS
CORS_ORIGINS="http://104.37.184.215:3001,https://ngabopay.online"

# Binance VNC
DISPLAY=":99"
VNC_PORT=6080
```

### 3.5 Run Database Migrations
```bash
cd packages/shared/database
npx prisma generate
npx prisma migrate deploy
cd ../../..
```

### 3.6 Build Application
```bash
pnpm build
```

This compiles:
- Backend API
- Dashboard (Next.js)
- Workers
- All packages

---

## 🚀 Step 4: Start Services with PM2

### 4.1 Install PM2
```bash
sudo npm install -g pm2
```

### 4.2 Start All Services
```bash
pm2 start deployment/pm2/ecosystem.config.js
pm2 save
```

### 4.3 Enable Auto-Start on Boot
```bash
pm2 startup
# Copy and run the command it outputs
```

### 4.4 Check Status
```bash
pm2 status
```

Should show:
```
┌────┬────────────────────┬─────────┬─────────┬──────┐
│ id │ name               │ status  │ restart │ cpu  │
├────┼────────────────────┼─────────┼─────────┼──────┤
│ 0  │ ngabopay-api       │ online  │ 0       │ 0%   │
│ 1  │ ngabopay-dashboard │ online  │ 0       │ 0%   │
│ 2  │ ngabopay-workers   │ online  │ 0       │ 0%   │
└────┴────────────────────┴─────────┴─────────┴──────┘
```

---

## 🌐 Step 5: Configure Nginx Reverse Proxy

### 5.1 Copy Nginx Config
```bash
sudo cp deployment/nginx/ngabopay.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/ngabopay.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default
```

### 5.2 Update Config for VNC
```bash
sudo nano /etc/nginx/sites-available/ngabopay.conf
```

Add VNC proxy location:
```nginx
# VNC WebSocket Proxy
location /vnc {
    proxy_pass http://localhost:6080;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
}
```

### 5.3 Test and Reload
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### 5.4 Install SSL Certificate
```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d ngabopay.online -d www.ngabopay.online
```

---

## 🔒 Step 6: Configure Firewall

```bash
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 6080/tcp    # noVNC (temporary, remove after nginx proxy)
sudo ufw enable
```

---

## 🧪 Step 7: Test Complete System

### 7.1 Test API
```bash
curl http://localhost:3000/api/health
```

Should return:
```json
{"status":"ok","timestamp":"...","service":"ngabopay-api"}
```

### 7.2 Test Dashboard
Open browser:
```
http://104.37.184.215:3001
```

Should show login page.

### 7.3 Test VNC Browser
```
http://104.37.184.215:6080/vnc.html
```

Click "Connect" → Should show virtual desktop with Chromium.

---

## 🎯 Step 8: Create Initial Merchant Account

### 8.1 Generate Password Hash
```bash
node -e "console.log(require('bcryptjs').hashSync('YourPassword123!', 12))"
```

Copy the output hash.

### 8.2 Insert Merchant
```bash
sudo -u postgres psql ngabopay_prod <<EOF
INSERT INTO merchants (id, email, password_hash, business_name, phone, country, is_active)
VALUES (
  gen_random_uuid(),
  'admin@ngabopay.com',
  '$2a$12$YOUR_HASH_HERE',
  'NgaboPay Operations',
  '+256772123456',
  'UG',
  true
);
EOF
```

---

## 🌟 Step 9: Use the Binance Browser

### 9.1 Login to Dashboard
1. Open `http://104.37.184.215:3001`
2. Login with: `admin@ngabopay.com` / `YourPassword123!`

### 9.2 Navigate to Binance Page
Click on "Binance P2P" in the sidebar (or go to `/dashboard/binance`)

### 9.3 Launch Browser
1. Click **"🚀 Launch Browser"** button
2. Copy the VNC URL that appears
3. Open VNC URL in new tab
4. Click "Connect" in noVNC interface

### 9.4 Login to Binance
1. In the VNC browser, log into your Binance account
2. Navigate to P2P → Sell USDT
3. Go back to dashboard
4. Click **"✅ Check & Save Login"**
5. You should see "Session saved successfully!"

### 9.5 Start Monitoring
1. Click **"▶️ Start Monitoring"**
2. Click **"🔄 Fetch Rates"**
3. You should see current USDT/UGX exchange rates!

---

## 📊 Step 10: Verify System Health

### 10.1 Check All Services
```bash
# PM2 processes
pm2 status

# System services
sudo systemctl status xvfb
sudo systemctl status x11vnc
sudo systemctl status novnc
sudo systemctl status postgresql
sudo systemctl status redis
sudo systemctl status nginx

# Check logs
pm2 logs --lines 50
journalctl -u xvfb -n 50
journalctl -u x11vnc -n 50
```

### 10.2 Monitor Browser Session
```bash
# Check if Chromium is running
ps aux | grep chromium

# Check VNC connections
ss -tlnp | grep 5900

# Check noVNC
ss -tlnp | grep 6080
```

---

## 🔧 Troubleshooting

### Issue: VNC shows black screen
**Solution:**
```bash
sudo systemctl restart xvfb
sudo systemctl restart x11vnc
sudo -u ngabopay /home/ngabopay/bin/launch-chromium.sh
```

### Issue: Browser won't launch from API
**Solution:**
```bash
# Check Playwright installation
npx playwright install chromium
npx playwright install-deps chromium

# Check DISPLAY variable
echo $DISPLAY  # Should be :99

# Manual test
DISPLAY=:99 chromium-browser --version
```

### Issue: Session not saving
**Solution:**
```bash
# Check permissions
sudo chown -R ngabopay:ngabopay /home/ngabopay/binance-sessions
sudo chmod 755 /home/ngabopay/binance-sessions

# Check database
sudo -u postgres psql ngabopay_prod -c "SELECT * FROM binance_sessions;"
```

### Issue: Can't fetch rates
**Solution:**
- Ensure you're logged into Binance in the VNC browser
- Check you're on the P2P page
- Click "Check & Save Login" again
- Try "Fetch Rates" again

---

## 🎉 Success Checklist

- ✅ VPS configured with firewall
- ✅ PostgreSQL and Redis running
- ✅ VNC services running (Xvfb, x11vnc, noVNC)
- ✅ NgaboPay API running (PM2)
- ✅ Dashboard accessible
- ✅ Can access VNC browser
- ✅ Can launch Chromium via API
- ✅ Can log into Binance
- ✅ Session saves successfully
- ✅ Can fetch P2P exchange rates

---

## 📝 Next Steps

1. **Android App Setup**: Deploy the USSD automation app
2. **Test Payouts**: Create test orders and process payouts
3. **Monitoring**: Set up automated rate monitoring workers
4. **Alerts**: Configure WhatsApp/Telegram notifications
5. **Backups**: Set up automated database backups

---

## 🆘 Support

- Check logs: `pm2 logs`
- VNC logs: `journalctl -u x11vnc -f`
- API logs: `pm2 logs ngabopay-api`
- Database logs: `sudo tail -f /var/log/postgresql/postgresql-15-main.log`

For issues, check the troubleshooting section or review the system logs.
