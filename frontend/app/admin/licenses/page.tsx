'use client';

import { useState } from 'react';
import { useGetAllLicenses, useGenerateLicense, useRevokeLicense } from '@/src/lib/queries/admin.query';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/src/components/ui/dialog';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/src/components/ui/select';
import { Badge } from '@/src/components/ui/badge';
import { Plus, Copy, Ban, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { License } from '@/src/lib/models/license.model';

export default function LicenseManager() {
    const { data: licenses, isLoading } = useGetAllLicenses();
    const generateLicense = useGenerateLicense();
    const revokeLicense = useRevokeLicense();
    const [isDialogOpen, setIsDialogOpen] = useState(false);
    const licensesList = (licenses ?? []) as License[];

    const [formData, setFormData] = useState({
        licenseType: 'starter',
        userLimit: '5',
        durationType: 'monthly',
        durationValue: '',
        notes: '',
    });

    const handleGenerate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await generateLicense.mutateAsync({
                ...formData,
                userLimit: parseInt(formData.userLimit),
                durationValue: formData.durationValue ? parseInt(formData.durationValue) : undefined,
            });
            toast.success('License generated successfully');
            setIsDialogOpen(false);
            setFormData({
                licenseType: 'starter',
                userLimit: '5',
                durationType: 'monthly',
                durationValue: '',
                notes: '',
            });
        } catch {
            toast.error('Failed to generate license');
        }
    };

    const handleRevoke = async (id: number | string) => {
        const licenseId = id.toString();
        if (confirm('Are you sure you want to revoke this license? This action cannot be undone.')) {
            try {
                await revokeLicense.mutateAsync(licenseId);
                toast.success('License revoked');
            } catch {
                toast.error('Failed to revoke license');
            }
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        toast.success('License key copied to clipboard');
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">License Management</h1>
                    <p className="text-gray-500 mt-1">Generate and manage software licenses.</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                        <Button className="bg-blue-600 hover:bg-blue-700">
                            <Plus className="mr-2 h-4 w-4" />
                            Generate New License
                        </Button>
                    </DialogTrigger>
                    <DialogContent>
                        <DialogHeader>
                            <DialogTitle>Generate New License</DialogTitle>
                            <DialogDescription>
                                Create a new license key for a tenant.
                            </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleGenerate} className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>License Type</Label>
                                    <Select
                                        value={formData.licenseType}
                                        onValueChange={(val) => setFormData({ ...formData, licenseType: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="trial">Trial</SelectItem>
                                            <SelectItem value="starter">Starter</SelectItem>
                                            <SelectItem value="professional">Professional</SelectItem>
                                            <SelectItem value="business">Business</SelectItem>
                                            <SelectItem value="enterprise">Enterprise</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>User Limit</Label>
                                    <Input
                                        type="number"
                                        value={formData.userLimit}
                                        onChange={(e) => setFormData({ ...formData, userLimit: e.target.value })}
                                        min="1"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label>Duration</Label>
                                    <Select
                                        value={formData.durationType}
                                        onValueChange={(val) => setFormData({ ...formData, durationType: val })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="yearly">Yearly</SelectItem>
                                            <SelectItem value="lifetime">Lifetime</SelectItem>
                                            <SelectItem value="custom_days">Custom Days</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                {formData.durationType === 'custom_days' && (
                                    <div className="space-y-2">
                                        <Label>Days</Label>
                                        <Input
                                            type="number"
                                            value={formData.durationValue}
                                            onChange={(e) => setFormData({ ...formData, durationValue: e.target.value })}
                                            placeholder="30"
                                            required
                                        />
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2">
                                <Label>Notes (Optional)</Label>
                                <Input
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Client name or reference..."
                                />
                            </div>

                            <DialogFooter>
                                <Button type="submit" disabled={generateLicense.isPending}>
                                    {generateLicense.isPending ? (
                                        <>
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                            Generating...
                                        </>
                                    ) : (
                                        'Generate License'
                                    )}
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>License Key</TableHead>
                            <TableHead>Type</TableHead>
                            <TableHead>Users</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Created</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                            </TableRow>
                        ) : licensesList.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-gray-500">
                                    No licenses found. Generate one to get started.
                                </TableCell>
                            </TableRow>
                        ) : (
                            licensesList.map((license) => (
                                <TableRow key={license.id}>
                                    <TableCell className="font-mono text-xs">
                                        <div className="flex items-center gap-2">
                                            <span className="bg-gray-100 px-2 py-1 rounded">
                                                {license.licenseKey.substring(0, 8)}...
                                            </span>
                                            <Button
                                                variant="ghost"
                                                size="icon"
                                                className="h-6 w-6"
                                                onClick={() => copyToClipboard(license.licenseKey)}
                                            >
                                                <Copy className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge variant="outline" className="capitalize">
                                            {license.licenseType}
                                        </Badge>
                                    </TableCell>
                                    <TableCell>{license.userLimit}</TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                license.status === 'active'
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                                    : license.status === 'unused'
                                                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-100'
                                                        : 'bg-red-100 text-red-700 hover:bg-red-100'
                                            }
                                        >
                                            {license.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {new Date(license.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        {license.status !== 'revoked' && (
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleRevoke(license.id)}
                                            >
                                                <Ban className="h-4 w-4 mr-1" />
                                                Revoke
                                            </Button>
                                        )}
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
