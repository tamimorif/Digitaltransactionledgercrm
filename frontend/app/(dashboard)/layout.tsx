'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Loader2, Settings, User, Mail, Shield, LogOut, ChevronDown, LayoutDashboard, Send, Search, Clock, FileText, TrendingUp, Calculator, Building2 } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/src/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/src/components/ui/dropdown-menu';
import { Badge } from '@/src/components/ui/badge';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <h1 className="text-xl font-bold">
                {user?.role === 'superadmin' ? 'SuperAdmin Panel' : 'Accounting Panel'}
              </h1>
              <nav className="flex gap-2">
                {user?.role === 'superadmin' ? (
                  // SuperAdmin navigation - only admin features
                  <>
                    <Link href="/admin">
                      <Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</Button>
                    </Link>
                    <Link href="/admin/generate-license">
                      <Button variant="ghost" size="sm">Generate License</Button>
                    </Link>
                    <Link href="/admin/customer-search">
                      <Button variant="ghost" size="sm">Customer Search</Button>
                    </Link>
                  </>
                ) : (
                  // Regular user navigation - grouped dropdowns
                  <>
                    <Link href="/dashboard">
                      <Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 mr-2" />Dashboard</Button>
                    </Link>

                    {/* Transactions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Send className="h-4 w-4 mr-2" />
                          Transactions
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href="/send-pickup" className="cursor-pointer">
                            <Send className="h-4 w-4 mr-2" />
                            New Transaction
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/pickup-search" className="cursor-pointer">
                            <Search className="h-4 w-4 mr-2" />
                            Search Pickups
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/pending-pickups" className="cursor-pointer">
                            <Clock className="h-4 w-4 mr-2" />
                            Pending Pickups
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Financial Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <TrendingUp className="h-4 w-4 mr-2" />
                          Financial
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href="/rates" className="cursor-pointer">
                            <TrendingUp className="h-4 w-4 mr-2" />
                            Exchange Rates
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/reconciliation" className="cursor-pointer">
                            <Calculator className="h-4 w-4 mr-2" />
                            Reconciliation
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Reports Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <FileText className="h-4 w-4 mr-2" />
                          Reports
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href="/reports" className="cursor-pointer">
                            <FileText className="h-4 w-4 mr-2" />
                            Export Reports
                          </Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <Link href="/reports-dashboard" className="cursor-pointer">
                            <LayoutDashboard className="h-4 w-4 mr-2" />
                            Reports Dashboard
                          </Link>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>

                    {/* Admin Dropdown (for owners/admins only) */}
                    {(user?.role === 'tenant_owner' || user?.role === 'tenant_admin') && (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <Building2 className="h-4 w-4 mr-2" />
                            Management
                            <ChevronDown className="h-4 w-4 ml-1" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start">
                          <DropdownMenuItem asChild>
                            <Link href="/admin/branches" className="cursor-pointer">
                              <Building2 className="h-4 w-4 mr-2" />
                              Branches
                            </Link>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )}
                  </>
                )}
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-sm font-medium">
                  {user?.username || user?.email}
                </span>
                <span className="text-xs text-muted-foreground">
                  {user?.role === 'superadmin' ? 'SuperAdmin' :
                    user?.role === 'tenant_owner' ? '👑 Owner' :
                      user?.role === 'tenant_admin' ? 'Admin' : 'User'}
                </span>
              </div>

              {/* Settings Dropdown */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Settings className="h-4 w-4 mr-2" />
                    Settings
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Account Information</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="px-2 py-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <Mail className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Email</p>
                        <p className="text-sm font-medium">{user?.email}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <User className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Username</p>
                        <p className="text-sm font-medium">{user?.username || 'Not set'}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-2">
                      <Shield className="h-4 w-4 mt-0.5 text-muted-foreground" />
                      <div className="flex-1">
                        <p className="text-xs text-muted-foreground">Role</p>
                        <Badge variant="outline" className="mt-1">
                          {user?.role === 'superadmin' ? 'Super Admin' :
                            user?.role === 'tenant_owner' ? 'Owner' :
                              user?.role === 'tenant_admin' ? 'Admin' : 'User'}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link href="/account/settings" className="w-full cursor-pointer">
                      <Settings className="h-4 w-4 mr-2" />
                      Account Settings
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={logout} className="text-red-600">
                    <LogOut className="h-4 w-4 mr-2" />
                    Logout
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}
