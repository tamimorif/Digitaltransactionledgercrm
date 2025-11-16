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
import { Building2, MapPin, Plus, Edit2, Power, PowerOff, Loader2, Key } from 'lucide-react';
import type { Branch } from '@/src/lib/models/branch.model';
import { ManageBranchUsersDialog } from '@/src/components/branch/ManageBranchUsersDialog';
import { SetBranchCredentialsDialog } from '@/src/components/branch/SetBranchCredentialsDialog';

export default function BranchesPage() {
    const { user } = useAuth();
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
            // Create the branch first
            const newBranch = await createBranch.mutateAsync({
                name: formData.name,
                location: formData.location || undefined,
            });

            // If createLogin is checked, create a user for this branch
            if (formData.createLogin && newBranch) {
                try {
                    await createBranchUser.mutateAsync({
                        email: `${formData.username}@branch.local`, // Placeholder email
                        username: formData.username,
                        password: formData.password,
                        role: 'tenant_user',
                        primaryBranchId: newBranch.id,
                    });
                    toast.success('Branch and login created successfully');
                } catch (userError: any) {
                    console.error('Failed to create user:', userError);
                    toast.warning('Branch created, but failed to create login', {
                        description: userError?.response?.data?.error || 'You can create it manually from Users page',
                    });
                }
            } else {
                toast.success('Branch created successfully');
            }

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

    return (
        <div className="container mx-auto px-6 py-8 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Branch Management</h1>
                    <p className="text-muted-foreground">
                        Manage your organization&apos;s branches and locations
                    </p>
                </div>
                <Button onClick={() => setShowCreateDialog(true)} disabled={isLoading}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Branch
                </Button>
            </div>

            {/* Active Branches */}
            <Card>
                <CardHeader>
                    <CardTitle>Active Branches</CardTitle>
                    <CardDescription>
                        {activeBranches.length} active branch{activeBranches.length !== 1 ? 'es' : ''}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : activeBranches.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No active branches yet
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {activeBranches.map((branch) => (
                                <Card key={branch.id} className="relative">
                                    <CardContent className="pt-6">
                                        <div className="space-y-3">
                                            <div className="flex items-start justify-between">
                                                <div className="flex items-center gap-2">
                                                    <Building2 className="h-5 w-5 text-primary" />
                                                    <h3 className="font-semibold text-lg">{branch.name}</h3>
                                                </div>
                                            </div>

                                            {branch.location && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{branch.location}</span>
                                                </div>
                                            )}

                                            <div className="pt-2 border-t">
                                                <p className="text-xs text-muted-foreground">
                                                    Code: <span className="font-mono">{branch.branchCode}</span>
                                                </p>
                                            </div>

                                            <div className="flex gap-2 pt-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => {
                                                        setSelectedBranchId(branch.id);
                                                        setSelectedBranchName(branch.name);
                                                        setSelectedBranchUsername((branch as any).username);
                                                        setShowCredentialsDialog(true);
                                                    }}
                                                    className="flex-1"
                                                >
                                                    <Key className="h-4 w-4 mr-1" />
                                                    {(branch as any).username ? 'Edit Login' : 'Set Login'}
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleEditBranch(branch)}
                                                >
                                                    <Edit2 className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handleDeactivateBranch(branch.id)}
                                                    className="text-red-600 hover:text-red-700"
                                                >
                                                    <PowerOff className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Inactive Branches */}
            {inactiveBranches.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Inactive Branches</CardTitle>
                        <CardDescription>
                            {inactiveBranches.length} inactive branch{inactiveBranches.length !== 1 ? 'es' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {inactiveBranches.map((branch) => (
                                <Card key={branch.id} className="opacity-60">
                                    <CardContent className="pt-6">
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-2">
                                                <Building2 className="h-5 w-5 text-muted-foreground" />
                                                <h3 className="font-semibold text-lg">{branch.name}</h3>
                                                <Badge variant="secondary">Inactive</Badge>
                                            </div>
                                            {branch.location && (
                                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                                    <MapPin className="h-4 w-4" />
                                                    <span>{branch.location}</span>
                                                </div>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </CardContent>
                </Card>
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
