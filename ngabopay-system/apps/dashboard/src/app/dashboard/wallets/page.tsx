'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

interface Wallet {
  id: string;
  network: string;
  address: string;
  label: string | null;
  isActive: boolean;
  createdAt: string;
  _count?: { deposits: number };
}

export default function WalletsPage() {
  const router = useRouter();
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New wallet form
  const [newWallet, setNewWallet] = useState({
    network: 'TRC20',
    address: '',
    label: '',
  });

  useEffect(() => {
    loadWallets();
  }, []);

  const loadWallets = async () => {
    try {
      const res = await api.getWallets();
      setWallets(res.wallets);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    } finally {
      setLoading(false);
    }
  };

  const addWallet = async () => {
    if (!newWallet.address) {
      setMessage({ type: 'error', text: 'Address is required' });
      return;
    }

    setSaving(true);
    setMessage(null);
    try {
      await api.createWallet({
        network: newWallet.network,
        address: newWallet.address,
        label: newWallet.label || undefined,
      });
      setMessage({ type: 'success', text: 'Wallet added successfully!' });
      setShowAddModal(false);
      setNewWallet({ network: 'TRC20', address: '', label: '' });
      loadWallets();
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const getNetworkColor = (network: string) => {
    switch (network) {
      case 'TRC20':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      case 'BSC':
        return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
      case 'ETH':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      default:
        return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-ngabo-darker flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-ngabo-accent"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-ngabo-darker">
      {/* Header */}
      <header className="bg-ngabo-card border-b border-ngabo-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => router.push('/dashboard')}
                className="text-gray-400 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
              </button>
              <h1 className="text-xl font-bold text-white">Wallets</h1>
            </div>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 transition-all flex items-center space-x-2"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              <span>Add Wallet</span>
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Message */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg ${
            message.type === 'success'
              ? 'bg-green-500/10 border border-green-500/20 text-green-400'
              : 'bg-red-500/10 border border-red-500/20 text-red-400'
          }`}>
            {message.text}
          </div>
        )}

        {/* Wallets Grid */}
        {wallets.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto bg-ngabo-card rounded-full flex items-center justify-center mb-4">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-2">No wallets yet</h3>
            <p className="text-gray-400 mb-4">Add your first crypto wallet to start receiving payments.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 transition-all"
            >
              Add Your First Wallet
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {wallets.map((wallet) => (
              <div
                key={wallet.id}
                className={`bg-ngabo-card border border-ngabo-border rounded-xl p-6 ${
                  !wallet.isActive ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${getNetworkColor(wallet.network)}`}>
                    {wallet.network}
                  </span>
                  <div className={`w-2 h-2 rounded-full ${wallet.isActive ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                </div>

                <h3 className="text-white font-medium mb-1">
                  {wallet.label || 'Unnamed Wallet'}
                </h3>

                <p className="text-gray-400 text-sm font-mono break-all mb-4">
                  {wallet.address.slice(0, 10)}...{wallet.address.slice(-10)}
                </p>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-500">
                    {wallet._count?.deposits || 0} deposits
                  </span>
                  <button
                    onClick={() => navigator.clipboard.writeText(wallet.address)}
                    className="text-ngabo-accent hover:text-emerald-400 transition-all"
                  >
                    Copy Address
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Wallet Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-semibold text-white mb-4">Add New Wallet</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Network</label>
                <select
                  value={newWallet.network}
                  onChange={(e) => setNewWallet({ ...newWallet, network: e.target.value })}
                  className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                >
                  <option value="TRC20">TRC20 (TRON)</option>
                  <option value="BSC">BEP20 (BSC)</option>
                  <option value="ETH">ERC20 (Ethereum)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Wallet Address</label>
                <input
                  type="text"
                  value={newWallet.address}
                  onChange={(e) => setNewWallet({ ...newWallet, address: e.target.value })}
                  placeholder="Enter wallet address"
                  className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent font-mono"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">Label (Optional)</label>
                <input
                  type="text"
                  value={newWallet.label}
                  onChange={(e) => setNewWallet({ ...newWallet, label: e.target.value })}
                  placeholder="e.g., Main USDT Wallet"
                  className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                />
              </div>
            </div>

            <div className="flex space-x-4 mt-6">
              <button
                onClick={() => setShowAddModal(false)}
                className="flex-1 px-4 py-2 bg-ngabo-dark border border-ngabo-border text-gray-300 rounded-lg hover:bg-ngabo-border hover:text-white transition-all"
              >
                Cancel
              </button>
              <button
                onClick={addWallet}
                disabled={saving}
                className="flex-1 px-4 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
              >
                {saving ? 'Adding...' : 'Add Wallet'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
