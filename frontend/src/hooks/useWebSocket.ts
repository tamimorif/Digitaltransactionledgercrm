'use client';

import { useEffect, useState } from 'react';
import { getWebSocketService, WSMessage } from '../lib/websocket.service';

// Main WebSocket hook
export function useWebSocket() {
    const [isConnected, setIsConnected] = useState(false);
    const [connectionState, setConnectionState] = useState('DISCONNECTED');

    useEffect(() => {
        const ws = getWebSocketService();
        ws.connect();

        // Poll connection state
        const interval = setInterval(() => {
            setIsConnected(ws.isConnected());
            setConnectionState(ws.getConnectionState());
        }, 1000);

        return () => {
            clearInterval(interval);
            ws.disconnect();
        };
    }, []);

    return { isConnected, connectionState };
}

// Hook for transaction updates
export function useTransactionUpdates(callback: (message: WSMessage) => void) {
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('transaction', callback);

        return () => {
            unsubscribe();
        };
    }, [callback]);
}

// Hook for pickup updates
export function usePickupUpdates(callback: (message: WSMessage) => void) {
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('pickup', callback);

        return () => {
            unsubscribe();
        };
    }, [callback]);
}

// Hook for cash balance updates
export function useCashBalanceUpdates(callback: (message: WSMessage) => void) {
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('cash_balance', callback);

        return () => {
            unsubscribe();
        };
    }, [callback]);
}

// Hook for remittance updates
export function useRemittanceUpdates(callback: (message: WSMessage) => void) {
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('remittance', callback);

        return () => {
            unsubscribe();
        };
    }, [callback]);
}

// Hook for all updates
export function useAllUpdates(callback: (message: WSMessage) => void) {
    useEffect(() => {
        const ws = getWebSocketService();
        const unsubscribe = ws.subscribe('*', callback);

        return () => {
            unsubscribe();
        };
    }, [callback]);
}
