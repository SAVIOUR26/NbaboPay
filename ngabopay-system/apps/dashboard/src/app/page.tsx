'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    businessName: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const response = await api.login(formData.email, formData.password);
        if (response.token) {
          localStorage.setItem('ngabopay_token', response.token);
          localStorage.setItem('ngabopay_merchant', JSON.stringify(response.merchant));
          router.push('/dashboard');
        }
      } else {
        const response = await api.register(formData.email, formData.password, formData.businessName);
        if (response.token) {
          localStorage.setItem('ngabopay_token', response.token);
          localStorage.setItem('ngabopay_merchant', JSON.stringify(response.merchant));
          router.push('/dashboard');
        }
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = () => {
    localStorage.setItem('ngabopay_token', 'demo_token');
    localStorage.setItem('ngabopay_merchant', JSON.stringify({
      id: 'demo_merchant',
      email: 'demo@ngabopay.com',
      businessName: 'Demo Store',
    }));
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-ngabo-darker p-4">
      <div className="w-full max-w-md">
        {/* Logo and Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-ngabo-accent to-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-500/25">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">NgaboPay</h1>
          <p className="text-gray-400">Merchant Dashboard</p>
        </div>

        {/* Login/Register Form */}
        <div className="bg-ngabo-card border border-ngabo-border rounded-2xl p-8 shadow-xl">
          {/* Tab Switcher */}
          <div className="flex bg-ngabo-dark rounded-lg p-1 mb-6">
            <button
              onClick={() => setIsLogin(true)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                isLogin
                  ? 'bg-ngabo-accent text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => setIsLogin(false)}
              className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-all ${
                !isLogin
                  ? 'bg-ngabo-accent text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              Register
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Business Name
                </label>
                <input
                  type="text"
                  value={formData.businessName}
                  onChange={(e) => setFormData({ ...formData, businessName: e.target.value })}
                  className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent focus:border-transparent transition-all"
                  placeholder="Your Business Name"
                  required={!isLogin}
                />
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent focus:border-transparent transition-all"
                placeholder="you@business.com"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="w-full px-4 py-3 bg-ngabo-dark border border-ngabo-border rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-ngabo-accent focus:border-transparent transition-all"
                placeholder="Enter your password"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-ngabo-accent to-emerald-600 text-white font-semibold rounded-lg hover:from-emerald-600 hover:to-ngabo-accent transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-emerald-500/25"
            >
              {loading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Processing...
                </span>
              ) : (
                isLogin ? 'Sign In' : 'Create Account'
              )}
            </button>
          </form>

          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ngabo-border"></div>
              </div>
              <div className="relative flex justify-center text-sm">
                <span className="px-2 bg-ngabo-card text-gray-400">or</span>
              </div>
            </div>

            <button
              onClick={handleDemoLogin}
              className="mt-4 w-full py-3 px-4 bg-ngabo-dark border border-ngabo-border text-gray-300 font-medium rounded-lg hover:bg-ngabo-border hover:text-white transition-all"
            >
              Continue with Demo Account
            </button>
          </div>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-gray-500 text-sm">
          By continuing, you agree to NgaboPay&apos;s{' '}
          <a href="#" className="text-ngabo-accent hover:underline">Terms of Service</a>
          {' '}and{' '}
          <a href="#" className="text-ngabo-accent hover:underline">Privacy Policy</a>
        </p>
      </div>
    </div>
  );
}
