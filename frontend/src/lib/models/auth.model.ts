// ==================== Request Types ====================

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
}

export interface VerifyEmailRequest {
  email: string;
  code: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface ResendCodeRequest {
  email: string;
}

// ==================== Response Types ====================

export interface User {
  id: number;
  email: string;
  role: 'superadmin' | 'tenant_owner' | 'tenant_admin' | 'tenant_user';
  tenantId: number | null;
  status: 'active' | 'suspended' | 'trial_expired' | 'license_expired';
  trialEndsAt: string | null;
  emailVerified: boolean;
  createdAt: string;
}

export interface Tenant {
  id: number;
  name: string;
  status: 'trial' | 'active' | 'suspended' | 'expired';
  userLimit: number;
  currentLicenseId?: number;
}

export interface RegisterResponse {
  message: string;
  user: User;
}

export interface VerifyEmailResponse {
  message: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  user: User;
  tenant?: Tenant;
}

export interface GetMeResponse {
  id: number;
  email: string;
  role: string;
  tenantId: number | null;
  status: string;
  trialEndsAt: string | null;
  emailVerified: boolean;
  createdAt: string;
}
