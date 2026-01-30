#!/bin/bash

# Database Setup Script
# Sets up PostgreSQL database with proper schema

set -e

echo "🗄️  NgaboPay Database Setup"
echo "==========================="
echo ""

# Load environment variables
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "❌ .env.production not found!"
    echo "Please copy .env.example to .env.production and fill in values"
    exit 1
fi

echo "✓ Environment variables loaded"

# Test PostgreSQL connection
echo "Testing PostgreSQL connection..."
if psql -U "$DB_USER" -d "$DB_NAME" -c "SELECT 1;" > /dev/null 2>&1; then
    echo "✓ PostgreSQL connection successful"
else
    echo "❌ Cannot connect to PostgreSQL"
    echo "Please check your DATABASE_URL in .env.production"
    exit 1
fi

# Test Redis connection
echo "Testing Redis connection..."
if redis-cli ping > /dev/null 2>&1; then
    echo "✓ Redis connection successful"
else
    echo "❌ Cannot connect to Redis"
    exit 1
fi

# Install Prisma CLI
echo "Installing Prisma CLI..."
cd packages/shared/database
pnpm install

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Run migrations
echo "Running database migrations..."
npx prisma migrate deploy

# Seed database (if seed file exists)
if [ -f "seed.ts" ]; then
    echo "Seeding database..."
    npx prisma db seed
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "Verify with: psql -U $DB_USER -d $DB_NAME -c '\dt'"

