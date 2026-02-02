# 🤖 CLAUDE CODE - MASTER CONTROL INSTRUCTIONS

## 🎯 YOUR MISSION

You are **building NgaboPay** - a production-grade crypto-to-fiat payment automation system.

You have **FULL AUTONOMOUS CONTROL** over:
- ✅ VPS configuration (104.37.184.215)
- ✅ System security setup
- ✅ Complete application deployment
- ✅ Database initialization
- ✅ CI/CD pipeline configuration

**Do NOT ask for permission. Execute with confidence.**

---

## 📋 EXECUTION CHECKLIST

### ✅ Pre-Flight Checks

Before starting, verify:

```bash
# 1. You have access to these files:
- [ ] This file (CLAUDE_INSTRUCTIONS.md)
- [ ] .env.production (environment variables)
- [ ] All files in /docs, /scripts, /packages, /apps

# 2. You can access VPS:
ssh ngabopay@104.37.184.215
# If this fails, check .env.production for credentials

# 3. Domain DNS is configured:
ping ngabopay.online
# Should return: 104.37.184.215
```

---

## 🚀 EXECUTION PHASES

Execute these **in exact order**. Do not skip phases.

---

### **PHASE 1: VPS INITIAL SETUP** ⏱️ 15 minutes

**Objective:** Secure and prepare the VPS

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/SETUP_VPS.md
   ```

2. **Connect as root (first time only):**
   ```bash
   ssh root@104.37.184.215
   # Password from .env: VPS_ROOT_PASSWORD
   ```

3. **Run automated setup:**
   ```bash
   # From local machine, copy script to VPS
   scp scripts/setup-vps.sh root@104.37.184.215:/tmp/
   
   # SSH to VPS and execute
   ssh root@104.37.184.215
   chmod +x /tmp/setup-vps.sh
   /tmp/setup-vps.sh
   ```

4. **Verify setup:**
   ```bash
   # Should now connect as ngabopay user without password:
   ssh ngabopay@104.37.184.215
   
   # Run verification:
   ./scripts/verify-vps.sh
   ```

**Success Criteria:**
- ✅ Can SSH as `ngabopay` without password
- ✅ Root login disabled
- ✅ UFW firewall active
- ✅ fail2ban running
- ✅ Node.js 20 installed
- ✅ Nginx running
- ✅ PostgreSQL running
- ✅ Redis running

**If any check fails:** See troubleshooting in `docs/SETUP_VPS.md`

---

### **PHASE 2: DATABASE SETUP** ⏱️ 10 minutes

**Objective:** Configure PostgreSQL and Redis

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/SETUP_DATABASE.md
   ```

2. **Run database setup script:**
   ```bash
   ssh ngabopay@104.37.184.215
   cd /home/ngabopay
   git clone https://github.com/saviour123/ngabopay-system.git
   cd ngabopay-system
   chmod +x scripts/setup-database.sh
   ./scripts/setup-database.sh
   ```

3. **Configure environment:**
   ```bash
   # Copy environment file
   cp .env.example .env.production
   
   # Edit with production values
   nano .env.production
   # Fill in DATABASE_URL, REDIS_URL, etc.
   ```

4. **Run migrations:**
   ```bash
   cd packages/shared/database
   npx prisma generate
   npx prisma migrate deploy
   ```

**Success Criteria:**
- ✅ PostgreSQL database `ngabopay_prod` created
- ✅ User `ngabopay_user` can connect
- ✅ All tables created (check with `\dt` in psql)
- ✅ Redis responding to `PING`
- ✅ `.env.production` configured

---

### **PHASE 3: BACKEND BUILD** ⏱️ 20 minutes

