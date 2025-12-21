'use client';

import { useNetwork } from '@/src/context/NetworkContext';
import { WifiOff } from 'lucide-react';
import React from 'react';

export const OfflineIndicator = () => {
    const { isOnline } = useNetwork();

    if (isOnline) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5 fade-in duration-300">
            <div className="flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-white shadow-lg">
                <WifiOff className="h-5 w-5" />
                <div className="flex flex-col">
                    <span className="text-sm font-semibold">You are offline</span>
                    <span className="text-xs opacity-90">Changes will be saved locally</span>
                </div>
            </div>
        </div>
    );
};
