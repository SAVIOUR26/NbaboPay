'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type SettingsTab = 'telegram' | 'mobile-money' | 'wallets' | 'binance' | 'business';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('telegram');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Telegram settings
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean } | null>(null);

  // Mobile Money settings
  const [ussdFormat, setUssdFormat] = useState('*185*9*{phone}*{amount}*{pin}#');
  const [mobileMoneyPin, setMobileMoneyPin] = useState('');
  const [mobileProvider, setMobileProvider] = useState('airtel');

  // Business settings
  const [feePercent, setFeePercent] = useState('2.0');
  const [minOrder, setMinOrder] = useState('10000');
  const [maxOrder, setMaxOrder] = useState('5000000');
  const [defaultCurrency, setDefaultCurrency] = useState('UGX');

  // Binance status
  const [binanceStatus, setBinanceStatus] = useState<{ connected: boolean; expiresAt: string | null } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [configsRes, telegramRes, binanceRes] = await Promise.all([
        api.getConfigs(),
        api.getTelegramStatus(),
        api.getBinanceStatus(),
      ]);

      // Parse configs
      const configs = configsRes.configs.reduce((acc: any, c: any) => {
        acc[c.configKey] = c.configValue;
        return acc;
      }, {});

      // Set values (don't overwrite with masked values for encrypted fields)
      if (configs.telegram_chat_id) setTelegramChatId(configs.telegram_chat_id);
      if (configs.ussd_format) setUssdFormat(configs.ussd_format);
      if (configs.mobile_provider) setMobileProvider(configs.mobile_provider);
      if (configs.fee_percent) setFeePercent(configs.fee_percent);
      if (configs.min_order) setMinOrder(configs.min_order);
      if (configs.max_order) setMaxOrder(configs.max_order);
      if (configs.default_currency) setDefaultCurrency(configs.default_currency);

      setTelegramStatus(telegramRes);
      setBinanceStatus(binanceRes);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveTelegramSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configs = [];
      if (telegramBotToken) configs.push({ key: 'telegram_bot_token', value: telegramBotToken });
      if (telegramChatId) configs.push({ key: 'telegram_chat_id', value: telegramChatId });

      if (configs.length > 0) {
        await api.setBatchConfigs(configs);
        setMessage({ type: 'success', text: 'Telegram settings saved successfully!' });
        setTelegramBotToken(''); // Clear the token input after saving
        loadSettings();
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const testTelegram = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const result = await api.testTelegram();
      if (result.success) {
        setMessage({ type: 'success', text: 'Test message sent! Check your Telegram.' });
      } else {
        setMessage({ type: 'error', text: result.error || 'Failed to send test message' });
      }
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveMobileMoneySettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const configs = [
        { key: 'ussd_format', value: ussdFormat },
        { key: 'mobile_provider', value: mobileProvider },
      ];
      if (mobileMoneyPin) configs.push({ key: 'mobile_money_pin', value: mobileMoneyPin });

      await api.setBatchConfigs(configs);
      setMessage({ type: 'success', text: 'Mobile Money settings saved successfully!' });
      setMobileMoneyPin(''); // Clear PIN after saving
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const saveBusinessSettings = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.setBatchConfigs([
        { key: 'fee_percent', value: feePercent },
        { key: 'min_order', value: minOrder },
        { key: 'max_order', value: maxOrder },
        { key: 'default_currency', value: defaultCurrency },
      ]);
      setMessage({ type: 'success', text: 'Business settings saved successfully!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'telegram', label: 'Telegram', icon: '📱' },
    { id: 'mobile-money', label: 'Mobile Money', icon: '💰' },
    { id: 'wallets', label: 'Wallets', icon: '👛' },
    { id: 'binance', label: 'Binance', icon: '🔗' },
    { id: 'business', label: 'Business', icon: '⚙️' },
  ];

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
              <h1 className="text-xl font-bold text-white">Settings</h1>
            </div>
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

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Tabs */}
          <div className="lg:w-64 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full flex items-center space-x-3 px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-ngabo-accent text-white'
                      : 'text-gray-400 hover:bg-ngabo-card hover:text-white'
                  }`}
                >
                  <span>{tab.icon}</span>
                  <span>{tab.label}</span>
                </button>
              ))}
            </nav>
          </div>

          {/* Content */}
          <div className="flex-1">
            <div className="bg-ngabo-card border border-ngabo-border rounded-xl p-6">
              {/* Telegram Settings */}
              {activeTab === 'telegram' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">Telegram Notifications</h2>
                    <p className="text-gray-400 text-sm">Configure Telegram bot for payment notifications.</p>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-ngabo-dark rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${telegramStatus?.configured ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <span className="text-gray-300">
                      {telegramStatus?.configured ? 'Connected' : 'Not configured'}
                    </span>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Bot Token</label>
                      <input
                        type="password"
                        value={telegramBotToken}
                        onChange={(e) => setTelegramBotToken(e.target.value)}
                        placeholder={telegramStatus?.configured ? '••••••••••••' : 'Enter your bot token'}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                      <p className="mt-1 text-xs text-gray-500">Get from @BotFather on Telegram</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Chat ID</label>
                      <input
                        type="text"
                        value={telegramChatId}
                        onChange={(e) => setTelegramChatId(e.target.value)}
                        placeholder="Enter your chat ID"
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                      <p className="mt-1 text-xs text-gray-500">Get by sending /start to @userinfobot</p>
                    </div>
                  </div>

                  <div className="flex space-x-4">
                    <button
                      onClick={saveTelegramSettings}
                      disabled={saving}
                      className="px-6 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
                    >
                      {saving ? 'Saving...' : 'Save Settings'}
                    </button>
                    {telegramStatus?.configured && (
                      <button
                        onClick={testTelegram}
                        disabled={saving}
                        className="px-6 py-2 bg-ngabo-dark border border-ngabo-border text-gray-300 rounded-lg hover:bg-ngabo-border hover:text-white disabled:opacity-50 transition-all"
                      >
                        Send Test Message
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Mobile Money Settings */}
              {activeTab === 'mobile-money' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">Mobile Money Settings</h2>
                    <p className="text-gray-400 text-sm">Configure USSD automation for mobile money payouts.</p>
                  </div>

                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Provider</label>
                      <select
                        value={mobileProvider}
                        onChange={(e) => setMobileProvider(e.target.value)}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      >
                        <option value="airtel">Airtel Money (Uganda)</option>
                        <option value="mtn">MTN Mobile Money (Uganda)</option>
                        <option value="mpesa">M-Pesa (Kenya)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">USSD Format</label>
                      <input
                        type="text"
                        value={ussdFormat}
                        onChange={(e) => setUssdFormat(e.target.value)}
                        placeholder="*185*9*{phone}*{amount}*{pin}#"
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent font-mono"
                      />
                      <p className="mt-1 text-xs text-gray-500">
                        Variables: {'{phone}'}, {'{amount}'}, {'{pin}'}, {'{reference}'}
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Agent PIN</label>
                      <input
                        type="password"
                        value={mobileMoneyPin}
                        onChange={(e) => setMobileMoneyPin(e.target.value)}
                        placeholder="Enter your agent PIN"
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                      <p className="mt-1 text-xs text-gray-500">Encrypted and stored securely</p>
                    </div>
                  </div>

                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                    <p className="text-yellow-400 text-sm">
                      <strong>Note:</strong> The Android app is required for automated USSD execution.
                      Download it from the Devices section.
                    </p>
                  </div>

                  <button
                    onClick={saveMobileMoneySettings}
                    disabled={saving}
                    className="px-6 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}

              {/* Wallets Settings */}
              {activeTab === 'wallets' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">Crypto Wallets</h2>
                    <p className="text-gray-400 text-sm">Manage your receiving wallet addresses.</p>
                  </div>

                  <button
                    onClick={() => router.push('/dashboard/wallets')}
                    className="w-full p-4 bg-ngabo-dark border border-ngabo-border rounded-lg text-left hover:bg-ngabo-border transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-white font-medium">Wallet Management</h3>
                        <p className="text-gray-400 text-sm">Add, edit, or remove wallet addresses</p>
                      </div>
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </button>

                  <div className="p-4 bg-ngabo-dark rounded-lg">
                    <h4 className="text-sm font-medium text-gray-300 mb-2">Supported Networks</h4>
                    <div className="flex flex-wrap gap-2">
                      <span className="px-3 py-1 bg-ngabo-card rounded-full text-xs text-gray-300">TRC20 (TRON)</span>
                      <span className="px-3 py-1 bg-ngabo-card rounded-full text-xs text-gray-300">BEP20 (BSC)</span>
                      <span className="px-3 py-1 bg-ngabo-card rounded-full text-xs text-gray-300">ERC20 (Ethereum)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Binance Settings */}
              {activeTab === 'binance' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">Binance P2P Connection</h2>
                    <p className="text-gray-400 text-sm">Connect your Binance account for P2P monitoring.</p>
                  </div>

                  <div className="flex items-center space-x-3 p-4 bg-ngabo-dark rounded-lg">
                    <div className={`w-3 h-3 rounded-full ${binanceStatus?.connected ? 'bg-green-500' : 'bg-red-500'}`}></div>
                    <div>
                      <span className="text-gray-300">
                        {binanceStatus?.connected ? 'Connected' : 'Not connected'}
                      </span>
                      {binanceStatus?.expiresAt && (
                        <p className="text-xs text-gray-500">
                          Expires: {new Date(binanceStatus.expiresAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="p-4 bg-ngabo-dark rounded-lg space-y-4">
                    <h4 className="text-sm font-medium text-white">How to Connect</h4>
                    <ol className="space-y-2 text-sm text-gray-400">
                      <li>1. Open the Binance Session Extractor (browser extension)</li>
                      <li>2. Login to your Binance account in the browser</li>
                      <li>3. Click "Export Session" in the extension</li>
                      <li>4. Upload the session file below</li>
                    </ol>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">Session File</label>
                    <div className="border-2 border-dashed border-ngabo-border rounded-lg p-8 text-center hover:border-ngabo-accent transition-all cursor-pointer">
                      <input
                        type="file"
                        accept=".json"
                        className="hidden"
                        id="session-upload"
                        onChange={async (e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            try {
                              const text = await file.text();
                              const sessionData = JSON.parse(text);
                              await api.saveBinanceSession(sessionData);
                              setMessage({ type: 'success', text: 'Binance session saved!' });
                              loadSettings();
                            } catch (error: any) {
                              setMessage({ type: 'error', text: 'Invalid session file' });
                            }
                          }
                        }}
                      />
                      <label htmlFor="session-upload" className="cursor-pointer">
                        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                        </svg>
                        <p className="mt-2 text-sm text-gray-400">Click to upload session file</p>
                      </label>
                    </div>
                  </div>

                  {binanceStatus?.connected && (
                    <button
                      onClick={async () => {
                        if (confirm('Are you sure you want to disconnect Binance?')) {
                          await api.clearBinanceSession();
                          setMessage({ type: 'success', text: 'Binance disconnected' });
                          loadSettings();
                        }
                      }}
                      className="px-6 py-2 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg hover:bg-red-500/20 transition-all"
                    >
                      Disconnect Binance
                    </button>
                  )}
                </div>
              )}

              {/* Business Settings */}
              {activeTab === 'business' && (
                <div className="space-y-6">
                  <div>
                    <h2 className="text-lg font-semibold text-white mb-2">Business Settings</h2>
                    <p className="text-gray-400 text-sm">Configure fees, limits, and defaults.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Transaction Fee (%)</label>
                      <input
                        type="number"
                        step="0.1"
                        value={feePercent}
                        onChange={(e) => setFeePercent(e.target.value)}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Default Currency</label>
                      <select
                        value={defaultCurrency}
                        onChange={(e) => setDefaultCurrency(e.target.value)}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      >
                        <option value="UGX">UGX (Uganda Shilling)</option>
                        <option value="KES">KES (Kenya Shilling)</option>
                        <option value="TZS">TZS (Tanzania Shilling)</option>
                        <option value="RWF">RWF (Rwanda Franc)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Minimum Order</label>
                      <input
                        type="number"
                        value={minOrder}
                        onChange={(e) => setMinOrder(e.target.value)}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">Maximum Order</label>
                      <input
                        type="number"
                        value={maxOrder}
                        onChange={(e) => setMaxOrder(e.target.value)}
                        className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-ngabo-accent"
                      />
                    </div>
                  </div>

                  <button
                    onClick={saveBusinessSettings}
                    disabled={saving}
                    className="px-6 py-2 bg-ngabo-accent text-white rounded-lg hover:bg-emerald-600 disabled:opacity-50 transition-all"
                  >
                    {saving ? 'Saving...' : 'Save Settings'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
