# NgaboPay Deployment Guide

## GitHub Secrets Setup

Before deploying, you need to configure the following secrets in your GitHub repository:

1. Go to your GitHub repository
2. Navigate to **Settings** > **Secrets and variables** > **Actions**
3. Click **New repository secret** and add each of the following:

### Required Secrets

| Secret Name | Description | Example Value |
|-------------|-------------|---------------|
| `VPS_HOST` | Your VPS IP address | `104.37.184.215` |
| `VPS_USER` | SSH username | `root` |
| `VPS_SSH_KEY` | Private SSH key for VPS access | (see below) |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://ngabopay_user:NgaboSecure2026!@localhost:5432/ngabopay_prod` |
| `JWT_SECRET` | Secret key for JWT tokens | `your-super-secret-jwt-key-change-me` |
| `CONFIG_ENCRYPTION_KEY` | 32-char key for encrypting sensitive config | `ngabopay-encryption-key-32chars!` |

### Optional Secrets (for notifications)

| Secret Name | Description |
|-------------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram bot token for deployment notifications |
| `TELEGRAM_CHAT_ID` | Telegram chat ID for notifications |

## Setting Up SSH Key Authentication

### Option 1: Generate new SSH key pair

```bash
# On your local machine
ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/ngabopay_deploy

# Copy public key to VPS
ssh-copy-id -i ~/.ssh/ngabopay_deploy.pub root@104.37.184.215

# Copy the PRIVATE key content for GitHub secret
cat ~/.ssh/ngabopay_deploy
```

### Option 2: Use existing key

If you already have SSH access to the VPS:
```bash
cat ~/.ssh/id_rsa  # or id_ed25519
```

Copy the entire content (including `-----BEGIN ... KEY-----` and `-----END ... KEY-----`) to the `VPS_SSH_KEY` secret.

## Manual Deployment Steps

If GitHub Actions fails or you want to deploy manually:

```bash
# SSH into VPS
ssh root@104.37.184.215

# Navigate to app directory
cd /home/ngabopay

# Pull latest code (if already cloned)
cd ngabopay-system
git pull origin main

# Or clone fresh
git clone https://github.com/YOURUSERNAME/NbaboPay.git ngabopay-system
cd ngabopay-system

# Install dependencies
npm install

# Generate Prisma client
cd packages/shared/database
npx prisma generate
npx prisma db push
cd ../../..

# Build dashboard
cd apps/dashboard
npm run build
cd ../..

# Start services with PM2
pm2 delete all
cd apps/dashboard && pm2 start npm --name "ngabopay-dashboard" -- start && cd ../..
cd apps/api && pm2 start npm --name "ngabopay-api" -- start && cd ../..
pm2 save
```

## Verifying Deployment

After deployment, verify:

1. **Dashboard**: https://ngabopay.online
2. **API Health**: https://ngabopay.online/api/health

Check PM2 status:
```bash
ssh root@104.37.184.215 "pm2 status"
```

Check logs:
```bash
ssh root@104.37.184.215 "pm2 logs ngabopay-api --lines 50"
ssh root@104.37.184.215 "pm2 logs ngabopay-dashboard --lines 50"
```

## Nginx Configuration

The Nginx config should already be set up. If not:

```nginx
# /etc/nginx/sites-available/ngabopay
server {
    listen 80;
    server_name ngabopay.online;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name ngabopay.online;

    ssl_certificate /etc/letsencrypt/live/ngabopay.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/ngabopay.online/privkey.pem;

    # Dashboard (Next.js)
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # API
    location /api {
        proxy_pass http://localhost:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## Troubleshooting

### Build fails
- Check Node.js version (requires 20+)
- Check for TypeScript errors in logs
- Try running `npm run build` locally first

### Database connection fails
- Verify DATABASE_URL is correct
- Check PostgreSQL is running: `systemctl status postgresql`
- Test connection: `psql $DATABASE_URL -c "SELECT 1"`

### PM2 processes crash
- Check logs: `pm2 logs --lines 100`
- Check memory: `free -h`
- Restart: `pm2 restart all`

### SSL certificate issues
- Renew: `certbot renew`
- Check status: `certbot certificates`
