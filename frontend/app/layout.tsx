import type { Metadata } from 'next';
import './globals.css';
import { Toaster } from '../src/components/ui/sonner';
import { ReactQueryProvider } from '@/src/components/providers/react-query-provider';
import { AuthProvider } from '@/src/components/providers/auth-provider';
import { ThemeProvider } from '@/src/components/providers/theme-provider';
import { TranslationProvider } from '@/src/contexts/TranslationContext';

export const metadata: Metadata = {
  title: 'Digital Transaction Ledger CRM',
  description: 'Currency Exchange & Remittance Management System',
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
            </ThemeProvider>
          </AuthProvider>
        </ReactQueryProvider>
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
