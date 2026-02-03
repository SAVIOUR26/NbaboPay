# 🖥️ VNC Browser Feature - Technical Documentation

## Overview

The VNC Browser feature allows clients to log into their Binance P2P account through a remote browser running on the NgaboPay VPS server. This enables session persistence and automated rate monitoring without exposing credentials.

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    CLIENT BROWSER                       │
│  ┌──────────────────────────────────────────────────┐   │
│  │         NgaboPay Dashboard                        │   │
│  │  ┌──────────────┐    ┌────────────────────────┐  │   │
│  │  │Launch Browser│ -> │ noVNC (Port 6080)      │  │   │
│  │  └──────────────┘    └────────────────────────┘  │   │
│  │                                                   │   │
│  │  [Check Login] [Start Monitoring] [Fetch Rates]  │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────┬───────────────────────────────────┘
                      │ HTTPS/WSS
                      │
┌─────────────────────▼───────────────────────────────────┐
│                  VPS SERVER (104.37.184.215)            │
│  ┌──────────────────────────────────────────────────┐   │
│  │  Nginx Reverse Proxy (Port 80/443)               │   │
│  └────────┬────────────────────┬─────────────────────┘   │
│           │                    │                          │
│  ┌────────▼─────────┐  ┌──────▼──────────────────────┐   │
│  │ API Server       │  │  noVNC WebSocket Proxy      │   │
│  │ (Port 3000)      │  │  (Port 6080)                │   │
│  │                  │  └──────┬──────────────────────┘   │
│  │ /api/binance/    │         │                          │
│  │  - launch        │  ┌──────▼──────────────────────┐   │
│  │  - check-login   │  │  x11vnc (Port 5900)         │   │
│  │  - start-monitor │  │  VNC Server                 │   │
│  │  - rates         │  └──────┬──────────────────────┘   │
│  └──────────────────┘         │                          │
│                         ┌──────▼──────────────────────┐   │
│                         │  Xvfb Display :99          │   │
│                         │  Virtual X Server          │   │
│                         └──────┬──────────────────────┘   │
│                                │                          │
│  ┌─────────────────────────────▼────────────────────┐    │
│  │  Chromium Browser (Playwright Controlled)        │    │
│  │  - Binance P2P page loaded                       │    │
│  │  - Session cookies saved to disk                 │    │
│  │  - Remote debugging port 9222                    │    │
│  └──────────────────────────────────────────────────┘    │
│                                                           │
│  ┌──────────────────────────────────────────────────┐    │
│  │  PostgreSQL Database                             │    │
│  │  - binance_sessions table                        │    │
│  │  - exchange_rates table                          │    │
│  └──────────────────────────────────────────────────┘    │
└───────────────────────────────────────────────────────────┘
```

---

## Components

### 1. Xvfb (X Virtual Framebuffer)
- **Purpose**: Creates a virtual display (`:99`) without physical monitor
- **Service**: `xvfb.service` (systemd)
- **Resolution**: 1920x1080x24
- **Command**: `/usr/bin/Xvfb :99 -screen 0 1920x1080x24 -ac +extension GLX +render -noreset`

### 2. x11vnc (VNC Server)
- **Purpose**: Exposes the virtual display via VNC protocol
- **Service**: `x11vnc.service` (systemd)
- **Port**: 5900
- **Display**: `:99`
- **Command**: `/usr/bin/x11vnc -display :99 -forever -shared -rfbport 5900 -nopw`

### 3. noVNC (Web VNC Client)
- **Purpose**: Provides browser-based VNC access (no desktop client needed)
- **Service**: `novnc.service` (systemd)
- **Port**: 6080
- **Protocol**: WebSocket proxy to VNC
- **Command**: `/usr/share/novnc/utils/novnc_proxy --vnc localhost:5900 --listen 6080`

### 4. Chromium Browser
- **Purpose**: Displays Binance P2P page for client login
- **Controlled by**: Playwright (Node.js)
- **Profile**: `/home/ngabopay/.chromium-profile` (persistent)
- **Remote Debug**: Port 9222
- **Flags**:
  - `--no-sandbox` - Required for server environment
  - `--disable-setuid-sandbox` - Security for non-root
  - `--remote-debugging-port=9222` - Debug protocol
  - `--disable-blink-features=AutomationControlled` - Anti-detection

### 5. BinanceClient (Playwright)
**File**: `packages/binance-observer/src/BinanceClient.ts`

**Key Methods**:
```typescript
class BinanceClient {
  async launch(): Promise<void>
  // Launches Chromium in Xvfb display :99

