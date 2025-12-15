/**
 * Offline Sync Utility
 * 
 * This module will handle storing requests in IndexedDB when offline
 * and syncing them with the backend when online.
 * 
 * Current status: Initial setup.
 */

export const isOnline = (): boolean => {
    if (typeof window === 'undefined') return true;
    return navigator.onLine;
};

export const registerServiceWorker = () => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js').then(
                (registration) => {
                    console.log('Service Worker registration successful with scope: ', registration.scope);
                },
                (err) => {
                    console.log('Service Worker registration failed: ', err);
                }
            );
        });
    }
};
