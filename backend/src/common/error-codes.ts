/**
 * Application error codes for consistent client-facing error identification.
 * Format: DOMAIN_CATEGORY_DETAIL
 */
export const ErrorCode = {
  // Authentication
  AUTH_INVALID_CREDENTIALS: 'AUTH_001',
  AUTH_SESSION_EXPIRED: 'AUTH_002',
  AUTH_INSUFFICIENT_PERMISSIONS: 'AUTH_003',
  AUTH_ACCOUNT_INACTIVE: 'AUTH_004',

  // Cases
  CASE_NOT_FOUND: 'CASE_001',
  CASE_INVALID_TRANSITION: 'CASE_002',
  CASE_ALREADY_APPROVED: 'CASE_003',
  CASE_ORG_MISMATCH: 'CASE_004',

  // Patients
  PATIENT_NOT_FOUND: 'PATIENT_001',
  PATIENT_DUPLICATE: 'PATIENT_002',

  // Treatment Plans
  PLAN_NOT_FOUND: 'PLAN_001',
  PLAN_INVALID_STATE: 'PLAN_002',

  // Scans
  SCAN_NOT_FOUND: 'SCAN_001',
  SCAN_INVALID_FORMAT: 'SCAN_002',
  SCAN_TOO_LARGE: 'SCAN_003',
  SCAN_PROCESSING_FAILED: 'SCAN_004',

  // AI / Copilot
  COPILOT_CONVERSATION_NOT_FOUND: 'AI_001',
  COPILOT_RATE_LIMIT: 'AI_002',
  LLM_UNAVAILABLE: 'AI_003',

  // Manufacturing
  MANUFACTURING_ORDER_NOT_FOUND: 'MFG_001',
  MANUFACTURING_INVALID_STATE: 'MFG_002',

  // Admin
  USER_NOT_FOUND: 'ADMIN_001',
  USER_ALREADY_EXISTS: 'ADMIN_002',
  INVALID_ROLE: 'ADMIN_003',

  // Reports
  REPORT_NOT_FOUND: 'RPT_001',
  REPORT_GENERATION_FAILED: 'RPT_002',

  // General
  VALIDATION_FAILED: 'VAL_001',
  RESOURCE_NOT_FOUND: 'GEN_001',
  INTERNAL_ERROR: 'GEN_002',
  RATE_LIMIT_EXCEEDED: 'GEN_003',
  ORGANIZATION_MISMATCH: 'GEN_004',
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

export interface ApiError {
  statusCode: number;
  errorCode: ErrorCodeValue;
  message: string;
  details?: unknown;
  requestId?: string;
  timestamp: string;
}

export function buildApiError(
  statusCode: number,
  errorCode: ErrorCodeValue,
  message: string,
  details?: unknown,
  requestId?: string,
): ApiError {
  return {
    statusCode,
    errorCode,
    message,
    details,
    requestId,
    timestamp: new Date().toISOString(),
  };
}
