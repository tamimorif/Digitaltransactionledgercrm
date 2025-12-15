// ==================== Request Types ====================

export interface GenerateLicenseRequest {
  licenseType: 'trial' | 'starter' | 'professional' | 'business' | 'enterprise' | 'custom';
  userLimit?: number;
  durationType: 'lifetime' | 'monthly' | 'yearly' | 'custom_days';
  durationValue?: number;
  notes?: string;
}

export interface ActivateLicenseRequest {
  licenseKey?: string;
  license_key?: string;
}

// ==================== Response Types ====================

export interface License {
  id: number;
  licenseKey: string;
  licenseType: string;
  userLimit: number;
  durationType: string;
  durationValue?: number;
  expiresAt?: string;
  status: 'unused' | 'active' | 'expired' | 'revoked';
  tenantId?: number;
  activatedAt?: string;
  createdBy: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface LicenseStatusResponse {
  hasLicense: boolean;
  hasActiveLicense?: boolean;
  license?: License;
  currentLicense?: License;
  userLimit?: number;
  tenantStatus?: string;
  status?: string;
  trialEndsAt?: string;
}

export interface ActivateLicenseResponse {
  message: string;
}
