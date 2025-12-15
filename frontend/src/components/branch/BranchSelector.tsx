'use client';

import { useState, useEffect } from 'react';
import { useGetUserBranches } from '@/src/lib/queries/branch.query';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { Building2 } from 'lucide-react';

export function BranchSelector() {
    const { data: branches = [], isLoading } = useGetUserBranches();
    const [selectedBranchId, setSelectedBranchId] = useState<string>('all');

    useEffect(() => {
        // Load saved branch from localStorage
        const saved = localStorage.getItem('selectedBranchId');
        if (saved) {
            setSelectedBranchId(saved);
        }
    }, []);

    const handleBranchChange = (value: string) => {
        setSelectedBranchId(value);
        localStorage.setItem('selectedBranchId', value);
        // Reload page to apply filter
        window.location.reload();
    };

    if (isLoading || branches.length === 0) {
        return null;
    }

    // Only show selector if user has multiple branches
    if (branches.length === 1) {
        return null;
    }

    return (
        <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedBranchId} onValueChange={handleBranchChange}>
                <SelectTrigger className="w-[200px]">
                    <SelectValue placeholder="Select branch" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Branches</SelectItem>
                    {branches.map((branch) => (
                        <SelectItem key={branch.id} value={branch.id.toString()}>
                            {branch.name}
                        </SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </div>
    );
}
