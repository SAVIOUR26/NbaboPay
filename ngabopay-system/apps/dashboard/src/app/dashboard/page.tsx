'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Order {
  id: string;
  orderReference: string;
  cryptoReceived: number;
  cryptoCurrency: string;
  fiatAmount: number;
  fiatCurrency: string;
  netPayout: number;
  customerPhone: string;
  status: string;
  createdAt: string;
  payout?: {
    id: string;
    status: string;
  };
}

export default function DashboardPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [merchant, setMerchant] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const token = localStorage.getItem('ngabopay_token');
    const merchantData = localStorage.getItem('ngabopay_merchant');

    if (!token) {
      router.push('/');
      return;
    }

    if (merchantData) {
      setMerchant(JSON.parse(merchantData));
    }

    loadOrders();
  }, [router]);

  const loadOrders = async () => {
    try {
      setLoading(true);
      const response = await api.getOrders({ limit: 50 });
      setOrders(response.orders || []);
    } catch (error) {
      console.error('Failed to load orders:', error);
      // Use demo data if API fails
      setOrders([
        {
          id: '1',
          orderReference: 'NGP-ABC123-0001',
          cryptoReceived: 50,
          cryptoCurrency: 'USDT',
          fiatAmount: 185000,
          fiatCurrency: 'UGX',
          netPayout: 181300,
          customerPhone: '0772123456',
          status: 'approved',
          createdAt: new Date().toISOString(),
          payout: { id: 'p1', status: 'processing' },
        },
        {
          id: '2',
          orderReference: 'NGP-DEF456-0002',
          cryptoReceived: 100,
          cryptoCurrency: 'USDT',
          fiatAmount: 370000,
          fiatCurrency: 'UGX',
          netPayout: 362600,
          customerPhone: '0782987654',
          status: 'pending',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (orderId: string) => {
    try {
      setProcessingId(orderId);
      await api.approveOrder(orderId);
      await loadOrders();
    } catch (error) {
      console.error('Failed to approve order:', error);
      alert('Failed to approve order');
    } finally {
      setProcessingId(null);
    }
  };

  const handleConfirmPayout = async (payoutId: string) => {
    const transactionId = prompt('Enter mobile money transaction ID (optional):');
    try {
      setProcessingId(payoutId);
      await api.confirmPayout(payoutId, transactionId || undefined);
      await loadOrders();
      alert('Payout confirmed successfully!');
    } catch (error) {
      console.error('Failed to confirm payout:', error);
      alert('Failed to confirm payout');
    } finally {
      setProcessingId(null);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('ngabopay_token');
    localStorage.removeItem('ngabopay_merchant');
    router.push('/');
  };

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-UG', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount) + ' ' + currency;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
      verified: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
      approved: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
      paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      completed: 'bg-green-500/20 text-green-400 border-green-500/30',
      failed: 'bg-red-500/20 text-red-400 border-red-500/30',
    };
    return styles[status] || 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const filteredOrders = activeTab === 'pending'
    ? orders.filter(o => ['pending', 'verified', 'approved'].includes(o.status))
    : orders;

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
              <div>
                <h1 className="text-xl font-bold text-white">NgaboPay</h1>
                <p className="text-xs text-gray-400">{merchant?.businessName || 'Dashboard'}</p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 text-sm text-gray-400 hover:text-white transition-colors"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6">
            <p className="text-sm text-gray-400 mb-1">Pending Orders</p>
            <p className="text-2xl font-bold text-yellow-400">
              {orders.filter(o => o.status === 'pending').length}
            </p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6">
            <p className="text-sm text-gray-400 mb-1">Awaiting Payout</p>
            <p className="text-2xl font-bold text-purple-400">
              {orders.filter(o => o.status === 'approved').length}
            </p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6">
            <p className="text-sm text-gray-400 mb-1">Completed Today</p>
            <p className="text-2xl font-bold text-green-400">
              {orders.filter(o => o.status === 'completed').length}
            </p>
          </div>
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6">
            <p className="text-sm text-gray-400 mb-1">Total Volume</p>
            <p className="text-2xl font-bold text-white">
              {formatCurrency(orders.reduce((sum, o) => sum + Number(o.fiatAmount), 0), 'UGX')}
            </p>
          </div>
        </div>

        {/* Orders Table */}
        <div className="bg-ngabo-card border border-ngabo-border rounded-xl overflow-hidden">
          <div className="p-6 border-b border-ngabo-border">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-white">Orders</h2>
              <div className="flex bg-ngabo-dark rounded-lg p-1">
                <button
                  onClick={() => setActiveTab('pending')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'pending'
                      ? 'bg-ngabo-accent text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  Pending
                </button>
                <button
                  onClick={() => setActiveTab('all')}
                  className={`px-4 py-1.5 text-sm rounded-md transition-all ${
                    activeTab === 'all'
                      ? 'bg-ngabo-accent text-white'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  All Orders
                </button>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin w-8 h-8 border-2 border-ngabo-accent border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400">Loading orders...</p>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="p-12 text-center">
              <svg className="w-12 h-12 text-gray-600 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
              </svg>
              <p className="text-gray-400">No orders found</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-ngabo-dark">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Order</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Crypto</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Payout</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ngabo-border">
                  {filteredOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-ngabo-dark/50 transition-colors">
                      <td className="px-6 py-4">
                        <p className="text-white font-mono text-sm">{order.orderReference}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white">{order.cryptoReceived} {order.cryptoCurrency}</p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-emerald-400 font-semibold">
                          {formatCurrency(Number(order.netPayout), order.fiatCurrency)}
                        </p>
                      </td>
                      <td className="px-6 py-4">
                        <p className="text-white font-mono">{order.customerPhone}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2.5 py-1 text-xs font-medium rounded-full border ${getStatusBadge(order.status)}`}>
                          {order.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex space-x-2">
                          {order.status === 'pending' && (
                            <button
                              onClick={() => handleApprove(order.id)}
                              disabled={processingId === order.id}
                              className="px-3 py-1.5 bg-ngabo-accent text-white text-xs font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50"
                            >
                              {processingId === order.id ? 'Processing...' : 'Approve'}
                            </button>
                          )}
                          {order.status === 'approved' && order.payout && (
                            <button
                              onClick={() => handleConfirmPayout(order.payout!.id)}
                              disabled={processingId === order.payout.id}
                              className="px-3 py-1.5 bg-purple-600 text-white text-xs font-medium rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
                            >
                              {processingId === order.payout.id ? 'Confirming...' : 'Confirm Paid'}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="mt-8 bg-ngabo-card border border-ngabo-border rounded-xl p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Quick Actions</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button
              onClick={loadOrders}
              className="flex items-center justify-center space-x-2 p-4 bg-ngabo-dark border border-ngabo-border rounded-lg hover:border-ngabo-accent transition-colors"
            >
              <svg className="w-5 h-5 text-ngabo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-white">Refresh Orders</span>
            </button>
            <button className="flex items-center justify-center space-x-2 p-4 bg-ngabo-dark border border-ngabo-border rounded-lg hover:border-ngabo-accent transition-colors">
              <svg className="w-5 h-5 text-ngabo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
              <span className="text-white">Manage Wallets</span>
            </button>
            <button className="flex items-center justify-center space-x-2 p-4 bg-ngabo-dark border border-ngabo-border rounded-lg hover:border-ngabo-accent transition-colors">
              <svg className="w-5 h-5 text-ngabo-accent" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <span className="text-white">Settings</span>
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
