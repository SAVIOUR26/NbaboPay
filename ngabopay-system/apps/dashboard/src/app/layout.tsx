import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NgaboPay - Merchant Dashboard',
  description: 'Manage your crypto payments with NgaboPay merchant dashboard',
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="font-sans antialiased bg-ngabo-darker text-white min-h-screen">
        {children}
      </body>
    </html>
  );
}