  async navigateToP2P(fiat: string): Promise<void>
  // Opens Binance P2P sell page

  async isLoggedIn(): Promise<boolean>
  // Checks for user avatar vs login button

  async saveSession(): Promise<void>
  // Saves cookies to /home/ngabopay/binance-sessions/{id}.json

  async restoreSession(): Promise<boolean>
  // Loads cookies from disk on launch

  async scrapeExchangeRates(fiat: string): Promise<ExchangeRate>
  // Extracts order prices from P2P page
}
```

### 6. API Endpoints
**File**: `apps/api/src/routes/binance.ts`

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/binance/launch-browser` | POST | Launch Chromium, return noVNC URL |
| `/api/binance/check-login` | POST | Check if logged in, save session |
| `/api/binance/session-status` | GET | Get current session validity |
| `/api/binance/start-monitoring` | POST | Start rate monitoring |
| `/api/binance/stop-monitoring` | POST | Close browser |
| `/api/binance/rates` | GET | Scrape current rates |
| `/api/binance/close-browser` | POST | Explicitly close browser |

### 7. Dashboard Page
**File**: `apps/dashboard/src/app/dashboard/binance/page.tsx`

**Features**:
- Session status display (Valid/Invalid, Active/Inactive)
- Launch Browser button
- Check & Save Login button
- Start/Stop Monitoring buttons
- Fetch Rates button
- Live exchange rate display (Buy/Sell/Avg/Spread)
- VNC URL with instructions

---

## Data Flow

### Login Flow
```
1. User clicks "Launch Browser" in dashboard
   ↓
2. Dashboard calls POST /api/binance/launch-browser
   ↓
3. API creates BinanceClient instance
   ↓
4. BinanceClient launches Chromium with Playwright
   - Sets DISPLAY=:99 (Xvfb)
   - Opens Binance P2P page
   - Tries to restore previous session
   ↓
5. API returns noVNC URL to dashboard
   ↓
6. User opens noVNC URL in new tab
   ↓
7. noVNC connects via WebSocket to x11vnc
   ↓
8. x11vnc streams Xvfb display :99
   ↓
9. User sees Chromium with Binance page
   ↓
10. User logs into Binance manually
   ↓
11. User returns to dashboard, clicks "Check & Save Login"
   ↓
12. Dashboard calls POST /api/binance/check-login
   ↓
13. API checks if user avatar present
   ↓
14. If logged in:
    - BinanceClient.saveSession() saves cookies to disk
    - Database binance_sessions table updated
    - Returns success
```

### Rate Monitoring Flow
```
1. User clicks "Start Monitoring"
   ↓
2. Dashboard calls POST /api/binance/start-monitoring
   ↓
3. API ensures browser is active (launches if needed)
   ↓
4. User clicks "Fetch Rates"
   ↓
5. Dashboard calls GET /api/binance/rates?fiatCurrency=UGX
   ↓
6. API calls BinanceClient.scrapeExchangeRates()
   ↓
7. Playwright extracts prices from DOM:
    - Finds all [class*="advertise"] elements
    - Extracts price text
    - Parses numbers
   ↓
8. Calculates:
    - Buy rate (max price)
    - Sell rate (min price)
    - Average rate
    - Spread
   ↓
9. Saves to exchange_rates table
   ↓
10. Returns rates to dashboard
   ↓
11. Dashboard displays in colored cards
```

---

## Database Schema

### binance_sessions Table
```sql
CREATE TABLE binance_sessions (
  id                VARCHAR PRIMARY KEY,
  merchant_id       VARCHAR UNIQUE REFERENCES merchants(id),
  session_data      JSON,              -- Launch metadata
  is_valid          BOOLEAN,           -- Is session logged in?
  last_checked      TIMESTAMP,
  last_used         TIMESTAMP,
  expires_at        TIMESTAMP,
  invalid_reason    TEXT,
  created_at        TIMESTAMP,
  updated_at        TIMESTAMP
);
```

### Session File Format
**Path**: `/home/ngabopay/binance-sessions/{merchant_id}.json`
```json
{
  "id": "merchant-uuid",
  "cookies": [
    {
      "name": "cookie_name",
      "value": "cookie_value",
      "domain": ".binance.com",
      "path": "/",
      "expires": 1234567890,
      "httpOnly": true,
      "secure": true,
      "sameSite": "Lax"
    }
  ],
  "localStorage": {},
  "createdAt": "2024-01-01T00:00:00Z",
  "lastUsed": "2024-01-01T00:00:00Z",
  "expiresAt": "2024-01-08T00:00:00Z",
  "userAgent": "Mozilla/5.0...",
  "isValid": true
}
```

