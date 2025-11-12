// Auth Models

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface RegisterResponse {
  message: string;
  user: {
    id: number;
    email: string;
    emailVerified: boolean;
    role: string;
    tenantId: number | null;
    trialEndsAt: string | null;
  };
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface ResendCodeRequest {
  email: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
  tenant: Tenant | null;
}

export interface User {
  id: number;
  email: string;
  username?: string;
  role: UserRole;
  tenantId: number | null;
  primaryBranchId?: number | null;
  primaryBranch?: {
    id: number;
    name: string;
    location: string;
  };
  status: UserStatus;
  trialEndsAt: string | null;
  licenseActivatedAt?: string | null;
  emailVerified: boolean;
  createdAt?: string;
}

export interface Tenant {
  id: number;
  name: string;
  status: TenantStatus;
  userLimit: number;
  currentLicenseId?: number | null;
}

export type UserRole = 'superadmin' | 'tenant_owner' | 'tenant_admin' | 'tenant_user';

export type UserStatus = 'active' | 'suspended' | 'trial_expired' | 'license_expired';

export type TenantStatus = 'trial' | 'active' | 'suspended' | 'expired';

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}
