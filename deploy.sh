#!/bin/bash
# NgaboPay Simple Deploy Script
# Usage: SSH into VPS, navigate to project folder, run ./deploy.sh

set -e

echo "=== NgaboPay Deploy ==="
echo "Starting at $(date)"

# Pull latest code
echo "Pulling latest code..."
git pull origin main || git pull origin master

# Navigate to the app folder
cd ngabopay-system

# Install dependencies
echo "Installing dependencies..."
npm install

# Generate Prisma client
echo "Generating Prisma client..."
cd packages/shared/database
npx prisma generate
npx prisma db push --accept-data-loss
cd ../../..

# Build dashboard
echo "Building dashboard..."
cd apps/dashboard
npm run build
cd ../..

# Restart services
echo "Restarting PM2 services..."
pm2 restart all || {
  echo "Starting services fresh..."
  pm2 delete all 2>/dev/null || true
  cd apps/dashboard && pm2 start npm --name "ngabopay-dashboard" -- start && cd ../..
  cd apps/api && pm2 start npm --name "ngabopay-api" -- start && cd ../..
  pm2 save
}

echo ""
echo "=== Deploy Complete ==="
pm2 status
echo "Dashboard: https://ngabopay.online"
echo "API Health: https://ngabopay.online/api/health"
