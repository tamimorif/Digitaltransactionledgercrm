'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { useGetAllTenants, useGetAdminDashboardStats } from '@/src/lib/queries/admin.query';
import { Card, CardContent, CardHeader, CardTitle } from '@/src/components/ui/card';
import { Badge } from '@/src/components/ui/badge';
import { Button } from '@/src/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/src/components/ui/table';
import { Loader2, Building2, Users, Key, TrendingUp, Plus } from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';

export default function AdminPage() {
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { data: stats, isLoading: statsLoading } = useGetAdminDashboardStats();
  const { data: tenantsData = [], isLoading: tenantsLoading } = useGetAllTenants();

  interface AdminTenant {
    id: number;
    name: string;
    status: string;
    userLimit: number;
    currentLicenseId?: number | null;
    ownerEmail?: string | null;
    createdAt?: string;
  }

  const tenants = (tenantsData ?? []) as AdminTenant[];

  useEffect(() => {
    if (!authLoading && user?.role !== 'superadmin') {
      router.push('/dashboard');
    }
  }, [user, authLoading, router]);

  if (authLoading || user?.role !== 'superadmin') {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800';
      case 'trial':
        return 'bg-blue-100 text-blue-800';
      case 'suspended':
        return 'bg-red-100 text-red-800';
      case 'expired':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="container mx-auto px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">SuperAdmin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage all tenants, generate licenses, and view system statistics
        </p>
      </div>

      {/* Stats Cards */}
      {statsLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Tenants</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.tenants?.total || 0}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Tenants</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.tenants?.active || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Trial Tenants</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.tenants?.trial || 0}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Licenses</CardTitle>
              <Key className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.licenses?.total || 0}
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Actions */}
      <div className="flex gap-4 mb-8">
        <Link href="/admin/generate-license">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Generate License
          </Button>
        </Link>
      </div>

      {/* Tenants Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Tenants</CardTitle>
        </CardHeader>
        <CardContent>
          {tenantsLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : tenants.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No tenants found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Owner Email</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>User Limit</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>License</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id} className="cursor-pointer hover:bg-muted/50" onClick={() => router.push(`/admin/tenants/${tenant.id}`)}>
                    <TableCell className="font-mono text-sm">{tenant.id}</TableCell>
                    <TableCell className="font-medium">
                      <Link href={`/admin/tenants/${tenant.id}`} className="text-primary hover:underline">
                        {tenant.name}
                      </Link>
                    </TableCell>
                    <TableCell>{tenant.ownerEmail || 'N/A'}</TableCell>
                    <TableCell>
                      <Badge className={getStatusColor(tenant.status)}>
                        {tenant.status}
                      </Badge>
                    </TableCell>
                    <TableCell>{tenant.userLimit}</TableCell>
                    <TableCell>
                      {tenant.createdAt
                        ? format(new Date(tenant.createdAt), 'MMM dd, yyyy')
                        : 'N/A'}
                    </TableCell>
                    <TableCell>
                      {tenant.currentLicenseId ? (
                        <Badge variant="outline">License #{tenant.currentLicenseId}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">No license</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
