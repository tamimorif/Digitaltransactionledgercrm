'use client';

interface LiveIndicatorProps {
    isConnected: boolean;
    className?: string;
}

export function LiveIndicator({ isConnected, className = '' }: LiveIndicatorProps) {
    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <div className="relative">
                <div
                    className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-gray-400'
                        }`}
                >
                    {isConnected && (
                        <div className="absolute inset-0 animate-ping rounded-full bg-green-500 opacity-75" />
                    )}
                </div>
            </div>
            <span className="text-xs text-gray-600">
                {isConnected ? 'Live' : 'Offline'}
            </span>
        </div>
    );
}
