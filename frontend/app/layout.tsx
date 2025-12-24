import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '../src/components/ui/sonner';
import { ReactQueryProvider } from '@/src/components/providers/react-query-provider';
import { AuthProvider } from '@/src/components/providers/auth-provider';
import { ThemeProvider } from '@/src/components/providers/theme-provider';
import { TranslationProvider } from '@/src/contexts/TranslationContext';
import { NetworkProvider } from '@/src/context/NetworkContext';
import { OfflineIndicator } from '@/src/components/ui/OfflineIndicator';

export const metadata: Metadata = {
  title: 'Velopay - Digital Transaction Ledger',
  description: 'Currency Exchange & Remittance Management System',
  icons: {
    icon: '/favicon.png',
    apple: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="font-sans antialiased">
        <ReactQueryProvider>
          <NetworkProvider>
            <AuthProvider>
              <ThemeProvider
                attribute="class"
                defaultTheme="system"
                enableSystem
                disableTransitionOnChange
              >
                <TranslationProvider>
                  {children}
                </TranslationProvider>
                <OfflineIndicator />
              </ThemeProvider>
            </AuthProvider>
          </NetworkProvider>
        </ReactQueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
