'use client';

import { useState } from 'react';
import { Search, Filter, Save, X } from 'lucide-react';
import { advancedSearch, SearchFilter, saveSearch } from '@/src/lib/search-api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Card } from './ui/card';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from './ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from './ui/select';

interface AdvancedSearchDialogProps {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
}

export function AdvancedSearchDialog({ open, onOpenChange }: AdvancedSearchDialogProps) {
    const [isOpen, setIsOpen] = useState(open || false);
    const [entity, setEntity] = useState<string>('transaction');
    const [query, setQuery] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [amountMin, setAmountMin] = useState('');
    const [amountMax, setAmountMax] = useState('');
    const [status] = useState<string[]>([]);
    const [currency] = useState<string[]>([]);
    const [results, setResults] = useState<unknown[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [searchName, setSearchName] = useState('');
    const [searchDescription, setSearchDescription] = useState('');

    const handleSearch = async (page: number = 1) => {
        setIsLoading(true);
        try {
            const filter: SearchFilter = {
                entity,
                query: query || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                amountMin: amountMin ? parseFloat(amountMin) : undefined,
                amountMax: amountMax ? parseFloat(amountMax) : undefined,
                status: status.length > 0 ? status : undefined,
                currency: currency.length > 0 ? currency : undefined,
            };

            const response = await advancedSearch(filter, page, 20);
            setResults(response.results);
            setCurrentPage(response.page);
            setTotalPages(response.pages);
        } catch (error) {
            console.error('Advanced search failed:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSaveSearch = async () => {
        if (!searchName) return;

        try {
            const filter: SearchFilter = {
                entity,
                query: query || undefined,
                dateFrom: dateFrom || undefined,
                dateTo: dateTo || undefined,
                amountMin: amountMin ? parseFloat(amountMin) : undefined,
                amountMax: amountMax ? parseFloat(amountMax) : undefined,
                status: status.length > 0 ? status : undefined,
                currency: currency.length > 0 ? currency : undefined,
            };

            await saveSearch(searchName, searchDescription, filter);
            setShowSaveDialog(false);
            setSearchName('');
            setSearchDescription('');
            alert('Search saved successfully!');
        } catch (error) {
            console.error('Save search failed:', error);
            alert('Failed to save search');
        }
    };

    const handleOpenChange = (open: boolean) => {
        setIsOpen(open);
        onOpenChange?.(open);
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <Button variant="outline" className="flex items-center gap-2">
                    <Filter className="h-4 w-4" />
                    Advanced Search
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle>Advanced Search</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                    {/* Entity Selection */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Search In</label>
                        <Select value={entity} onValueChange={setEntity}>
                            <SelectTrigger>
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="transaction">Transactions</SelectItem>
                                <SelectItem value="customer">Customers</SelectItem>
                                <SelectItem value="pickup">Pickups</SelectItem>
                                <SelectItem value="remittance">Remittances</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Search Query */}
                    <div>
                        <label className="text-sm font-medium mb-2 block">Search Query</label>
                        <Input
                            placeholder="Enter search terms..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                        />
                    </div>

                    {/* Date Range */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="text-sm font-medium mb-2 block">From Date</label>
                            <Input
                                type="date"
                                value={dateFrom}
                                onChange={(e) => setDateFrom(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="text-sm font-medium mb-2 block">To Date</label>
                            <Input
                                type="date"
                                value={dateTo}
                                onChange={(e) => setDateTo(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Amount Range */}
                    {entity === 'transaction' && (
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-sm font-medium mb-2 block">Min Amount</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amountMin}
                                    onChange={(e) => setAmountMin(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium mb-2 block">Max Amount</label>
                                <Input
                                    type="number"
                                    placeholder="0.00"
                                    value={amountMax}
                                    onChange={(e) => setAmountMax(e.target.value)}
                                />
                            </div>
                        </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2">
                        <Button onClick={() => handleSearch(1)} disabled={isLoading} className="flex-1">
                            <Search className="h-4 w-4 mr-2" />
                            {isLoading ? 'Searching...' : 'Search'}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowSaveDialog(true)}
                            disabled={!query && !dateFrom && !dateTo}
                        >
                            <Save className="h-4 w-4 mr-2" />
                            Save Search
                        </Button>
                    </div>

                    {/* Results */}
                    {results.length > 0 && (
                        <div className="border rounded-lg p-4">
                            <h3 className="font-semibold mb-4">
                                Results ({results.length} on this page)
                            </h3>
                            <div className="space-y-2 max-h-96 overflow-y-auto">
                                {results.map((result, index) => (
                                    <Card key={index} className="p-3">
                                        <pre className="text-xs overflow-x-auto">
                                            {JSON.stringify(result, null, 2)}
                                        </pre>
                                    </Card>
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex justify-center gap-2 mt-4">
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSearch(currentPage - 1)}
                                        disabled={currentPage === 1 || isLoading}
                                    >
                                        Previous
                                    </Button>
                                    <span className="py-2 px-4 text-sm">
                                        Page {currentPage} of {totalPages}
                                    </span>
                                    <Button
                                        variant="outline"
                                        onClick={() => handleSearch(currentPage + 1)}
                                        disabled={currentPage === totalPages || isLoading}
                                    >
                                        Next
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Save Search Dialog */}
                {showSaveDialog && (
                    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center">
                        <Card className="p-6 max-w-md w-full mx-4">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="font-semibold">Save Search</h3>
                                <button onClick={() => setShowSaveDialog(false)}>
                                    <X className="h-4 w-4" />
                                </button>
                            </div>
                            <div className="space-y-4">
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Name</label>
                                    <Input
                                        placeholder="My saved search"
                                        value={searchName}
                                        onChange={(e) => setSearchName(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label className="text-sm font-medium mb-2 block">Description (Optional)</label>
                                    <Input
                                        placeholder="Description..."
                                        value={searchDescription}
                                        onChange={(e) => setSearchDescription(e.target.value)}
                                    />
                                </div>
                                <div className="flex gap-2">
                                    <Button onClick={handleSaveSearch} className="flex-1">
                                        Save
                                    </Button>
                                    <Button variant="outline" onClick={() => setShowSaveDialog(false)}>
                                        Cancel
                                    </Button>
                                </div>
                            </div>
                        </Card>
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
