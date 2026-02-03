# 🚀 Direct VPS Deployment Steps

You're logged into the VPS. Follow these steps:

## Step 1: Clone the Repository

```bash
cd /root
git clone https://github.com/SAVIOUR26/NbaboPay.git
cd NbaboPay
```

## Step 2: Run VNC Setup

```bash
chmod +x scripts/setup-vnc-browser.sh
bash scripts/setup-vnc-browser.sh
```

This will install:
- Xvfb, x11vnc, noVNC
- Chromium browser
- All systemd services

## Step 3: Install Node.js & Dependencies

```bash
# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Install pnpm and PM2
npm install -g pnpm pm2
```

## Step 4: Setup PostgreSQL

```bash
# Install PostgreSQL
apt-get install -y postgresql postgresql-contrib

# Create database
sudo -u postgres psql <<EOF
CREATE DATABASE ngabopay_prod;
CREATE USER ngabopay_user WITH ENCRYPTED PASSWORD 'SecurePassword123!';
GRANT ALL PRIVILEGES ON DATABASE ngabopay_prod TO ngabopay_user;
ALTER DATABASE ngabopay_prod OWNER TO ngabopay_user;
\q
EOF
```

## Step 5: Install Redis & Nginx

```bash
apt-get install -y redis-server nginx
systemctl start redis
systemctl enable redis
systemctl start nginx
systemctl enable nginx
```

## Step 6: Setup Application

```bash
# Navigate to app
cd /root/NbaboPay/ngabopay-system

# Install dependencies
pnpm install

# Install Playwright
npx playwright install chromium
npx playwright install-deps chromium

# Create environment file
cat > .env.production <<EOF
DATABASE_URL="postgresql://ngabopay_user:SecurePassword123!@localhost:5432/ngabopay_prod"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="$(openssl rand -hex 32)"
JWT_EXPIRES_IN="7d"
NODE_ENV="production"
API_PORT=3000
DASHBOARD_PORT=3001
CORS_ORIGINS="http://$(hostname -I | awk '{print $1}'):3001,https://ngabopay.online"
DISPLAY=":99"
VNC_PORT=6080
EOF

# Run migrations
cd packages/shared/database
npx prisma generate
npx prisma migrate deploy
cd ../../..

# Build application
pnpm build
```

## Step 7: Create Merchant Account

```bash
# Generate password hash
PASSWORD_HASH=$(node -e "console.log(require('bcryptjs').hashSync('NgaboPay2024!', 12))")

# Create merchant
sudo -u postgres psql ngabopay_prod <<EOF
INSERT INTO merchants (id, email, password_hash, business_name, phone, country, is_active)
VALUES (
  gen_random_uuid(),
  'admin@ngabopay.com',
  '$PASSWORD_HASH',
  'NgaboPay Operations',
  '+256772123456',
  'UG',
  true
);
EOF
```

## Step 8: Start Services

```bash
# Start with PM2
pm2 start deployment/pm2/ecosystem.config.js
pm2 save
pm2 startup
# Run the command it outputs
```

## Step 9: Configure Firewall

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 3000/tcp
ufw allow 3001/tcp
ufw allow 6080/tcp
ufw --force enable
```

## Step 10: Test Access

Open in browser:
- Dashboard: http://YOUR_VPS_IP:3001
- VNC: http://YOUR_VPS_IP:6080/vnc.html
- API: http://YOUR_VPS_IP:3000/api/health

Login:
- Email: admin@ngabopay.com
- Password: NgaboPay2024!
