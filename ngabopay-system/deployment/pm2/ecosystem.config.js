// PM2 Ecosystem Configuration
// Manages all NgaboPay processes

module.exports = {
  apps: [
    {
      name: 'ngabopay-api',
      script: './apps/api/dist/server.js',
      instances: 2,
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      error_file: '/home/ngabopay/logs/api-error.log',
      out_file: '/home/ngabopay/logs/api-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '500M',
      min_uptime: '10s',
      max_restarts: 10,
      autorestart: true,
      watch: false
    },
    {
      name: 'ngabopay-dashboard',
      script: 'npm',
      args: 'start',
      cwd: './apps/dashboard',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3001
      },
      error_file: '/home/ngabopay/logs/dashboard-error.log',
      out_file: '/home/ngabopay/logs/dashboard-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '300M',
      autorestart: true
    },
    {
      name: 'binance-observer',
      script: './apps/workers/dist/binance-poller.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ngabopay/logs/binance-error.log',
      out_file: '/home/ngabopay/logs/binance-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '400M',
      autorestart: true,
      cron_restart: '0 */6 * * *', // Restart every 6 hours
      min_uptime: '30s',
      max_restarts: 10
    },
    {
      name: 'blockchain-monitor',
      script: './apps/workers/dist/blockchain-poller.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ngabopay/logs/blockchain-error.log',
      out_file: '/home/ngabopay/logs/blockchain-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '300M',
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10
    },
    {
      name: 'payout-worker',
      script: './apps/workers/dist/payout-worker.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production'
      },
      error_file: '/home/ngabopay/logs/payout-error.log',
      out_file: '/home/ngabopay/logs/payout-out.log',
      merge_logs: true,
      time: true,
      max_memory_restart: '300M',
      autorestart: true,
      min_uptime: '30s',
      max_restarts: 10
    }
  ]
};
