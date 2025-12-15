/**
 * @deprecated This file is deprecated. Import from './api-client' instead.
 * 
 * This file is kept for backward compatibility during migration.
 * All exports are re-exported from the unified api-client.
 */

import apiClient, { tokenStorage } from './api-client';

// Re-export everything for backward compatibility
export { apiClient };
export { tokenStorage as storage };
export default apiClient;

// Legacy alias for files that import axiosInstance
export const axiosInstance = apiClient;
