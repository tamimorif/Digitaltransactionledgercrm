'use client';

import { useState, useEffect } from 'react';
import { Bookmark, Trash2, Play } from 'lucide-react';
import { getSavedSearches, deleteSavedSearch, SavedSearch } from '@/src/lib/search-api';
import { Button } from './ui/button';
import { Card } from './ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';

interface SavedSearchesDialogProps {
    onApplySearch?: (search: SavedSearch) => void;
}

export function SavedSearchesDialog({ onApplySearch }: SavedSearchesDialogProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [searches, setSearches] = useState<SavedSearch[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            loadSearches();
        }
    }, [isOpen]);

    const loadSearches = async () => {
        setIsLoading(true);
        try {
            const data = await getSavedSearches();
            setSearches(data);
        } catch (error) {
            console.error('Failed to load saved searches:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Are you sure you want to delete this saved search?')) {
            return;
        }

        try {
            await deleteSavedSearch(id);
            setSearches(searches.filter((s) => s.id !== id));
        } catch (error) {
            console.error('Failed to delete saved search:', error);
            alert('Failed to delete search');
        }
    };

    const handleApply = (search: SavedSearch) => {
        onApplySearch?.(search);
        setIsOpen(false);
    };

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Bookmark className="h-4 w-4" />
                    Saved Searches
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Saved Searches</DialogTitle>
                </DialogHeader>

                {isLoading ? (
                    <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : searches.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        <Bookmark className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                        <p>No saved searches yet</p>
                    </div>
                ) : (
                    <div className="space-y-2 max-h-96 overflow-y-auto">
                        {searches.map((search) => (
                            <Card key={search.id} className="p-4">
                                <div className="flex justify-between items-start">
                                    <div className="flex-1">
                                        <h3 className="font-semibold mb-1">{search.name}</h3>
                                        {search.description && (
                                            <p className="text-sm text-gray-600 mb-2">{search.description}</p>
                                        )}
                                        <div className="flex items-center gap-2 text-xs text-gray-500">
                                            <span className="capitalize bg-gray-100 px-2 py-1 rounded">
                                                {search.entity}
                                            </span>
                                            <span>
                                                Created {new Date(search.createdAt).toLocaleDateString()}
                                            </span>
                                            {search.isPublic && (
                                                <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded">
                                                    Public
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            onClick={() => handleApply(search)}
                                            className="flex items-center gap-1"
                                        >
                                            <Play className="h-3 w-3" />
                                            Apply
                                        </Button>
                                        <Button
                                            size="sm"
                                            variant="ghost"
                                            onClick={() => handleDelete(search.id)}
                                            className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
