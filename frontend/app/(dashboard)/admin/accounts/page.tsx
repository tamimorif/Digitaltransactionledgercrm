'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Input } from '@/src/components/ui/input';
import { Button } from '@/src/components/ui/button';
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
    DialogHeader,
    DialogTitle,
} from '@/src/components/ui/dialog';
import { Loader2, Users, Search, Eye, Building2, Mail, Shield, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import axiosInstance from '@/src/lib/axios-config';
import { getErrorMessage } from '@/src/lib/error';

interface User {
    id: number;
    email: string;
    role: string;
    tenantId: number | null;
    status: string;
    emailVerified: boolean;
    createdAt: string;
    trialEndsAt?: string;
}

interface Tenant {
    id: number;
    name: string;
    status: string;
    userLimit: number;
    currentLicenseId?: number;
}

interface UserDetail extends User {
    tenant?: Tenant;
}

export default function AllAccountsPage() {
    const router = useRouter();
    const { user, isLoading: authLoading } = useAuth();
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedUser, setSelectedUser] = useState<UserDetail | null>(null);
    const [showDetailDialog, setShowDetailDialog] = useState(false);

    // Check authentication
    useEffect(() => {
        if (!authLoading && user?.role !== 'superadmin') {
            toast.error('Access Denied', {
                description: 'Only SuperAdmin can access this page',
            });
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    // Fetch all users
    useEffect(() => {
        if (user?.role === 'superadmin') {
            fetchUsers();
        }
    }, [user]);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const response = await axiosInstance.get('/admin/users');
            setUsers(response.data);
            setFilteredUsers(response.data);
        } catch (error) {
            toast.error('Failed to fetch users', {
                description: getErrorMessage(error, 'Please try again'),
            });
        } finally {
            setIsLoading(false);
        }
    };

    // Search functionality
    useEffect(() => {
        if (searchQuery.trim() === '') {
            setFilteredUsers(users);
        } else {
            const query = searchQuery.toLowerCase();
            const filtered = users.filter(
                (user) =>
                    user.email.toLowerCase().includes(query) ||
                    user.role.toLowerCase().includes(query) ||
                    user.status.toLowerCase().includes(query)
            );
            setFilteredUsers(filtered);
        }
    }, [searchQuery, users]);

    // View user details
    const viewUserDetails = async (userId: number) => {
        try {
            // For now, just find the user from our list
            // In production, you might want a dedicated endpoint
            const userToView = users.find((u) => u.id === userId);
            if (userToView) {
                // If user has tenant, fetch tenant details
                if (userToView.tenantId) {
                    const tenantResponse = await axiosInstance.get(`/admin/tenants/${userToView.tenantId}`);
                    setSelectedUser({ ...userToView, tenant: tenantResponse.data });
                } else {
                    setSelectedUser(userToView);
                }
                setShowDetailDialog(true);
            }
        } catch (error) {
            toast.error('Failed to fetch user details', {
                description: getErrorMessage(error, 'Please try again'),
            });
        }
    };

    const getRoleLabel = (role: string) => {
        const labels: Record<string, string> = {
            superadmin: 'Super Admin',
            tenant_owner: 'Organization Owner',
            tenant_admin: 'Administrator',
            tenant_user: 'User',
        };
        return labels[role] || role;
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'active':
                return 'bg-green-500';
            case 'trial':
                return 'bg-blue-500';
            case 'trial_expired':
            case 'license_expired':
                return 'bg-red-500';
            case 'suspended':
                return 'bg-orange-500';
            default:
                return 'bg-gray-500';
        }
    };

    const getRoleBadgeVariant = (role: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
        switch (role) {
            case 'superadmin':
                return 'destructive';
            case 'tenant_owner':
                return 'default';
            case 'tenant_admin':
                return 'secondary';
            case 'tenant_user':
                return 'outline';
            default:
                return 'outline';
        }
    };

    if (authLoading || user?.role !== 'superadmin') {
        return (
            <div className="flex min-h-screen items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold mb-2">All User Accounts</h1>
                <p className="text-muted-foreground">
                    View and manage all user accounts in the system
                </p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Total Users</p>
                                <p className="text-2xl font-bold">{users.length}</p>
                            </div>
                            <Users className="h-8 w-8 text-blue-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Active</p>
                                <p className="text-2xl font-bold">
                                    {users.filter((u) => u.status === 'active').length}
                                </p>
                            </div>
                            <UserCheck className="h-8 w-8 text-green-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Verified</p>
                                <p className="text-2xl font-bold">
                                    {users.filter((u) => u.emailVerified).length}
                                </p>
                            </div>
                            <Mail className="h-8 w-8 text-purple-600" />
                        </div>
                    </CardContent>
                </Card>
                <Card>
                    <CardContent className="pt-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-muted-foreground">Organizations</p>
                                <p className="text-2xl font-bold">
                                    {users.filter((u) => u.role === 'tenant_owner').length}
                                </p>
                            </div>
                            <Building2 className="h-8 w-8 text-orange-600" />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* Search and Table */}
            <Card>
                <CardHeader>
                    <CardTitle>User Accounts</CardTitle>
                    <CardDescription>Search and view all registered users</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                            <Input
                                placeholder="Search by email, role, or status..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-9"
                            />
                        </div>
                    </div>

                    {isLoading ? (
                        <div className="flex items-center justify-center py-8">
                            <Loader2 className="h-6 w-6 animate-spin" />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                            No users found matching your search
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Email</TableHead>
                                        <TableHead>Role</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Verified</TableHead>
                                        <TableHead>Created</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {filteredUsers.map((user) => (
                                        <TableRow key={user.id}>
                                            <TableCell className="font-medium">{user.email}</TableCell>
                                            <TableCell>
                                                <Badge variant={getRoleBadgeVariant(user.role)}>
                                                    {getRoleLabel(user.role)}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${getStatusColor(user.status)}`} />
                                                    <span className="capitalize">{user.status.replace('_', ' ')}</span>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                {user.emailVerified ? (
                                                    <Badge variant="outline" className="text-green-600 border-green-600">
                                                        Verified
                                                    </Badge>
                                                ) : (
                                                    <Badge variant="outline" className="text-orange-600 border-orange-600">
                                                        Pending
                                                    </Badge>
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {new Date(user.createdAt).toLocaleDateString()}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => viewUserDetails(user.id)}
                                                >
                                                    <Eye className="h-4 w-4 mr-2" />
                                                    View
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* User Detail Dialog */}
            <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>User Account Details</DialogTitle>
                        <DialogDescription>Complete information about this user</DialogDescription>
                    </DialogHeader>

                    {selectedUser && (
                        <div className="space-y-6">
                            {/* User Information */}
                            <div>
                                <h3 className="font-semibold mb-3 flex items-center gap-2">
                                    <Shield className="h-4 w-4" />
                                    User Information
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-sm text-muted-foreground">User ID</p>
                                        <p className="font-medium">{selectedUser.id}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Email</p>
                                        <p className="font-medium">{selectedUser.email}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Role</p>
                                        <Badge variant={getRoleBadgeVariant(selectedUser.role)}>
                                            {getRoleLabel(selectedUser.role)}
                                        </Badge>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Status</p>
                                        <div className="flex items-center gap-2">
                                            <div className={`h-2 w-2 rounded-full ${getStatusColor(selectedUser.status)}`} />
                                            <span className="capitalize">{selectedUser.status.replace('_', ' ')}</span>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Email Verified</p>
                                        <p className="font-medium">{selectedUser.emailVerified ? 'Yes' : 'No'}</p>
                                    </div>
                                    <div>
                                        <p className="text-sm text-muted-foreground">Created At</p>
                                        <p className="font-medium">
                                            {new Date(selectedUser.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    {selectedUser.trialEndsAt && (
                                        <div>
                                            <p className="text-sm text-muted-foreground">Trial Ends At</p>
                                            <p className="font-medium">
                                                {new Date(selectedUser.trialEndsAt).toLocaleString()}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Tenant Information */}
                            {selectedUser.tenant && (
                                <>
                                    <div className="border-t pt-4">
                                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                                            <Building2 className="h-4 w-4" />
                                            Organization Information
                                        </h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <p className="text-sm text-muted-foreground">Organization ID</p>
                                                <p className="font-medium">{selectedUser.tenant.id}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Organization Name</p>
                                                <p className="font-medium">{selectedUser.tenant.name}</p>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">Status</p>
                                                <div className="flex items-center gap-2">
                                                    <div className={`h-2 w-2 rounded-full ${getStatusColor(selectedUser.tenant.status)}`} />
                                                    <span className="capitalize">{selectedUser.tenant.status}</span>
                                                </div>
                                            </div>
                                            <div>
                                                <p className="text-sm text-muted-foreground">User Limit</p>
                                                <p className="font-medium">
                                                    {selectedUser.tenant.userLimit === 0 || selectedUser.tenant.userLimit >= 999999
                                                        ? 'Unlimited'
                                                        : selectedUser.tenant.userLimit}
                                                </p>
                                            </div>
                                            {selectedUser.tenant.currentLicenseId && (
                                                <div>
                                                    <p className="text-sm text-muted-foreground">License ID</p>
                                                    <p className="font-medium">{selectedUser.tenant.currentLicenseId}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
