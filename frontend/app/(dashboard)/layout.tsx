'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/src/components/providers/auth-provider';
import { Loader2, Settings, User, Mail, LogOut, ChevronDown, LayoutDashboard, Send, Search, Clock, FileText, TrendingUp, Calculator, Building2 } from 'lucide-react';
import Link from 'next/link';
import { ThemeToggle } from '@/src/components/ThemeToggle';
import { LanguageSwitcher } from '@/src/components/LanguageSwitcher';
import { KeyboardShortcuts } from '@/src/components/KeyboardShortcuts';
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
import { RateLimitNotification } from '@/src/components/RateLimitNotification';
import { useTranslation } from '@/src/contexts/TranslationContext';
import { GlobalSearch } from '@/src/components/GlobalSearch';
import { useWebSocket } from '@/src/hooks/useWebSocket';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading, user, logout } = useAuth();
  const router = useRouter();
  const { t } = useTranslation();
  const [mounted, setMounted] = useState(false);

  // Initialize WebSocket connection
  useWebSocket();

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
      <header className="bg-white border-b sticky top-0 z-50 w-full">
        <div className="max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between gap-3 lg:gap-4 h-16">

            {/* Left: Logo/Title */}
            <div className="flex-shrink-0">
              <h1 className="text-lg lg:text-xl font-bold whitespace-nowrap">
                {user?.role === 'superadmin' ? 'SuperAdmin Panel' : 'Accounting Panel'}
              </h1>
            </div>

            {/* Center: Navigation */}
            <div className="hidden md:flex items-center justify-center flex-1 min-w-0">
              <nav className="flex items-center gap-1 lg:gap-2">
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
                      <Button variant="ghost" size="sm"><LayoutDashboard className="h-4 w-4 mr-2" />{t('nav.dashboard')}</Button>
                    </Link>

                    {/* Transactions Dropdown */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <Send className="h-4 w-4 mr-2" />
                          {t('nav.transactions')}
                          <ChevronDown className="h-4 w-4 ml-1" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start">
                        <DropdownMenuItem asChild>
                          <Link href="/send-pickup" className="cursor-pointer">
                            <Send className="h-4 w-4 mr-2" />
                            Send / Receive Money
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

            {/* Right: Actions (Ultra Compact - Option 3) */}
            <div className="flex items-center gap-2 flex-shrink-0">
              {/* Search Icon Only */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}
              >
                <Search className="h-4 w-4" />
              </Button>

              {/* User Initials Avatar */}
              <Badge variant="secondary" className="h-8 w-8 rounded-full flex items-center justify-center font-semibold text-xs cursor-default">
                {user?.username ? user.username.substring(0, 2).toUpperCase() :
                  user?.email ? user.email.substring(0, 2).toUpperCase() : 'U'}
              </Badge>

              {/* Settings Dropdown - Icon Only */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <Settings className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <DropdownMenuLabel>Account Information</DropdownMenuLabel>
                  <DropdownMenuSeparator />

                  <div className="px-2 py-3 space-y-1">
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="font-medium truncate">{user?.email}</span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-sm">
                        <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-muted-foreground">{user?.username || 'Not set'}</span>
                      </div>
                      <Badge variant="outline" className="ml-auto">
                        {user?.role === 'superadmin' ? 'Super Admin' :
                          user?.role === 'tenant_owner' ? '👑 Owner' :
                            user?.role === 'tenant_admin' ? 'Admin' : 'User'}
                      </Badge>
                    </div>
                  </div>

                  <DropdownMenuSeparator />

                  {/* Theme Toggle in Dropdown */}
                  <div className="px-2 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Theme</span>
                      <ThemeToggle />
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
      <KeyboardShortcuts />
      <RateLimitNotification />
    </div >
  );
}
