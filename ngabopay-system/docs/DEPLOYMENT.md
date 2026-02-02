# NgaboPay Production Deployment Guide

## Pre-Deployment Checklist

- [ ] VPS provisioned (104.37.184.215)
- [ ] Domain purchased (ngabopay.online)
- [ ] DNS configured (A record pointing to VPS)
- [ ] SSH keys generated
- [ ] GitHub repository created
- [ ] Environment variables prepared
- [ ] External API keys obtained (TronGrid, BSCScan)

## Deployment Methods

### Method 1: Automated (Recommended for Claude Code)

Run the complete setup script:
```bash
./scripts/setup-vps.sh
```

### Method 2: Manual Step-by-Step

See QUICKSTART.md for detailed steps.

### Method 3: GitHub Actions (CI/CD)

Push to main branch triggers automatic deployment.

## Post-Deployment Tasks

### 1. SSL Certificate
```bash
sudo certbot --nginx -d ngabopay.online -d www.ngabopay.online
sudo certbot renew --dry-run  # Test auto-renewal
```

### 2. Database Backup
```bash
# Setup automated backups
crontab -e

# Add this line (daily 2 AM backup):
0 2 * * * /home/ngabopay/ngabopay-system/scripts/backup.sh
```

### 3. Monitoring
```bash
# Install PM2 monitoring
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 100M
pm2 set pm2-logrotate:retain 7
```

### 4. Firewall Verification
```bash
sudo ufw status verbose
# Should show: 22/tcp, 80/tcp, 443/tcp ALLOW
```

## Health Checks

### Application Health
```bash
# API health
curl https://ngabopay.online/api/health

# Expected response:
{"status":"ok","timestamp":"2025-01-29T...","uptime":1234}
```

### Process Health
```bash
pm2 status
# All processes should show "online" status
```

### Database Health
```bash
psql -U ngabopay_user -d ngabopay_prod -c "SELECT COUNT(*) FROM merchants;"
```

### Redis Health
```bash
redis-cli ping
# Should return: PONG
```

## Rollback Procedure

If deployment fails:

```bash
# Stop services
pm2 stop all

# Restore from backup
./scripts/restore-backup.sh

# Rollback code
git reset --hard HEAD~1

# Rebuild
pnpm build

# Restart
pm2 restart all
```

## Performance Tuning

### Database Optimization
```sql
-- Create indexes
CREATE INDEX idx_orders_merchant ON orders(merchant_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_orders_created ON orders(created_at DESC);
```

### Nginx Caching
```nginx
# Add to nginx config
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=api_cache:10m max_size=100m;
```

### PM2 Clustering
```javascript
// In ecosystem.config.js, increase instances:
instances: 4,  // Scale based on CPU cores
```

## Security Hardening

### 1. Firewall Rules
```bash
sudo ufw limit 22/tcp
sudo ufw deny from <SUSPICIOUS_IP>
```

### 2. fail2ban Configuration
```bash
sudo nano /etc/fail2ban/jail.local
# Set maxretry = 3
# Set bantime = 3600
```

### 3. SSL Hardening
```bash
# Test SSL rating
curl https://www.ssllabs.com/ssltest/analyze.html?d=ngabopay.online
# Target: A+ rating
```

### 4. Database Security
```sql
-- Restrict PostgreSQL network access
# Edit /etc/postgresql/*/main/pg_hba.conf
# Only allow local connections
```

## Monitoring & Alerts

### Setup Sentry (Error Tracking)
```bash
# Add to .env.production
SENTRY_DSN=your-sentry-dsn
```

### Setup UptimeRobot (Uptime Monitoring)
1. Visit https://uptimerobot.com
2. Add monitor: https://ngabopay.online/api/health
3. Configure email/SMS alerts

### Custom Alerts
```bash
# Add to cron for disk space alerts
0 */6 * * * /home/ngabopay/ngabopay-system/scripts/check-disk-space.sh
```

## Maintenance Schedule

### Daily
- Check PM2 logs for errors
- Verify backup completion
- Monitor disk space

### Weekly
- Review error logs
- Check SSL certificate expiry
- Update dependencies

### Monthly
- System updates: `sudo apt update && sudo apt upgrade`
- Database vacuum: `VACUUM ANALYZE;`
- Review access logs

## Troubleshooting Guide

### Issue: PM2 processes keep crashing
```bash
pm2 logs --lines 200
# Check for errors
pm2 restart all --update-env
```

### Issue: Database connection errors
```bash
sudo systemctl status postgresql
# Restart if needed
sudo systemctl restart postgresql
```

### Issue: High memory usage
```bash
pm2 monit
# Identify problematic process
pm2 restart <process-name>
```

### Issue: SSL certificate renewal fails
```bash
sudo certbot renew --dry-run
# Check for errors
sudo certbot certificates
```

## Emergency Contacts

- **VPS Provider:** InterServer Support (877-566-8398)
- **Domain Registrar:** Check your registrar's support
- **Database Issues:** Check PostgreSQL logs
- **Application Issues:** Check PM2 logs

---

**Deployment Status:** Production Ready ✅

**Last Updated:** 2025-01-29