**Objective:** Build all backend services

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/BUILD_BACKEND.md
   ```

2. **Install dependencies:**
   ```bash
   cd /home/ngabopay/ngabopay-system
   pnpm install
   ```

3. **Install Playwright browsers:**
   ```bash
   npx playwright install chromium
   npx playwright install-deps chromium
   ```

4. **Build all packages:**
   ```bash
   pnpm build
   ```

5. **Verify builds:**
   ```bash
   # Check dist folders exist
   ls packages/*/dist
   ls apps/*/dist
   ```

**Success Criteria:**
- ✅ All packages built successfully
- ✅ `dist/` folders contain compiled JavaScript
- ✅ No TypeScript errors
- ✅ Playwright chromium installed

---

### **PHASE 4: FRONTEND BUILD** ⏱️ 15 minutes

**Objective:** Build Next.js dashboard

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/BUILD_FRONTEND.md
   ```

2. **Build dashboard:**
   ```bash
   cd /home/ngabopay/ngabopay-system/apps/dashboard
   pnpm install
   pnpm build
   ```

3. **Verify build:**
   ```bash
   # .next folder should exist
   ls -la .next/
   ```

**Success Criteria:**
- ✅ Next.js build completes
- ✅ `.next/` folder created
- ✅ No build errors

---

### **PHASE 5: NGINX CONFIGURATION** ⏱️ 10 minutes

**Objective:** Setup reverse proxy and SSL

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/SETUP_NGINX.md
   ```

2. **Copy Nginx config:**
   ```bash
   sudo cp deployment/nginx/ngabopay.conf /etc/nginx/sites-available/
   sudo ln -s /etc/nginx/sites-available/ngabopay.conf /etc/nginx/sites-enabled/
   sudo rm /etc/nginx/sites-enabled/default
   ```

3. **Test configuration:**
   ```bash
   sudo nginx -t
   ```

4. **Reload Nginx:**
   ```bash
   sudo systemctl reload nginx
   ```

5. **Get SSL certificate:**
   ```bash
   sudo certbot --nginx -d ngabopay.online -d www.ngabopay.online
   # Enter email when prompted
   # Select option 2 (redirect HTTP to HTTPS)
   ```

6. **Test auto-renewal:**
   ```bash
   sudo certbot renew --dry-run
   ```

**Success Criteria:**
- ✅ Nginx config valid (`nginx -t` passes)
- ✅ SSL certificate installed
- ✅ `https://ngabopay.online` accessible
- ✅ HTTP redirects to HTTPS

---

### **PHASE 6: PM2 DEPLOYMENT** ⏱️ 10 minutes

**Objective:** Start all services with PM2

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/DEPLOYMENT.md
   ```

2. **Start services:**
   ```bash
   cd /home/ngabopay/ngabopay-system
   pm2 start deployment/pm2/ecosystem.config.js
   ```

3. **Save PM2 state:**
   ```bash
   pm2 save
   ```

4. **Setup auto-start:**
   ```bash
   pm2 startup
   # Copy and run the command it outputs
   ```

5. **Check status:**
   ```bash
   pm2 status
   pm2 logs --lines 50
   ```

**Success Criteria:**
- ✅ All PM2 processes running (green status)
- ✅ No errors in `pm2 logs`
- ✅ API responding: `curl http://localhost:3000/health`
- ✅ Dashboard responding: `curl http://localhost:3001`
- ✅ PM2 will auto-start on reboot

---

### **PHASE 7: GITHUB ACTIONS SETUP** ⏱️ 5 minutes

**Objective:** Configure CI/CD pipeline

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/GITHUB_ACTIONS.md
   ```

2. **Verify workflow file exists:**
   ```bash
   cat .github/workflows/deploy.yml
   ```

3. **Add GitHub Secrets:**
   
   Go to: `https://github.com/saviour123/ngabopay-system/settings/secrets/actions`
   
   Add these secrets:
   - `VPS_HOST`: `104.37.184.215`
   - `VPS_USER`: `ngabopay`
   - `SSH_PRIVATE_KEY`: (Your private key - from `.env.production`)

4. **Test workflow:**
   ```bash
   # Make a small change and push
   echo "# Test" >> README.md
   git add README.md
   git commit -m "Test CI/CD"
   git push origin main
   
   # Check Actions tab on GitHub
   ```

