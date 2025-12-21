'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { QueueManager } from '@/src/lib/queue-manager';
import { toast } from 'sonner';

interface NetworkContextType {
    isOnline: boolean;
}

const NetworkContext = createContext<NetworkContextType>({ isOnline: true });

export const useNetwork = () => useContext(NetworkContext);

export const NetworkProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const [isOnline, setIsOnline] = useState(true); // Default to true (hydration match)

    useEffect(() => {
        // Set initial state
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            toast.success('Back online!');
            QueueManager.processQueue();
        };

        const handleOffline = () => {
            setIsOnline(false);
            toast.warning('You are offline. Offline mode activated.');
        };

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);

    return (
        <NetworkContext.Provider value={{ isOnline }}>
            {children}
        </NetworkContext.Provider>
    );
};