---

## Security Considerations

### ✅ Implemented
1. **Non-root execution**: Chromium runs as `ngabopay` user
2. **Firewall**: UFW restricts access to necessary ports only
3. **No password VNC**: VNC runs without password (only localhost)
4. **Session encryption**: Cookies stored on encrypted disk
5. **JWT auth**: All API endpoints require valid JWT token
6. **CORS**: Limited to dashboard origin only

### ⚠️ Considerations
1. **No VNC password**: Acceptable since VNC only binds to localhost. Nginx proxy handles auth.
2. **Session files on disk**: Cookies are sensitive. Ensure file permissions are 600.
3. **Shared VNC**: Only one client should access at a time. Consider adding lock.

### 🔒 Recommendations
1. Add Nginx basic auth for `/vnc` endpoint
2. Implement VNC password via x11vnc `-passwd` flag
3. Rotate sessions periodically (7-day expiry already implemented)
4. Add IP whitelist for VNC access
5. Use SSH tunnel instead of exposing port 6080:
   ```bash
   ssh -L 6080:localhost:6080 ngabopay@vps-ip
   # Then access http://localhost:6080
   ```

---

## Troubleshooting

### Browser shows blank page
**Cause**: Playwright navigation failed
**Solution**:
```bash
# Check if Chromium running
ps aux | grep chromium

# Restart manually
sudo -u ngabopay /home/ngabopay/bin/launch-chromium.sh

# Check logs
journalctl -u xvfb -n 50
pm2 logs ngabopay-api
```

### VNC shows black screen
**Cause**: Xvfb not running or wrong display
**Solution**:
```bash
sudo systemctl restart xvfb
sudo systemctl restart x11vnc
echo $DISPLAY  # Should be :99
```

### Session not persisting
**Cause**: Cookies not saving or wrong permissions
**Solution**:
```bash
# Check session files
ls -la /home/ngabopay/binance-sessions/

# Fix permissions
sudo chown -R ngabopay:ngabopay /home/ngabopay/binance-sessions
sudo chmod 700 /home/ngabopay/binance-sessions
sudo chmod 600 /home/ngabopay/binance-sessions/*.json
```

### Rates return empty
**Cause**: Not logged in or P2P page structure changed
**Solution**:
1. Check if logged in: `POST /api/binance/check-login`
2. Take screenshot: `BinanceClient.screenshot('debug.png')`
3. Check Playwright selectors in `BinanceClient.scrapeExchangeRates()`
4. Update selectors if Binance changed UI

---

## Performance & Scaling

### Current Limits
- **1 browser instance** per merchant
- **Chromium RAM usage**: ~200-400 MB
- **Xvfb RAM usage**: ~50 MB
- **noVNC connections**: Unlimited (WebSocket)
- **VNC connections**: Shared (multiple clients see same screen)

### Scaling Options
1. **Multiple displays**: Run Xvfb :100, :101... for multiple merchants
2. **Docker containers**: Isolate each browser in container
3. **Separate VPS**: Dedicated browser server
4. **Headless mode**: Remove VNC, fully automate (requires Binance API credentials)

---

## Future Enhancements

1. **Auto-login**: If Binance provides API or OAuth
2. **Multi-currency**: Support KES, TZS, NGN simultaneously
3. **Rate alerts**: Notify when rate exceeds threshold
4. **Chart visualization**: Historical rate trends
5. **Auto-refresh**: Fetch rates every 5 minutes automatically
6. **Session health monitoring**: Auto-restart if session expires
7. **Screenshot API**: Allow viewing browser state via API
8. **Recording**: Record VNC session for audit

---

## Testing Checklist

- [ ] VNC services start on boot
- [ ] Can access noVNC at http://vps-ip:6080
- [ ] Browser launches via API call
- [ ] Can log into Binance via VNC
- [ ] Session saves successfully
- [ ] Session restores after API restart
- [ ] Rates scrape correctly
- [ ] Multiple rate fetches work
- [ ] Browser closes cleanly
- [ ] Services restart after VPS reboot

---

## Maintenance

### Daily
- Check PM2 status: `pm2 status`
- Review logs: `pm2 logs --lines 100`

### Weekly
- Check session validity: `POST /api/binance/check-login`
- Verify rates accuracy: Compare with Binance website

### Monthly
- Update Chromium: `npx playwright install chromium`
- Rotate sessions: Force re-login
- Review security logs: `sudo grep -i vnc /var/log/auth.log`

---

**Last Updated**: 2024-01-01
**Version**: 1.0.0
**Author**: NgaboPay Development Team
