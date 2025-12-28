'use client';

import { useState, useEffect } from 'react';
import { Search, FileText, Users, Truck, CreditCard, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { globalSearch, GlobalSearchResult } from '@/src/lib/search-api';
import { Input } from './ui/input';
import { Card } from './ui/card';
import { Badge } from './ui/badge';
import { useRouter } from 'next/navigation';

const ENTITY_ICONS: Record<string, LucideIcon> = {
    transaction: CreditCard,
    customer: Users,
    pickup: Truck,
    remittance: FileText,
};

const ENTITY_COLORS: Record<string, string> = {
    transaction: 'bg-blue-100 text-blue-800',
    customer: 'bg-green-100 text-green-800',
    pickup: 'bg-orange-100 text-orange-800',
    remittance: 'bg-purple-100 text-purple-800',
};

interface GlobalSearchProps {
    onClose?: () => void;
}

export function GlobalSearch({ onClose }: GlobalSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<GlobalSearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isOpen, setIsOpen] = useState(false);
    const router = useRouter();

    // Debounced search
    useEffect(() => {
        if (query.trim().length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setIsLoading(true);
            try {
                const searchResults = await globalSearch(query, 50);
                setResults(searchResults);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Keyboard shortcut (Cmd/Ctrl + K)
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(true);
            }
            if (e.key === 'Escape') {
                setIsOpen(false);
                onClose?.();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [onClose]);

    const handleResultClick = (result: GlobalSearchResult) => {
        // Navigate to the entity
        const routes: Record<string, string> = {
            transaction: '/transactions',
            customer: '/customers',
            pickup: '/pending-pickups',
            remittance: '/remittances',
        };

        const route = routes[result.type];
        if (route) {
            router.push(`${route}/${result.id}`);
            setIsOpen(false);
            onClose?.();
        }
    };

    const groupedResults = results.reduce((acc, result) => {
        if (!acc[result.type]) {
            acc[result.type] = [];
        }
        acc[result.type].push(result);
        return acc;
    }, {} as Record<string, GlobalSearchResult[]>);

    if (!isOpen) {
        return (
            <button
                onClick={() => setIsOpen(true)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-900 border rounded-lg hover:bg-gray-50 transition-colors"
            >
                <Search className="h-4 w-4" />
                <span>Search...</span>
                <kbd className="hidden sm:inline-flex h-5 select-none items-center gap-1 rounded border bg-gray-100 px-1.5 font-mono text-xs text-gray-600">
                    <span className="text-xs">⌘</span>K
                </kbd>
            </button>
        );
    }

    return (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center pt-20">
            <Card className="w-full max-w-2xl mx-4 max-h-[600px] overflow-hidden flex flex-col">
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <Input
                            type="text"
                            placeholder="Search transactions, customers, pickups, remittances..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            className="pl-10 pr-4 text-lg"
                            autoFocus
                        />
                        {isLoading && (
                            <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400 animate-spin" />
                        )}
                    </div>
                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                        <span>{results.length} results found</span>
                        <span>Press ESC to close</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {query.trim().length < 2 ? (
                        <div className="text-center text-gray-500 py-8">
                            <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>Type at least 2 characters to search</p>
                        </div>
                    ) : results.length === 0 && !isLoading ? (
                        <div className="text-center text-gray-500 py-8">
                            <Search className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                            <p>No results found for &quot;{query}&quot;</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {Object.entries(groupedResults).map(([type, typeResults]) => {
                                const Icon = ENTITY_ICONS[type] || FileText;
                                return (
                                    <div key={type}>
                                        <div className="flex items-center gap-2 mb-2">
                                            <Icon className="h-4 w-4 text-gray-500" />
                                            <h3 className="text-sm font-semibold text-gray-700 capitalize">
                                                {type}s ({typeResults.length})
                                            </h3>
                                        </div>
                                        <div className="space-y-1">
                                            {typeResults.map((result) => (
                                                <button
                                                    key={`${result.type}-${result.id}`}
                                                    onClick={() => handleResultClick(result)}
                                                    className="w-full text-left p-3 hover:bg-gray-50 rounded-lg transition-colors border border-transparent hover:border-gray-200"
                                                >
                                                    <div className="flex items-start justify-between">
                                                        <div className="flex-1">
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <Badge className={ENTITY_COLORS[result.type]}>
                                                                    {result.type}
                                                                </Badge>
                                                                <span className="font-medium">{result.title}</span>
                                                            </div>
                                                            {result.subtitle && (
                                                                <p className="text-sm text-gray-600">{result.subtitle}</p>
                                                            )}
                                                            {result.description && (
                                                                <p className="text-xs text-gray-500 line-clamp-2 mt-1">
                                                                    {result.description}
                                                                </p>
                                                            )}
                                                        </div>
                                                        {result.createdAt && (
                                                            <span className="text-xs text-gray-400 ml-2">
                                                                {new Date(result.createdAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </Card>
        </div>
    );
}
