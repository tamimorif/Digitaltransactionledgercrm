import { tokenStorage } from './api-client';

export interface WSMessage {
    type: 'transaction' | 'pickup' | 'cash_balance' | 'remittance';
    action: 'created' | 'updated' | 'deleted' | 'status_changed';
    data: Record<string, any>;
    tenantId: number;
    timestamp: string;
}

type MessageHandler = (message: WSMessage) => void;

class WebSocketService {
    private ws: WebSocket | null = null;
    private reconnectTimeout: NodeJS.Timeout | null = null;
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 2; // Reduced to avoid error spam
    private reconnectDelay = 5000; // Increased delay
    private messageQueue: WSMessage[] = [];
    private handlers: Map<string, Set<MessageHandler>> = new Map();
    private isConnecting = false;

    connect(): void {
        if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
            console.log('WebSocket already connected or connecting');
            return;
        }

        const token = tokenStorage.getAccessToken();
        if (!token) {
            console.warn('No auth token found for WebSocket connection');
            return;
        }

        this.isConnecting = true;
        const wsUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8080/api/ws';

        try {
            // Create WebSocket connection with auth token
            this.ws = new WebSocket(`${wsUrl}?token=${token}`);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected');
                this.isConnecting = false;
                this.reconnectAttempts = 0;
                this.flushMessageQueue();
            };

            this.ws.onmessage = (event) => {
                try {
                    const message: WSMessage = JSON.parse(event.data);
                    this.handleMessage(message);
                } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                }
            };

            this.ws.onerror = (error) => {
                // Silently handle WebSocket errors (backend may not be running)
                console.warn('WebSocket connection failed - backend may not be available');
                this.isConnecting = false;
            };

            this.ws.onclose = () => {
                console.log('🔌 WebSocket disconnected');
                this.isConnecting = false;
                this.ws = null;
                this.scheduleReconnect();
            };
        } catch (error) {
            console.error('Failed to create WebSocket connection:', error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    disconnect(): void {
        if (this.reconnectTimeout) {
            clearTimeout(this.reconnectTimeout);
            this.reconnectTimeout = null;
        }

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }

        this.reconnectAttempts = 0;
        this.isConnecting = false;
    }

    private scheduleReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('Max reconnect attempts reached');
            return;
        }

        if (this.reconnectTimeout) {
            return;
        }

        this.reconnectAttempts++;
        const delay = this.reconnectDelay * this.reconnectAttempts;

        console.log(`Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts})`);

        this.reconnectTimeout = setTimeout(() => {
            this.reconnectTimeout = null;
            this.connect();
        }, delay);
    }

    private handleMessage(message: WSMessage): void {
        // Notify all handlers for this message type
        const typeHandlers = this.handlers.get(message.type);
        if (typeHandlers) {
            typeHandlers.forEach((handler) => {
                try {
                    handler(message);
                } catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
        }

        // Notify all handlers subscribed to all messages
        const allHandlers = this.handlers.get('*');
        if (allHandlers) {
            allHandlers.forEach((handler) => {
                try {
                    handler(message);
                } catch (error) {
                    console.error('Error in message handler:', error);
                }
            });
        }
    }

    private flushMessageQueue(): void {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            if (message) {
                this.handleMessage(message);
            }
        }
    }

    subscribe(type: string, handler: MessageHandler): () => void {
        if (!this.handlers.has(type)) {
            this.handlers.set(type, new Set());
        }

        this.handlers.get(type)!.add(handler);

        // Return unsubscribe function
        return () => {
            const handlers = this.handlers.get(type);
            if (handlers) {
                handlers.delete(handler);
                if (handlers.size === 0) {
                    this.handlers.delete(type);
                }
            }
        };
    }

    isConnected(): boolean {
        return this.ws?.readyState === WebSocket.OPEN;
    }

    getConnectionState(): string {
        if (!this.ws) return 'DISCONNECTED';

        switch (this.ws.readyState) {
            case WebSocket.CONNECTING:
                return 'CONNECTING';
            case WebSocket.OPEN:
                return 'CONNECTED';
            case WebSocket.CLOSING:
                return 'CLOSING';
            case WebSocket.CLOSED:
                return 'DISCONNECTED';
            default:
                return 'UNKNOWN';
        }
    }
}

// Singleton instance
let wsInstance: WebSocketService | null = null;

export function getWebSocketService(): WebSocketService {
    if (typeof window === 'undefined') {
        // SSR - return a dummy service that matches the interface
        const dummyService: Partial<WebSocketService> = {
            connect: () => { },
            disconnect: () => { },
            subscribe: () => () => { },
            isConnected: () => false,
            getConnectionState: () => 'DISCONNECTED',
        };
        return dummyService as WebSocketService;
    }

    if (!wsInstance) {
        wsInstance = new WebSocketService();
    }

    return wsInstance;
}

export default WebSocketService;