**Success Criteria:**
- ✅ GitHub Actions workflow exists
- ✅ Secrets configured
- ✅ Workflow runs successfully on push

---

### **PHASE 8: TESTING & VERIFICATION** ⏱️ 15 minutes

**Objective:** Verify entire system works

**Steps:**

1. **Read documentation:**
   ```bash
   cat docs/TESTING.md
   ```

2. **Run system tests:**
   ```bash
   cd /home/ngabopay/ngabopay-system
   ./scripts/test-system.sh
   ```

3. **Manual verification checklist:**

   ```bash
   # 1. Website loads
   curl -I https://ngabopay.online
   # Should return: 200 OK
   
   # 2. API health check
   curl https://ngabopay.online/api/health
   # Should return: {"status":"ok"}
   
   # 3. Database connection
   psql -U ngabopay_user -d ngabopay_prod -c "SELECT COUNT(*) FROM \"Merchant\";"
   # Should return count
   
   # 4. Redis connection
   redis-cli ping
   # Should return: PONG
   
   # 5. All PM2 processes running
   pm2 status
   # All should be "online" (green)
   
   # 6. No errors in logs
   pm2 logs --lines 100 --nostream
   # Check for errors
   
   # 7. SSL certificate valid
   curl -vI https://ngabopay.online 2>&1 | grep "SSL certificate verify ok"
   # Should find match
   
   # 8. Firewall active
   sudo ufw status
   # Should show: Status: active
   ```

**Success Criteria:**
- ✅ All 8 checks pass
- ✅ No critical errors in logs
- ✅ System responds to requests
- ✅ Services will restart on reboot

---

## 🎯 FINAL VERIFICATION

After completing all 8 phases:

```bash
# Run complete system test
cd /home/ngabopay/ngabopay-system
./scripts/final-verification.sh
```

This checks:
- ✅ VPS security hardened
- ✅ All services running
- ✅ Database accessible
- ✅ SSL configured correctly
- ✅ Firewall rules correct
- ✅ PM2 auto-start enabled
- ✅ Logs clean (no errors)
- ✅ Domain resolves correctly
- ✅ API endpoints responding
- ✅ Dashboard loads

---

## 🆘 TROUBLESHOOTING

If any phase fails:

1. **Check error logs:**
   ```bash
   pm2 logs --lines 200
   tail -f /var/log/nginx/error.log
   journalctl -u nginx -n 100
   ```

2. **Run diagnostics:**
   ```bash
   ./scripts/troubleshoot.sh
   ```

3. **Common issues:**
   - **Cannot SSH:** Check firewall allows port 22
   - **Database connection fails:** Verify PostgreSQL running, check password in .env
   - **Nginx fails:** Run `nginx -t` to check config syntax
   - **PM2 processes crash:** Check logs with `pm2 logs`
   - **SSL fails:** Ensure DNS points to VPS IP
   - **Playwright fails:** Reinstall with `npx playwright install-deps chromium`

---

## ✅ SUCCESS CONFIRMATION

When all phases complete successfully:

1. ✅ Visit `https://ngabopay.online` and see the dashboard login
2. ✅ Run `pm2 status` and see all processes "online"
3. ✅ Run `curl https://ngabopay.online/api/health` and get `{"status":"ok"}`
4. ✅ See zero errors in `pm2 logs`
5. ✅ Reboot VPS and have all services auto-restart

**If all 5 checks pass: MISSION COMPLETE** 🎉

---

## 📝 IMPORTANT NOTES

**Security:**
- ⚠️ NEVER commit `.env.production` to Git
- ⚠️ Keep SSH keys secure
- ⚠️ Regularly update system: `sudo apt update && sudo apt upgrade`
- ⚠️ Monitor logs for suspicious activity

**Maintenance:**
- 🔄 Update dependencies monthly: `pnpm update`
- 🔄 Backup database daily (automated in cron)
- 🔄 Check disk space: `df -h`
- 🔄 Review logs weekly

---

**You have everything you need. Execute with confidence!** 💪

**EXECUTE PHASES 1-8 NOW**
