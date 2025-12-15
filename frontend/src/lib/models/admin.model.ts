import { User } from './auth.model';
import { License } from './license.model';

// ==================== Response Types ====================

export interface Tenant {
  id: number;
  name: string;
  ownerId: number;
  ownerEmail?: string;
  currentLicenseId?: number;
  userLimit: number;
  status: 'trial' | 'active' | 'suspended' | 'expired';
  createdAt: string;
  updatedAt: string;
  owner?: User;
  currentLicense?: License;
  users?: User[];
}

export interface DashboardStats {
  tenants: {
    total: number;
    active: number;
    trial: number;
  };
  users: {
    total: number;
    active: number;
  };
  licenses: {
    total: number;
    active: number;
    unused: number;
  };
}
