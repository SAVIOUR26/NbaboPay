'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function DashboardPage() {
  const router = useRouter();
  const [transactions, setTransactions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [binanceStatus, setBinanceStatus] = useState<any>(null);
  const [deviceStatus, setDeviceStatus] = useState<any>(null);
  const [monitorRunning, setMonitorRunning] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ngabopay_token');
    if (!token) { router.push('/'); return; }
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, [router]);

  const loadData = async () => {
    try {
      const [ordersRes, binanceRes, devicesRes] = await Promise.allSettled([
        api.getOrders({ limit: 20 }),
        api.getBinanceStatus(),
        api.getDevices(),
      ]);
      if (ordersRes.status === 'fulfilled') setTransactions(ordersRes.value.orders || []);
      if (binanceRes.status === 'fulfilled') setBinanceStatus(binanceRes.value);
      if (devicesRes.status === 'fulfilled') {
        const connected = devicesRes.value.devices?.filter((d: any) => d.isConnected);
        setDeviceStatus({ total: devicesRes.value.devices?.length || 0, connected: connected?.length || 0 });
      }
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const toggleMonitor = async () => {
    try {
      await api.setConfig('binance_monitor_active', monitorRunning ? 'false' : 'true');
      setMonitorRunning(!monitorRunning);
    } catch (e) { console.error(e); }
  };

  const handleLogout = () => {
    localStorage.removeItem('ngabopay_token');
    localStorage.removeItem('ngabopay_merchant');
    router.push('/');
  };

  const fmt = (n: number, c: string) =>
    new Intl.NumberFormat('en-UG', { maximumFractionDigits: 0 }).format(n) + ' ' + c;

  const statusColor = (s: string) => ({
    pending: 'text-yellow-400 bg-yellow-500/10',
    verified: 'text-blue-400 bg-blue-500/10',
    approved: 'text-purple-400 bg-purple-500/10',
    processing: 'text-orange-400 bg-orange-500/10',
    completed: 'text-green-400 bg-green-500/10',
    failed: 'text-red-400 bg-red-500/10',
  }[s] || 'text-gray-400 bg-gray-500/10');

  if (loading) return (
    <div className="min-h-screen bg-ngabo-darker flex items-center justify-center">
      <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngabo-accent"></div>
    </div>
  );

  return (
    <div className="min-h-screen bg-ngabo-darker">
      {/* Header */}
      <header className="bg-ngabo-card border-b border-ngabo-border sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-ngabo-accent to-emerald-600 rounded-xl flex items-center justify-center">
                <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold text-white">NgaboPay</h1>
            </div>
            <div className="flex items-center space-x-4">
              <button onClick={() => router.push('/dashboard/settings')} className="text-gray-400 hover:text-white">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              </button>
              <button onClick={handleLogout} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white">Logout</button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">Binance P2P</p>
              <div className={`w-2.5 h-2.5 rounded-full ${binanceStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            <p className="text-lg font-bold text-white">{binanceStatus?.connected ? 'Connected' : 'Offline'}</p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-gray-400">USSD Device</p>
              <div className={`w-2.5 h-2.5 rounded-full ${deviceStatus?.connected > 0 ? 'bg-green-500' : 'bg-red-500'}`}></div>
            </div>
            <p className="text-lg font-bold text-white">{deviceStatus?.connected > 0 ? 'Online' : 'No Device'}</p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-2">Completed</p>
            <p className="text-lg font-bold text-green-400">{transactions.filter(t => t.status === 'completed').length}</p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-5">
            <p className="text-sm text-gray-400 mb-2">Volume</p>
            <p className="text-lg font-bold text-white">{fmt(transactions.reduce((s, t) => s + Number(t.fiatAmount || 0), 0), 'UGX')}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <a href="https://p2p.binance.com" target="_blank" rel="noopener noreferrer"
            className="flex items-center space-x-3 p-4 bg-ngabo-card border border-ngabo-border rounded-xl hover:border-yellow-500/50 transition-all">
            <div className="w-10 h-10 bg-yellow-500/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" /></svg>
            </div>
            <div className="text-left">
              <p className="text-white font-medium">Open Binance P2P</p>
              <p className="text-xs text-gray-400">Login and monitor trades</p>
            </div>
          </a>

          <button onClick={toggleMonitor}
            className={`flex items-center space-x-3 p-4 bg-ngabo-card border rounded-xl transition-all ${monitorRunning ? 'border-green-500/50' : 'border-ngabo-border hover:border-ngabo-accent'}`}>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${monitorRunning ? 'bg-green-500/10' : 'bg-ngabo-accent/10'}`}>
              <div className={`w-3 h-3 rounded-full ${monitorRunning ? 'bg-green-500 animate-pulse' : 'bg-gray-500'}`}></div>
            </div>
            <div className="text-left">
              <p className="text-white font-medium">{monitorRunning ? 'Monitoring Active' : 'Start Monitor'}</p>
              <p className="text-xs text-gray-400">Auto-detect buyer payments</p>
            </div>
          </button>

          <button onClick={() => router.push('/dashboard/settings')}
            className="flex items-center space-x-3 p-4 bg-ngabo-card border border-ngabo-border rounded-xl hover:border-ngabo-accent transition-all">
            <div className="w-10 h-10 bg-ngabo-accent/10 rounded-lg flex items-center justify-center">
              <svg className="w-5 h-5 text-ngabo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </div>
            <div className="text-left">
              <p className="text-white font-medium">Settings</p>
              <p className="text-xs text-gray-400">Telegram, USSD, Business</p>
            </div>
          </button>
        </div>

        {/* Transaction Log */}
        <div className="bg-ngabo-card border border-ngabo-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-ngabo-border flex justify-between items-center">
            <h2 className="text-lg font-semibold text-white">Transactions</h2>
            <button onClick={loadData} className="text-sm text-ngabo-accent hover:text-emerald-400">Refresh</button>
          </div>
          {transactions.length === 0 ? (
            <div className="p-12 text-center">
              <p className="text-gray-400">No transactions yet. Open Binance and start monitoring.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ngabo-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Time</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Crypto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Payout</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ngabo-border">
                  {transactions.map((tx) => (
                    <tr key={tx.id} className="hover:bg-ngabo-dark/50">
                      <td className="px-6 py-4 text-sm text-gray-300">{new Date(tx.createdAt).toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-white">{tx.cryptoReceived} {tx.cryptoCurrency}</td>
                      <td className="px-6 py-4 text-sm text-emerald-400 font-semibold">{fmt(Number(tx.netPayout || tx.fiatAmount), tx.fiatCurrency)}</td>
                      <td className="px-6 py-4 text-sm text-gray-300 font-mono">{tx.customerPhone || '-'}</td>
                      <td className="px-6 py-4"><span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full ${statusColor(tx.status)}`}>{tx.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
