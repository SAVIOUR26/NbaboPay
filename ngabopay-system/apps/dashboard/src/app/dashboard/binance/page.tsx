'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api';

interface SessionStatus {
  isValid: boolean;
  lastChecked: string | null;
  expiresAt: string | null;
}

interface ExchangeRates {
  crypto: string;
  fiat: string;
  buyRate: number;
  sellRate: number;
  avgRate: number;
  spread: number;
  timestamp: string;
  orderCount: number;
}

export default function BinancePage() {
  const [sessionStatus, setSessionStatus] = useState<SessionStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [browserUrl, setBrowserUrl] = useState<string | null>(null);
  const [rates, setRates] = useState<ExchangeRates | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  // Check session status on mount
  useEffect(() => {
    checkSessionStatus();
    const interval = setInterval(checkSessionStatus, 10000); // Check every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const checkSessionStatus = async () => {
    try {
      const response = await api.getBinanceSessionStatus();
      setSessionStatus(response);
    } catch (error) {
      console.error('Failed to check session status:', error);
    }
  };

  const launchBrowser = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.launchBinanceBrowser();
      setBrowserUrl(response.browserUrl);
      setMessage({
        type: 'success',
        text: 'Browser launched! Open the VNC URL below to log in to Binance.',
      });
      checkSessionStatus();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to launch browser',
      });
    } finally {
      setLoading(false);
    }
  };

  const checkLogin = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const response = await api.checkBinanceLogin();
      if (response.isLoggedIn) {
        setMessage({
          type: 'success',
          text: 'Session saved successfully! You are now logged in.',
        });
        checkSessionStatus();
      } else {
        setMessage({
          type: 'info',
          text: 'Not logged in yet. Please log in via the VNC browser.',
        });
      }
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to check login status',
      });
    } finally {
      setLoading(false);
    }
  };

  const startMonitoring = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await api.startBinanceMonitoring();
      setMessage({
        type: 'success',
        text: 'Monitoring started successfully!',
      });
      checkSessionStatus();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to start monitoring',
      });
    } finally {
      setLoading(false);
    }
  };

  const stopMonitoring = async () => {
    setLoading(true);
    setMessage(null);
    try {
      await api.stopBinanceMonitoring();
      setBrowserUrl(null);
      setMessage({
        type: 'success',
        text: 'Monitoring stopped',
      });
      checkSessionStatus();
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to stop monitoring',
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRates = async () => {
    setLoading(true);
    try {
      const response = await api.getBinanceRates();
      // Take first rate from array if available
      if (response.rates && response.rates.length > 0) {
        setRates(response.rates[0]);
      }
      setMessage({
        type: 'success',
        text: 'Rates fetched successfully!',
      });
    } catch (error: any) {
      setMessage({
        type: 'error',
        text: error.message || 'Failed to fetch rates',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">Binance P2P Monitoring</h1>

        {/* Message Banner */}
        {message && (
          <div
            className={`mb-6 p-4 rounded-lg ${
              message.type === 'success'
                ? 'bg-green-100 text-green-800 border border-green-300'
                : message.type === 'error'
                ? 'bg-red-100 text-red-800 border border-red-300'
                : 'bg-blue-100 text-blue-800 border border-blue-300'
            }`}
          >
            {message.text}
          </div>
        )}

        {/* Session Status Card */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Session Status</h2>
          {sessionStatus ? (
            <div className="space-y-2">
              <div className="flex items-center">
                <span className="font-medium w-32">Session:</span>
                <span
                  className={`px-3 py-1 rounded-full text-sm ${
                    sessionStatus.isValid
                      ? 'bg-green-100 text-green-800'
                      : 'bg-red-100 text-red-800'
                  }`}
                >
                  {sessionStatus.isValid ? 'Valid' : 'Not Valid'}
                </span>
              </div>
              {sessionStatus.lastChecked && (
                <div className="flex items-center">
                  <span className="font-medium w-32">Last Checked:</span>
                  <span className="text-gray-700">
                    {new Date(sessionStatus.lastChecked).toLocaleString()}
                  </span>
                </div>
              )}
              {sessionStatus.expiresAt && (
                <div className="flex items-center">
                  <span className="font-medium w-32">Expires At:</span>
                  <span className="text-gray-700">
                    {new Date(sessionStatus.expiresAt).toLocaleString()}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-gray-600">Loading...</p>
          )}
        </div>

        {/* Browser Control */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">Browser Control</h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={launchBrowser}
              disabled={loading}
              className="bg-blue-600 text-white py-3 px-6 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Launching...' : 'Launch Browser'}
            </button>

            <button
              onClick={checkLogin}
              disabled={loading}
              className="bg-green-600 text-white py-3 px-6 rounded-lg hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Checking...' : 'Check & Save Login'}
            </button>

            <button
              onClick={startMonitoring}
              disabled={loading || !sessionStatus?.isValid}
              className="bg-purple-600 text-white py-3 px-6 rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Starting...' : 'Start Monitoring'}
            </button>

            <button
              onClick={stopMonitoring}
              disabled={loading}
              className="bg-red-600 text-white py-3 px-6 rounded-lg hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Stopping...' : 'Stop Monitoring'}
            </button>
          </div>

          {/* VNC Browser URL */}
          {browserUrl && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="font-semibold mb-2">VNC Browser Access:</p>
              <a
                href={browserUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline break-all"
              >
                {browserUrl}
              </a>
              <p className="text-sm text-gray-600 mt-2">
                Click the link above to open the browser and log in to Binance P2P.
                After logging in, click "Check & Save Login" to save your session.
              </p>
            </div>
          )}
        </div>

        {/* Exchange Rates */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold">Current Exchange Rates</h2>
            <button
              onClick={fetchRates}
              disabled={loading || !sessionStatus?.isValid}
              className="bg-indigo-600 text-white py-2 px-4 rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium transition"
            >
              {loading ? 'Fetching...' : 'Fetch Rates'}
            </button>
          </div>

          {rates ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-green-50 rounded-lg">
                  <p className="text-sm text-gray-600">Buy Rate</p>
                  <p className="text-2xl font-bold text-green-700">
                    {rates.buyRate.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{rates.fiat}</p>
                </div>
                <div className="p-4 bg-red-50 rounded-lg">
                  <p className="text-sm text-gray-600">Sell Rate</p>
                  <p className="text-2xl font-bold text-red-700">
                    {rates.sellRate.toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-500">{rates.fiat}</p>
                </div>
                <div className="p-4 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">Average Rate</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {rates.avgRate.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{rates.fiat}</p>
                </div>
                <div className="p-4 bg-yellow-50 rounded-lg">
                  <p className="text-sm text-gray-600">Spread</p>
                  <p className="text-2xl font-bold text-yellow-700">
                    {rates.spread.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-500">{rates.fiat}</p>
                </div>
              </div>
              <div className="text-sm text-gray-600">
                <p>Last updated: {new Date(rates.timestamp).toLocaleString()}</p>
                <p>Based on {rates.orderCount} active orders</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-600">No rates available. Fetch rates to see data.</p>
          )}
        </div>

        {/* Instructions */}
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
          <h3 className="font-semibold text-lg mb-3">📋 Quick Start Guide</h3>
          <ol className="list-decimal list-inside space-y-2 text-gray-700">
            <li>Click "Launch Browser" to start the VNC browser session</li>
            <li>Open the VNC URL in a new tab (it will open in your browser)</li>
            <li>Click "Connect" in the noVNC interface</li>
            <li>Log into your Binance account in the browser</li>
            <li>Come back here and click "Check & Save Login" to save your session</li>
            <li>Click "Start Monitoring" to begin tracking P2P rates</li>
            <li>Click "Fetch Rates" to see current USDT/UGX exchange rates</li>
          </ol>
        </div>
      </div>
    </div>
  );
}
