'use client';

import { useState } from 'react';
import { Plus, Pencil, Trash2, Users, Shield, User as UserIcon } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Button } from '@/src/components/ui/button';
import { Badge } from '@/src/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/src/components/ui/table';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/src/components/ui/alert-dialog';
import { useGetUsers, useDeleteUser } from '@/src/lib/queries/user.query';
import { User } from '@/src/lib/user-api';
import { toast } from 'sonner';
import { CreateUserDialog } from '@/src/components/users/CreateUserDialog';
import { EditUserDialog } from '@/src/components/users/EditUserDialog';
import { getErrorMessage } from '@/src/lib/error';

type BadgeVariant = 'default' | 'secondary' | 'outline' | 'destructive';

export default function UsersPage() {
    const [createDialogOpen, setCreateDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [deletingUser, setDeletingUser] = useState<User | null>(null);

    const { data: users, isLoading } = useGetUsers();
    const deleteUserMutation = useDeleteUser();

    const handleDelete = async () => {
        if (!deletingUser) return;

        try {
            await deleteUserMutation.mutateAsync(deletingUser.id);
            toast.success('User deleted successfully');
            setDeletingUser(null);
        } catch (error) {
            toast.error(getErrorMessage(error, 'Failed to delete user'));
        }
    };

    const getRoleBadge = (role: string) => {
        const roleConfig: Record<string, { variant: BadgeVariant; label: string }> = {
            tenant_owner: { variant: 'default', label: 'Owner' },
            tenant_admin: { variant: 'secondary', label: 'Admin' },
            tenant_user: { variant: 'outline', label: 'User' },
        };
        const config = roleConfig[role] || { variant: 'outline', label: role };
        return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    const getStatusBadge = (status: string) => {
        return status === 'active' ? (
            <Badge variant="default" className="bg-green-500">Active</Badge>
        ) : (
            <Badge variant="destructive">Inactive</Badge>
        );
    };

    return (
        <div className="container max-w-7xl mx-auto py-8 space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold flex items-center gap-2">
                        <Users className="h-8 w-8" />
                        User Management
                    </h1>
                    <p className="text-muted-foreground">Manage branch users and their permissions</p>
                </div>
                <Button onClick={() => setCreateDialogOpen(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add User
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Users</CardTitle>
                    <CardDescription>
                        {users?.length || 0} user{users?.length !== 1 ? 's' : ''} in your organization
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {isLoading ? (
                        <div className="text-center py-8 text-muted-foreground">
                            Loading users...
                        </div>
                    ) : users && users.length > 0 ? (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Username</TableHead>
                                    <TableHead>Email</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Branch</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {users.map((user) => (
                                    <TableRow key={user.id}>
                                        <TableCell className="font-medium">
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="h-4 w-4 text-muted-foreground" />
                                                {user.username || 'N/A'}
                                            </div>
                                        </TableCell>
                                        <TableCell>{user.email}</TableCell>
                                        <TableCell>{getRoleBadge(user.role)}</TableCell>
                                        <TableCell>
                                            {user.primaryBranch ? (
                                                <span className="text-sm">{user.primaryBranch.name}</span>
                                            ) : (
                                                <span className="text-sm text-muted-foreground">All Branches</span>
                                            )}
                                        </TableCell>
                                        <TableCell>{getStatusBadge(user.status)}</TableCell>
                                        <TableCell className="text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setEditingUser(user)}
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </Button>
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => setDeletingUser(user)}
                                                >
                                                    <Trash2 className="h-4 w-4 text-red-500" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    ) : (
                        <div className="text-center py-12 text-muted-foreground">
                            <Shield className="h-12 w-12 mx-auto mb-4 opacity-50" />
                            <p className="text-lg font-medium">No users found</p>
                            <p className="text-sm">Create your first branch user to get started</p>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Create User Dialog */}
            <CreateUserDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
            />

            {/* Edit User Dialog */}
            {editingUser && (
                <EditUserDialog
                    user={editingUser}
                    open={!!editingUser}
                    onOpenChange={(open: boolean) => !open && setEditingUser(null)}
                />
            )}

            {/* Delete Confirmation Dialog */}
            <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Delete User</AlertDialogTitle>
                        <AlertDialogDescription>
                            Are you sure you want to delete <strong>{deletingUser?.username || deletingUser?.email}</strong>?
                            This action cannot be undone.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-500 hover:bg-red-600"
                        >
                            Delete
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
