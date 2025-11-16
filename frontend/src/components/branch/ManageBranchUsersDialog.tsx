'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/src/components/ui/dialog';
import { Button } from '@/src/components/ui/button';
import { Input } from '@/src/components/ui/input';
import { Label } from '@/src/components/ui/label';
import { Badge } from '@/src/components/ui/badge';
import { Card, CardContent } from '@/src/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Plus, Trash2, User } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

interface BranchUser {
    id: number;
    username: string;
    email: string;
    role: string;
    status: string;
    createdAt: string;
}

interface ManageBranchUsersDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    branchId: number;
    branchName: string;
}

export function ManageBranchUsersDialog({ open, onOpenChange, branchId, branchName }: ManageBranchUsersDialogProps) {
    const queryClient = useQueryClient();
    const [showAddForm, setShowAddForm] = useState(false);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
    });

    // Fetch branch users
    const { data: users = [], isLoading } = useQuery<BranchUser[]>({
        queryKey: ['branch-users', branchId],
        queryFn: async () => {
            const token = localStorage.getItem('auth_token');
            const response = await axios.get(`http://localhost:8080/api/branches/${branchId}/users`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        enabled: open,
    });

    // Create user mutation
    const createUserMutation = useMutation({
        mutationFn: async (userData: { username: string; email: string; password: string; role: string; primaryBranchId: number }) => {
            const token = localStorage.getItem('auth_token');
            const response = await axios.post('http://localhost:8080/api/users/create-branch-user', userData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branch-users', branchId] });
            toast.success('User created successfully');
            setFormData({ username: '', password: '' });
            setShowAddForm(false);
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to create user');
        }
    });

    // Delete user mutation
    const deleteUserMutation = useMutation({
        mutationFn: async (userId: number) => {
            const token = localStorage.getItem('auth_token');
            const response = await axios.delete(`http://localhost:8080/api/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['branch-users', branchId] });
            toast.success('User deleted successfully');
        },
        onError: (error: any) => {
            toast.error(error?.response?.data?.error || 'Failed to delete user');
        }
    });

    const handleAddUser = async () => {
        if (!formData.username.trim()) {
            toast.error('Username is required');
            return;
        }
        if (!formData.password || formData.password.length < 6) {
            toast.error('Password must be at least 6 characters');
            return;
        }

        await createUserMutation.mutateAsync({
            username: formData.username,
            email: `${formData.username}@digitaltransactionledger.com`,
            password: formData.password,
            role: 'tenant_user',
            primaryBranchId: branchId,
        });
    };

    const handleDeleteUser = async (userId: number) => {
        if (window.confirm('Are you sure you want to delete this user?')) {
            await deleteUserMutation.mutateAsync(userId);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle>Manage Users - {branchName}</DialogTitle>
                    <DialogDescription>
                        Add or remove users assigned to this branch
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {/* Existing Users List */}
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-medium">Branch Users ({users.length})</h3>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setShowAddForm(!showAddForm)}
                            >
                                <Plus className="h-4 w-4 mr-1" />
                                Add User
                            </Button>
                        </div>

                        {isLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : users.length === 0 ? (
                            <Card>
                                <CardContent className="flex items-center justify-center py-8 text-muted-foreground">
                                    <div className="text-center">
                                        <User className="h-8 w-8 mx-auto mb-2 opacity-50" />
                                        <p className="mb-2">No users assigned to this branch</p>
                                        <p className="text-sm">Click &quot;Add User&quot; above to create a user account with username and password</p>
                                    </div>
                                </CardContent>
                            </Card>
                        ) : (
                            <div className="space-y-2">
                                {users.map((user) => (
                                    <Card key={user.id}>
                                        <CardContent className="flex items-center justify-between p-4">
                                            <div className="flex items-center gap-3">
                                                <User className="h-5 w-5 text-muted-foreground" />
                                                <div>
                                                    <p className="font-medium">{user.username}</p>
                                                    <p className="text-sm text-muted-foreground">{user.email}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Badge variant={user.status === 'active' ? 'default' : 'secondary'}>
                                                    {user.status}
                                                </Badge>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleDeleteUser(user.id)}
                                                    disabled={deleteUserMutation.isPending}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-600" />
                                                </Button>
                                            </div>
                                        </CardContent>
                                    </Card>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Add User Form */}
                    {showAddForm && (
                        <Card className="border-2 border-primary bg-primary/5">
                            <CardContent className="pt-6 space-y-4">
                                <div>
                                    <h3 className="text-sm font-medium mb-1">Add New Branch User</h3>
                                    <p className="text-xs text-muted-foreground">Create a user account for this branch with login credentials</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="username">Username * (for login)</Label>
                                    <Input
                                        id="username"
                                        value={formData.username}
                                        onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                        placeholder="e.g., john_branch_user"
                                    />
                                    <p className="text-xs text-muted-foreground">User will login with this username</p>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="password">Password * (minimum 6 characters)</Label>
                                    <Input
                                        id="password"
                                        type="password"
                                        value={formData.password}
                                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                        placeholder="Enter secure password"
                                    />
                                    <p className="text-xs text-muted-foreground">User will use this password to login</p>
                                </div>

                                <div className="flex gap-2">
                                    <Button
                                        onClick={handleAddUser}
                                        disabled={createUserMutation.isPending}
                                        className="flex-1"
                                    >
                                        {createUserMutation.isPending && (
                                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                        )}
                                        Create User
                                    </Button>
                                    <Button
                                        variant="outline"
                                        onClick={() => {
                                            setShowAddForm(false);
                                            setFormData({ username: '', password: '' });
                                        }}
                                    >
                                        Cancel
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Close
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
