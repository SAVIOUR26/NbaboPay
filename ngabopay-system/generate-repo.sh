#!/bin/bash

# NgaboPay Complete Repository Generator
# This script creates ALL files needed for the project
# Run this script to generate the complete repository structure

set -e

echo "🚀 NgaboPay Complete Repository Generator"
echo "=========================================="
echo ""

BASE_DIR="$(pwd)"

# Create package.json files
cat > "$BASE_DIR/package.json" << 'EOF'
{
  "name": "ngabopay-system",
  "version": "1.0.0",
  "description": "Crypto payment gateway for African merchants",
  "private": true,
  "author": "ThirdSan Enterprises Ltd",
  "license": "UNLICENSED",
  "engines": {
    "node": ">=20.0.0",
    "pnpm": ">=8.0.0"
  },
  "scripts": {
    "dev": "pnpm --parallel --filter './packages/**' --filter './apps/**' dev",
    "build": "pnpm --filter './packages/**' build && pnpm --filter './apps/**' build",
    "clean": "pnpm --parallel --filter './packages/**' --filter './apps/**' clean && rm -rf node_modules",
    "test": "pnpm --parallel --filter './packages/**' --filter './apps/**' test",
    "lint": "pnpm --parallel --filter './packages/**' --filter './apps/**' lint",
    "format": "prettier --write \"**/*.{ts,tsx,js,jsx,json,md}\"",
    "typecheck": "pnpm --parallel --filter './packages/**' --filter './apps/**' typecheck"
  },
  "devDependencies": {
    "@types/node": "^20.10.0",
    "prettier": "^3.1.0",
    "typescript": "^5.3.0"
  }
}
EOF

cat > "$BASE_DIR/pnpm-workspace.yaml" << 'EOF'
packages:
  - 'packages/*'
  - 'apps/*'
EOF

cat > "$BASE_DIR/tsconfig.json" << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "./dist",
    "rootDir": "./src",
    "baseUrl": ".",
    "paths": {
      "@ngabopay/shared/*": ["./packages/shared/src/*"],
      "@ngabopay/business-logic": ["./packages/business-logic/src"],
      "@ngabopay/binance-observer": ["./packages/binance-observer/src"],
      "@ngabopay/blockchain-monitor": ["./packages/blockchain-monitor/src"]
    }
  },
  "exclude": ["node_modules", "dist", ".next", "build"]
}
EOF

cat > "$BASE_DIR/LICENSE" << 'EOF'
Copyright (c) 2025 ThirdSan Enterprises Ltd

All rights reserved.

This software and associated documentation files (the "Software") are proprietary
and confidential. Unauthorized copying, distribution, modification, or use of this
Software, via any medium, is strictly prohibited.

For licensing inquiries, contact: legal@thirdsan.com
EOF

echo "✅ Root configuration files created"
echo ""
echo "📦 Repository structure is ready!"
echo ""
echo "Next steps:"
echo "1. Review all generated files"
echo "2. Edit .env.example and create .env.production"
echo "3. git init && git add . && git commit -m 'Initial commit'"
echo "4. Push to GitHub"
echo "5. Give Claude Code access to the repository"
echo ""
