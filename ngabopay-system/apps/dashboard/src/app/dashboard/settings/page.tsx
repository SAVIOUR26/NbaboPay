'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type SettingsTab = 'telegram' | 'mobile-money' | 'business';

export default function SettingsPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<SettingsTab>('telegram');
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Telegram settings
  const [telegramBotToken, setTelegramBotToken] = useState('');
  const [telegramChatId, setTelegramChatId] = useState('');
  const [telegramStatus, setTelegramStatus] = useState<{ configured: boolean } | null>(null);

  // Mobile Money / USSD settings
  const [ussdFormat, setUssdFormat] = useState('*185*9*{phone}*{amount}*{pin}#');
  const [mobileMoneyPin, setMobileMoneyPin] = useState('');
  const [mobileProvider, setMobileProvider] = useState('airtel');

  // Business settings
  const [feePercent, setFeePercent] = useState('2.0');
  const [minOrder, setMinOrder] = useState('10000');
  const [maxOrder, setMaxOrder] = useState('5000000');
  const [defaultCurrency, setDefaultCurrency] = useState('UGX');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const [configsRes, telegramRes] = await Promise.all([
        api.getConfigs(),
        api.getTelegramStatus(),
      ]);

      const configs = configsRes.configs.reduce((acc: any, c: any) => {
        acc[c.configKey] = c.configValue;
        return acc;
      }, {});

      if (configs.telegram_chat_id) setTelegramChatId(configs.telegram_chat_id);
      if (configs.ussd_format) setUssdFormat(configs.ussd_format);
      if (configs.mobile_provider) setMobileProvider(configs.mobile_provider);
      if (configs.fee_percent) setFeePercent(configs.fee_percent);
      if (configs.min_order) setMinOrder(configs.min_order);
      if (configs.max_order) setMaxOrder(configs.max_order);
      if (configs.default_currency) setDefaultCurrency(configs.default_currency);

      setTelegramStatus(telegramRes);
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
        setMessage({ type: 'success', text: 'Telegram settings saved!' });
        setTelegramBotToken('');
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
      setMessage({ type: 'success', text: 'Mobile Money settings saved!' });
      setMobileMoneyPin('');
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
      setMessage({ type: 'success', text: 'Business settings saved!' });
    } catch (error: any) {
      setMessage({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'telegram', label: 'Telegram' },
    { id: 'mobile-money', label: 'Mobile Money' },
    { id: 'business', label: 'Business' },
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
          <div className="flex items-center space-x-4">
            <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-white">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">Settings</h1>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
          <div className="lg:w-56 flex-shrink-0">
            <nav className="space-y-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as SettingsTab)}
                  className={`w-full px-4 py-3 rounded-lg text-left transition-all ${
                    activeTab === tab.id
                      ? 'bg-ngabo-accent text-white'
                      : 'text-gray-400 hover:bg-ngabo-card hover:text-white'
                  }`}
                >
                  {tab.label}
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
                    <p className="text-gray-400 text-sm">Receive transaction notifications via Telegram bot.</p>
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
                    <h2 className="text-lg font-semibold text-white mb-2">Mobile Money / USSD</h2>
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
                      The Android app is required for automated USSD execution. Install it on your phone and connect to this server.
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
