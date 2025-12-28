import { saveRequestToQueue, getQueuedRequests, removeRequestFromQueue } from './offline-storage';
import { toast } from 'sonner';
import axios, { type InternalAxiosRequestConfig } from 'axios';
import { apiClient } from './api-client';

const normalizeHeaders = (headers: InternalAxiosRequestConfig['headers']): Record<string, string> => {
    if (!headers) return {};
    const entries = Object.entries(headers as Record<string, unknown>);
    return entries.reduce<Record<string, string>>((acc, [key, value]) => {
        acc[key] = typeof value === 'string' ? value : String(value ?? '');
        return acc;
    }, {});
};

export class QueueManager {
    private static isProcessing = false;

    static async enqueueRequest(config: InternalAxiosRequestConfig) {
        try {
            // Don't queue GET requests
            if (config.method?.toLowerCase() === 'get') {
                return;
            }

            if (!config.method || !config.url) {
                return;
            }

            const requestData = {
                method: config.method,
                url: config.url,
                data: config.data,
                headers: normalizeHeaders(config.headers),
            };

            await saveRequestToQueue(requestData);
            toast.info('You are offline. Request queued for later.');
        } catch (error) {
            console.error('Failed to queue request:', error);
            toast.error('Failed to save offline request.');
        }
    }

    static async processQueue() {
        if (this.isProcessing) return;
        this.isProcessing = true;

        try {
            const queue = await getQueuedRequests();

            if (queue.length === 0) {
                this.isProcessing = false;
                return;
            }

            toast.loading(`Syncing ${queue.length} offline operations...`, {
                id: 'sync-queue',
            });

            for (const req of queue) {
                try {
                    // Replay request using the existing apiClient to reuse base URL but need to handle auth token refresh if needed
                    // Actually, let's use apiClient directly.
                    // Note: req.url might be relative e.g. "/tickets". apiClient will prepend baseURL.
                    // If req.url is absolute, apiClient handles it too.

                    // We need to strip standard axios headers that might be stale, but headers in req might include content-type
                    const { id, ...axiosConfig } = req;

                    await apiClient.request({
                        method: axiosConfig.method,
                        url: axiosConfig.url,
                        data: axiosConfig.data,
                        // Carefully merge headers if needed, or rely on interceptors
                    });

                    if (id) {
                        await removeRequestFromQueue(id);
                    }
                } catch (error) {
                    console.error(`Failed to replay request ${req.id}:`, error);
                    // If 4xx error (bad request), maybe we should remove it?
                    // If 5xx or Network Error, keep it?
                    // For now, we keep it and retry later strictly on network error, but here we just leave it.
                    // TODO: Implement sophisticated retry logic (remove on 400, keep on 500)

                    if (axios.isAxiosError(error) && error.response && error.response.status >= 400 && error.response.status < 500) {
                        // Client error, won't succeed on retry
                        if (req.id) await removeRequestFromQueue(req.id);
                    }
                }
            }

            toast.success('Sync complete!', { id: 'sync-queue' });
        } catch (error) {
            console.error('Queue processing failed:', error);
            toast.error('Sync failed. Will retry later.', { id: 'sync-queue' });
        } finally {
            this.isProcessing = false;
        }
    }
}
