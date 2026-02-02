# NgaboPay Quick Start Guide

## For Claude Code - Autonomous Deployment

### Prerequisites
- VPS: 104.37.184.215 (Ubuntu 22.04)
- Domain: ngabopay.online (DNS pointed to VPS)
- SSH access configured

### Complete Deployment in 8 Steps

#### Step 1: VPS Setup (15 min)
```bash
# Connect as root
ssh root@104.37.184.215

# Run setup script
wget https://raw.githubusercontent.com/YOUR_USERNAME/ngabopay-system/main/scripts/setup-vps.sh
chmod +x setup-vps.sh
./setup-vps.sh
```

#### Step 2: Clone Repository (2 min)
```bash
# Switch to ngabopay user
su - ngabopay

# Clone repo
git clone https://github.com/YOUR_USERNAME/ngabopay-system.git
cd ngabopay-system
```

#### Step 3: Configure Environment (5 min)
```bash
# Copy environment template
cp .env.example .env.production

# Edit with your credentials
nano .env.production

# Generate secrets:
openssl rand -hex 32  # For API_SECRET
openssl rand -hex 32  # For JWT_SECRET
openssl rand -hex 32  # For ENCRYPTION_KEY
```

#### Step 4: Database Setup (10 min)
```bash
chmod +x scripts/setup-database.sh
./scripts/setup-database.sh
```

#### Step 5: Build Application (20 min)
```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build
```

#### Step 6: Nginx & SSL (10 min)
```bash
# Copy Nginx config
sudo cp deployment/nginx/ngabopay.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/ngabopay.conf /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Get SSL certificate
sudo certbot --nginx -d ngabopay.online -d www.ngabopay.online
```

#### Step 7: Start Services (5 min)
```bash
# Start with PM2
pm2 start deployment/pm2/ecosystem.config.js
pm2 save
pm2 startup
# Run the command PM2 outputs
```

#### Step 8: Verify (5 min)
```bash
# Check all services
pm2 status

# Test API
curl https://ngabopay.online/api/health

# Visit dashboard
open https://ngabopay.online
```

## Total Time: ~70 minutes

## Troubleshooting

If any step fails, run:
```bash
./scripts/troubleshoot.sh
pm2 logs --lines 100
```

## Next Steps

1. Create first merchant account
2. Connect Binance account
3. Setup mobile money credentials
4. Test with small transaction

---

**Need help?** Check `/docs` folder for detailed documentation.
