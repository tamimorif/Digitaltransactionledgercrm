// License Models

export interface License {
  id: number;
  licenseKey: string;
  licenseType: LicenseType;
  userLimit: number;
  durationType: DurationType;
  durationValue: number | null;
  expiresAt: string | null;
  status: LicenseStatus;
  tenantId: number | null;
  activatedAt: string | null;
  createdBy: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export type LicenseType = 'trial' | 'starter' | 'professional' | 'business' | 'enterprise' | 'custom';

export type DurationType = 'lifetime' | 'monthly' | 'yearly' | 'custom_days';

export type LicenseStatus = 'unused' | 'active' | 'expired' | 'revoked';

export interface GenerateLicenseRequest {
  licenseType: LicenseType;
  userLimit?: number;
  durationType?: DurationType;
  durationValue?: number;
  notes?: string;
}

export interface ActivateLicenseRequest {
  licenseKey: string;
}

export interface LicenseStatusResponse {
  hasLicense: boolean;
  license?: License;
  userLimit?: number;
  tenantStatus?: string;
  status?: string;
  trialEndsAt?: string | null;
}
