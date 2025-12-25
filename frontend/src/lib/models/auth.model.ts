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

export interface Branch {
  id: number;
  name: string;
  branchCode?: string;
}

export interface User {
  id: number;
  email: string;
  username?: string | null;
  role: 'superadmin' | 'tenant_owner' | 'tenant_admin' | 'tenant_user';
  tenantId: number | null;
  primaryBranchId?: number | null;
  primaryBranch?: Branch | null;
  status: 'active' | 'suspended' | 'trial_expired' | 'license_expired';
  trialEndsAt: string | null;
  licenseActivatedAt?: string | null;
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
  refreshToken?: string;
  user: User;
  tenant?: Tenant;
}

export interface GetMeResponse extends User {
  // GetMeResponse is now an alias for User with the same structure
}

// ==================== Context Types ====================

export interface AuthContextType {
  user: User | null;
  tenant: Tenant | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => void;
}
