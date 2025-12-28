'use client';

import { useGetAllTenants, useSuspendTenant, useActivateTenant, useDeleteTenant } from '@/src/lib/queries/admin.query';
import { Button } from '@/src/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/src/components/ui/table';
import { Badge } from '@/src/components/ui/badge';
import { Loader2, Power, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { Tenant } from '@/src/lib/models/admin.model';

export default function TenantManager() {
    const { data: tenants, isLoading } = useGetAllTenants();
    const suspendTenant = useSuspendTenant();
    const activateTenant = useActivateTenant();
    const deleteTenant = useDeleteTenant();

    const handleStatusChange = async (tenant: Tenant) => {
        try {
            const tenantId = tenant.id.toString();
            if (tenant.status === 'active') {
                if (confirm(`Are you sure you want to suspend ${tenant.name}? Users will not be able to login.`)) {
                    await suspendTenant.mutateAsync(tenantId);
                    toast.success('Tenant suspended');
                }
            } else {
                await activateTenant.mutateAsync(tenantId);
                toast.success('Tenant activated');
            }
        } catch {
            toast.error('Failed to update tenant status');
        }
    };

    const handleDelete = async (id: number | string) => {
        if (confirm('WARNING: This will permanently delete the tenant and ALL their data (transactions, clients, users). This action CANNOT be undone. Are you sure?')) {
            try {
                await deleteTenant.mutateAsync(id.toString());
                toast.success('Tenant deleted');
            } catch {
                toast.error('Failed to delete tenant');
            }
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Tenant Management</h1>
                <p className="text-gray-500 mt-1">Manage registered organizations and their access.</p>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Organization Name</TableHead>
                            <TableHead>Owner</TableHead>
                            <TableHead>License</TableHead>
                            <TableHead>Users</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Joined</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center">
                                    <Loader2 className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                                </TableCell>
                            </TableRow>
                        ) : tenants?.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={7} className="h-24 text-center text-gray-500">
                                    No tenants found.
                                </TableCell>
                            </TableRow>
                        ) : (
                            tenants?.map((tenant: Tenant) => (
                                <TableRow key={tenant.id}>
                                    <TableCell className="font-medium">{tenant.name}</TableCell>
                                    <TableCell>
                                        <div className="text-sm">{tenant.owner?.email}</div>
                                    </TableCell>
                                    <TableCell>
                                        {tenant.currentLicense ? (
                                            <Badge variant="outline" className="capitalize">
                                                {tenant.currentLicense.licenseType}
                                            </Badge>
                                        ) : (
                                            <span className="text-xs text-gray-400">No License</span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex items-center gap-1 text-sm text-gray-600">
                                            <Users className="h-3 w-3" />
                                            {tenant.userLimit}
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <Badge
                                            className={
                                                tenant.status === 'active'
                                                    ? 'bg-green-100 text-green-700 hover:bg-green-100'
                                                    : tenant.status === 'suspended'
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-100'
                                                        : 'bg-yellow-100 text-yellow-700 hover:bg-yellow-100'
                                            }
                                        >
                                            {tenant.status}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-xs text-gray-500">
                                        {new Date(tenant.createdAt).toLocaleDateString()}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <div className="flex justify-end gap-2">
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className={
                                                    tenant.status === 'active'
                                                        ? 'text-orange-600 hover:text-orange-700 hover:bg-orange-50'
                                                        : 'text-green-600 hover:text-green-700 hover:bg-green-50'
                                                }
                                                onClick={() => handleStatusChange(tenant)}
                                            >
                                                <Power className="h-4 w-4" />
                                            </Button>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                                onClick={() => handleDelete(tenant.id)}
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </div>
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
