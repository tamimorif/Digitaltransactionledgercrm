'use client';

import { useEffect, useState } from 'react';
import { X, Clock, AlertCircle } from 'lucide-react';
import { Card } from './ui/card';
import { Button } from './ui/button';

interface RateLimitInfo {
    retryAfter: number;
    message: string;
}

export function RateLimitNotification() {
    const [rateLimitInfo, setRateLimitInfo] = useState<RateLimitInfo | null>(null);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        const handleRateLimit = (event: CustomEvent<RateLimitInfo>) => {
            setRateLimitInfo(event.detail);
            setCountdown(Math.ceil(event.detail.retryAfter / 1000));
        };

        window.addEventListener('rate-limit-exceeded', handleRateLimit as EventListener);

        return () => {
            window.removeEventListener('rate-limit-exceeded', handleRateLimit as EventListener);
        };
    }, []);

    useEffect(() => {
        if (countdown <= 0) {
            setRateLimitInfo(null);
            return;
        }

        const timer = setInterval(() => {
            setCountdown((prev) => {
                if (prev <= 1) {
                    setRateLimitInfo(null);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [countdown]);

    if (!rateLimitInfo) return null;

    return (
        <div className="fixed bottom-4 right-4 z-50 animate-in slide-in-from-bottom-5">
            <Card className="p-4 max-w-md shadow-lg border-orange-200 bg-orange-50">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <h3 className="font-semibold text-orange-900 mb-1">Rate Limit Exceeded</h3>
                        <p className="text-sm text-orange-800 mb-2">{rateLimitInfo.message}</p>
                        <div className="flex items-center gap-2 text-sm text-orange-700">
                            <Clock className="h-4 w-4" />
                            <span>Retrying in {countdown} seconds...</span>
                        </div>
                    </div>
                    <button
                        onClick={() => setRateLimitInfo(null)}
                        className="text-orange-600 hover:text-orange-800"
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
            </Card>
        </div>
    );
}
