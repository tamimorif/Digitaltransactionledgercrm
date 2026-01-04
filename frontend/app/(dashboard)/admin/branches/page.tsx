'use client';

import { useState } from 'react';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetBranches, useCreateBranch, useUpdateBranch, useDeactivateBranch } from '@/src/lib/queries/branch.query';
import { useCreateBranchUser } from '@/src/lib/queries/user.query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/src/components/ui/alert-dialog';
import { Checkbox } from '@/src/components/ui/checkbox';
import { toast } from 'sonner';
import { Building2, MapPin, Plus, Edit2, Power, PowerOff, Loader2, Crown, Users, Key } from 'lucide-react';
import type { Branch } from '@/src/lib/models/branch.model';
import { useRouter } from 'next/navigation';
import { ManageBranchUsersDialog } from '@/src/components/branch/ManageBranchUsersDialog';
import { SetBranchCredentialsDialog } from '@/src/components/branch/SetBranchCredentialsDialog';

export default function BranchesPage() {
    const { user } = useAuth();
    const router = useRouter();
    const { data: branches = [], isLoading } = useGetBranches();
    const createBranch = useCreateBranch();
    const createBranchUser = useCreateBranchUser();
    const deactivateBranch = useDeactivateBranch();

    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeactivateDialog, setShowDeactivateDialog] = useState(false);
    const [showManageUsersDialog, setShowManageUsersDialog] = useState(false);
    const [showCredentialsDialog, setShowCredentialsDialog] = useState(false);
    const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
    const [selectedBranchName, setSelectedBranchName] = useState<string>('');
    const [selectedBranchUsername, setSelectedBranchUsername] = useState<string | undefined>(undefined);

    const updateBranch = useUpdateBranch(selectedBranchId || 0);
    const [isSubmitting, setIsSubmitting] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        location: '',
        createLogin: false,
        username: '',
        password: '',
    });

    // Check if user is tenant owner
    if (user?.role !== 'tenant_owner') {
        return (
            <div className="container mx-auto px-6 py-8">
                <Card>
                    <CardContent className="flex items-center justify-center py-12">
                        <p className="text-muted-foreground">Only organization owner can manage branches.</p>
                    </CardContent>
                </Card>
            </div>
        );
    }

    const handleCreateBranch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name.trim()) {
            toast.error('Branch name is required');
            return;
        }

        if (formData.createLogin) {
            if (!formData.username.trim()) {
                toast.error('Username is required when creating a login');
                return;
            }
            if (!formData.password || formData.password.length < 8) {
                toast.error('Password must be at least 8 characters');
                return;
            }
        }

        setIsSubmitting(true);
        try {
            // Create the branch with credentials
            await createBranch.mutateAsync({
                name: formData.name,
                location: formData.location || undefined,
                username: formData.createLogin ? formData.username : undefined,
                password: formData.createLogin ? formData.password : undefined,
            });

            toast.success('Branch created successfully');

            setShowCreateDialog(false);
            setFormData({ name: '', location: '', createLogin: false, username: '', password: '' });
        } catch (error: any) {
            console.error('Failed to create branch:', error);
            toast.error('Failed to create branch', {
                description: error?.response?.data?.error || 'Please try again',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleEditBranch = (branch: Branch) => {
        setSelectedBranchId(branch.id);
        setFormData({
            name: branch.name,
            location: branch.location || '',
            createLogin: false,
            username: '',
            password: '',
        });
        setShowEditDialog(true);
    };

    const handleUpdateBranch = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!selectedBranchId) return;

        setIsSubmitting(true);
        try {
            await updateBranch.mutateAsync({
                name: formData.name,
                location: formData.location || undefined,
            });

            toast.success('Branch updated successfully');
            setShowEditDialog(false);
            setFormData({ name: '', location: '', createLogin: false, username: '', password: '' });
            setSelectedBranchId(null);
        } catch (error: any) {
            console.error('Failed to update branch:', error);
            toast.error('Failed to update branch', {
                description: error?.response?.data?.error || 'Please try again',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeactivateBranch = (branchId: number) => {
        setSelectedBranchId(branchId);
        setShowDeactivateDialog(true);
    };

    const confirmDeactivate = async () => {
        if (!selectedBranchId) return;

        setIsSubmitting(true);
        try {
            await deactivateBranch.mutateAsync(selectedBranchId);
            toast.success('Branch deactivated successfully');
            setShowDeactivateDialog(false);
            setSelectedBranchId(null);
        } catch (error: any) {
            console.error('Failed to deactivate branch:', error);
            toast.error('Failed to deactivate branch', {
                description: error?.response?.data?.error || 'Please try again',
            });
        } finally {
            setIsSubmitting(false);
        }
    };

    const activeBranches = branches.filter(b => b.status === 'active');
    const inactiveBranches = branches.filter(b => b.status === 'inactive');

    // Combine active and inactive for the verified design loop, or keep separated if preferred.
    // The design requests a single grid, but functionally existing code separated them.
    // I will merge them into one list and sort by status (active first) to match the "single grid" feel of the mock,
    // or keep the separation if clarity is needed. Given "Branch Management" usually implies seeing everything, 
    // I'll render the header/add button then the grid.

    // Sort: Active first, then by ID
    const sortedBranches = [...branches].sort((a, b) => {
        if (a.status === b.status) return a.id - b.id;
        return a.status === 'active' ? -1 : 1;
    });

    return (
        <div className="max-w-[1200px] mx-auto px-10 py-10 min-h-screen bg-slate-50/50">
            {/* Page Header */}
            <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h1 className="text-[28px] font-extrabold tracking-tight text-slate-900">Branch Management</h1>
                    <p className="text-[15px] mt-1 text-slate-500">Manage your organization&apos;s locations and access.</p>
                </div>
                <button
                    onClick={() => setShowCreateDialog(true)}
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-lg font-semibold text-sm shadow-sm hover:-translate-y-[1px] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add New Branch</span>
                </button>
            </header>

            {/* Divider */}
            <div className="h-px bg-slate-200 my-8" />

            {/* Branch Grid */}
            {isLoading ? (
                <div className="flex items-center justify-center py-20">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
            ) : sortedBranches.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-slate-200 border-dashed">
                    <Building2 className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    <h3 className="text-lg font-medium text-slate-900">No branches found</h3>
                    <p className="text-slate-500">Get started by creating your first branch.</p>
                </div>
            ) : (
                <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {sortedBranches.map((branch) => {
                        const isActive = branch.status === 'active';
                        return (
                            <article
                                key={branch.id}
                                className={`bg-white border border-slate-200 rounded-xl p-6 shadow-sm hover:shadow-[0_12px_20px_-5px_rgba(0,0,0,0.1)] hover:-translate-y-1 transition-all flex flex-col gap-5 ${!isActive ? 'opacity-80' : ''}`}
                            >
                                {/* Card Top */}
                                <div className="flex justify-between items-start">
                                    <div className="flex gap-3 items-center">
                                        <div className={`w-[42px] h-[42px] rounded-[10px] flex items-center justify-center flex-shrink-0 ${isActive ? 'bg-blue-50 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                                            <Building2 className="w-[22px] h-[22px]" />
                                        </div>
                                        <div>
                                            <h3 className="text-lg font-bold text-slate-900 leading-tight">{branch.name}</h3>
                                            <span className="text-[13px] text-slate-500 font-mono bg-slate-100 px-1.5 py-0.5 rounded mt-1 inline-block">
                                                {branch.branchCode || 'NO-CODE'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={`text-[12px] font-semibold px-2.5 py-1 rounded-full flex items-center gap-1.5 ${isActive ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-600'}`}>
                                        <div className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-green-600' : 'bg-slate-500'}`}></div>
                                        {isActive ? 'Active' : 'Inactive'}
                                    </div>
                                </div>

                                {/* Divider */}
                                <div className="h-[1px] bg-slate-100 w-full"></div>

                                {/* Actions */}
                                <div className="flex gap-2.5 mt-auto">
                                    <button
                                        className="flex-grow inline-flex items-center justify-center gap-1.5 px-3 py-2 border border-slate-200 rounded-lg bg-white text-slate-500 font-medium text-[13px] hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all"
                                        onClick={() => {
                                            setSelectedBranchId(branch.id);
                                            setSelectedBranchName(branch.name);
                                            setSelectedBranchUsername((branch as any).username);
                                            setShowCredentialsDialog(true);
                                        }}
                                    >
                                        <Key className="w-4 h-4" />
                                        <span>Manage Login</span>
                                    </button>

                                    <button
                                        className="inline-flex items-center justify-center p-2 border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900 hover:border-slate-300 transition-all flex-shrink-0"
                                        title="Edit Details"
                                        onClick={() => handleEditBranch(branch)}
                                    >
                                        <Edit2 className="w-4 h-4" />
                                    </button>

                                    {isActive && (
                                        <button
                                            className="inline-flex items-center justify-center p-2 border border-slate-200 rounded-lg bg-white text-slate-500 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all flex-shrink-0"
                                            title="Deactivate Branch"
                                            onClick={() => handleDeactivateBranch(branch.id)}
                                        >
                                            <PowerOff className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </article>
                        );
                    })}
                </section>
            )}

            {/* Create Branch Dialog */}
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Create New Branch</DialogTitle>
                        <DialogDescription>
                            Add a new branch location for your organization
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleCreateBranch}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="name">Branch Name *</Label>
                                <Input
                                    id="name"
                                    value={formData.name}
                                    onChange={(e) => {
                                        const newName = e.target.value;
                                        setFormData({
                                            ...formData,
                                            name: newName,
                                            // Auto-suggest username when createLogin is checked
                                            username: formData.createLogin && !formData.username
                                                ? newName.toLowerCase().replace(/\s+/g, '_')
                                                : formData.username
                                        });
                                    }}
                                    placeholder="e.g., Toronto Downtown"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="location">Location (Optional)</Label>
                                <Input
                                    id="location"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g., 123 Main St, Toronto, ON"
                                    disabled={isSubmitting}
                                />
                            </div>

                            {/* Create Login Option */}
                            <div className="border-t pt-4 space-y-4">
                                <div className="flex items-center space-x-2">
                                    <Checkbox
                                        id="createLogin"
                                        checked={formData.createLogin}
                                        onCheckedChange={(checked) => {
                                            const isChecked = checked === true;
                                            setFormData({
                                                ...formData,
                                                createLogin: isChecked,
                                                // Auto-suggest username from branch name when enabling
                                                username: isChecked && !formData.username
                                                    ? formData.name.toLowerCase().replace(/\s+/g, '_')
                                                    : formData.username,
                                            });
                                        }}
                                        disabled={isSubmitting}
                                    />
                                    <Label
                                        htmlFor="createLogin"
                                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                                    >
                                        Create login for this branch
                                    </Label>
                                </div>

                                {formData.createLogin && (
                                    <div className="ml-6 space-y-3 pl-4 border-l-2">
                                        <div className="space-y-2">
                                            <Label htmlFor="username">Username *</Label>
                                            <Input
                                                id="username"
                                                value={formData.username}
                                                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                                placeholder="e.g., toronto_downtown"
                                                required={formData.createLogin}
                                                disabled={isSubmitting}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                This username will be used to log into the branch account
                                            </p>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="password">Password *</Label>
                                            <Input
                                                id="password"
                                                type="password"
                                                value={formData.password}
                                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                                placeholder="Enter a secure password"
                                                required={formData.createLogin}
                                                disabled={isSubmitting}
                                                minLength={8}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                Minimum 8 characters
                                            </p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowCreateDialog(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Create Branch
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Edit Branch Dialog */}
            <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Edit Branch</DialogTitle>
                        <DialogDescription>
                            Update branch information
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleUpdateBranch}>
                        <div className="space-y-4 py-4">
                            <div className="space-y-2">
                                <Label htmlFor="edit-name">Branch Name *</Label>
                                <Input
                                    id="edit-name"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g., Toronto Downtown"
                                    required
                                    disabled={isSubmitting}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="edit-location">Location</Label>
                                <Input
                                    id="edit-location"
                                    value={formData.location}
                                    onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                    placeholder="e.g., 123 Main St, Toronto, ON"
                                    disabled={isSubmitting}
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowEditDialog(false)}
                                disabled={isSubmitting}
                            >
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isSubmitting}>
                                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            {/* Deactivate Confirmation */}
            <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Deactivate Branch?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This will deactivate the branch. The branch data will be preserved but it will no longer be available for new transactions.
                            {' '}This action can be reversed by contacting support.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isSubmitting}>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={confirmDeactivate} disabled={isSubmitting} className="bg-red-600 hover:bg-red-700">
                            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Deactivate
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* Manage Branch Users Dialog */}
            {selectedBranchId && (
                <ManageBranchUsersDialog
                    open={showManageUsersDialog}
                    onOpenChange={setShowManageUsersDialog}
                    branchId={selectedBranchId}
                    branchName={selectedBranchName}
                />
            )}

            {/* Set Branch Credentials Dialog */}
            {selectedBranchId && (
                <SetBranchCredentialsDialog
                    open={showCredentialsDialog}
                    onOpenChange={setShowCredentialsDialog}
                    branchId={selectedBranchId}
                    branchName={selectedBranchName}
                    currentUsername={selectedBranchUsername}
                />
            )}
        </div>
    );
}
