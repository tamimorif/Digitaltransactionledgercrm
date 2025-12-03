'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

export function KeyboardShortcuts() {
    const router = useRouter();

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Check for Cmd+N (Mac) or Ctrl+N (Windows/Linux)
            if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
                e.preventDefault();
                router.push('/send-pickup');
                toast.info('New Transaction shortcut used');
            }

            // Check for Cmd+K or Ctrl+K - Focus Quick Convert
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                const amountInput = document.getElementById('amount');
                if (amountInput) {
                    amountInput.focus();
                    toast.info('Quick Convert focused');
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [router]);

    return null;
}
