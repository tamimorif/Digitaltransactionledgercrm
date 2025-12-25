'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import type { AuthContextType, User, Tenant } from '@/src/models/auth.model';
import { useLogin, useLogout, useGetMe } from '@/src/queries/auth.query';
import { tokenStorage } from '@/src/lib/api-client';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const loginMutation = useLogin();
  const logoutMutation = useLogout();
  const { data: meData, isLoading: isMeLoading, refetch } = useGetMe(!!token);

  // Initialize from localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const storedToken = localStorage.getItem('auth_token');
      const storedUser = localStorage.getItem('user');
      const storedTenant = localStorage.getItem('tenant');

      if (storedToken) {
        setToken(storedToken);
      }

      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch (e) {
          console.error('Failed to parse stored user');
        }
      }

      if (storedTenant) {
        try {
          setTenant(JSON.parse(storedTenant));
        } catch (e) {
          console.error('Failed to parse stored tenant');
        }
      }
    }

    setIsLoading(false);
  }, []);

  // Update user from /me endpoint
  useEffect(() => {
    if (meData) {
      setUser(meData);
      if (typeof window !== 'undefined') {
        localStorage.setItem('user', JSON.stringify(meData));
      }
    }
  }, [meData]);

  const login = async (email: string, password: string) => {
    const response = await loginMutation.mutateAsync({ email, password });

    // Ensure storage is updated before state change to prevent race condition
    tokenStorage.setAccessToken(response.token);
    // Store refresh token for token refresh functionality
    if (response.refreshToken) {
      tokenStorage.setRefreshToken(response.refreshToken);
    }
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(response.user));
    }

    setToken(response.token);
    setUser(response.user);
    setTenant(response.tenant ?? null);
  };

  const refreshUser = async () => {
    await refetch();
  };

  const logout = () => {
    logoutMutation.mutate();
    setUser(null);
    setTenant(null);
    setToken(null);
  };

  const value: AuthContextType = {
    user,
    tenant,
    isAuthenticated: !!token && !!user,
    isLoading: isLoading || loginMutation.isPending || (!!token && isMeLoading),
    login,
    logout,
    refreshUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
