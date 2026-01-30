# 🚀 NgaboPay - Crypto Payment Gateway for Africa

**Automated crypto-to-fiat payment processing for African merchants**

[![Deploy Status](https://github.com/saviour123/ngabopay-system/workflows/Deploy%20to%20Production/badge.svg)](https://github.com/saviour123/ngabopay-system/actions)

## 🎯 For Claude Code

**Claude, you are in complete control. Follow these steps:**

1. **Read**: `CLAUDE_INSTRUCTIONS.md` (Your master command center)
2. **Execute**: All 8 phases in exact order
3. **Verify**: Run `scripts/test-system.sh`

**Your mission:** Build complete NgaboPay system on VPS `104.37.184.215`

## 📚 Quick Links

| Document | Purpose |
|----------|---------|
| [CLAUDE_INSTRUCTIONS.md](./CLAUDE_INSTRUCTIONS.md) | ⭐ **START HERE** - Complete autonomous build guide |
| [docs/ARCHITECTURE.md](./docs/ARCHITECTURE.md) | System architecture & design |
| [docs/SETUP_VPS.md](./docs/SETUP_VPS.md) | VPS configuration procedures |
| [docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md) | Production deployment guide |

## 🏗️ System Architecture

```
┌──────────────────────────────────────────┐
│         NGABOPAY PLATFORM                │
├──────────────────────────────────────────┤
│                                          │
│  🔧 Backend (Node.js + TypeScript)       │
│  ├─ Binance Observer (Playwright)       │
│  ├─ Blockchain Monitor (TRC20/BSC)      │
│  ├─ Business Logic Engine               │
│  ├─ API Server (Express)                │
│  └─ Workers (BullMQ)                    │
│                                          │
│  🎨 Frontend (Next.js 14)                │
│  └─ Merchant Dashboard                  │
│                                          │
│  🗄️ Data Layer                           │
│  ├─ PostgreSQL 15                        │
│  └─ Redis 7                             │
│                                          │
│  🌐 Infrastructure                       │
│  ├─ Nginx + SSL (Let's Encrypt)         │
│  ├─ PM2 Process Manager                 │
│  ├─ Ubuntu 22.04 VPS                    │
│  └─ GitHub Actions CI/CD                │
│                                          │
└──────────────────────────────────────────┘
```

## 🚀 Quick Start (Developers)

```bash
# Clone
git clone https://github.com/saviour123/ngabopay-system.git
cd ngabopay-system

# Install
pnpm install

# Setup environment
cp .env.example .env.production
# Edit .env.production with your credentials

# Database
cd packages/shared/database
npx prisma migrate dev
npx prisma generate

# Build
cd ../../..
pnpm build

# Start development
pnpm dev
```

## 📦 Repository Structure

```
ngabopay-system/
├── packages/              # Shared backend packages
│   ├── binance-observer/  # Playwright P2P monitoring
│   ├── blockchain-monitor/# Crypto deposit tracking
│   ├── business-logic/    # Core business rules
│   └── shared/            # Shared code & database
│
├── apps/
│   ├── api/               # Express REST API
│   ├── workers/           # Background job processors
│   └── dashboard/         # Next.js merchant portal
│
├── scripts/               # Setup & deployment automation
├── deployment/            # Nginx, PM2, systemd configs
├── docs/                  # Comprehensive documentation
└── .github/workflows/     # CI/CD pipelines
```

## 🔐 Security Features

- ✅ Non-root user execution
- ✅ UFW firewall configured
- ✅ fail2ban brute-force protection
- ✅ SSL/TLS encryption (A+ rating)
- ✅ Encrypted session storage (AES-256)
- ✅ Environment variable secrets
- ✅ Regular security updates

## 🧪 Testing

```bash
# Unit tests
pnpm test

# Integration tests
pnpm test:integration

# System verification (production)
ssh ngabopay@104.37.184.215
cd ngabopay-system
./scripts/test-system.sh
```

## 📈 Deployment

**Automated:** Push to `main` → Auto-deploy via GitHub Actions

**Manual:**
```bash
./scripts/deploy.sh
```

## 📊 Monitoring

```bash
# Process status
pm2 status

# Live logs
pm2 logs

# System metrics
pm2 monit

# Health check
curl https://ngabopay.online/api/health
```

## 🆘 Support

**For Claude Code:**
- Read `CLAUDE_INSTRUCTIONS.md`
- Check error logs: `pm2 logs --lines 200`
- Run diagnostics: `./scripts/troubleshoot.sh`

**For Humans:**
- Email: support@ngabopay.online
- Documentation: See `/docs` folder

## 📄 License

Proprietary © 2025 ThirdSan Enterprises Ltd

---

**Built with ❤️ in Uganda for African fintech innovation**
