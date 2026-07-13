/**
 * Centralized frontend configuration.
 * All env var access should go through this module.
 */

export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL ?? '',
  buildDate: process.env.NEXT_PUBLIC_BUILD_DATE ?? 'unknown',
  appVersion: '1.0.0-beta.1',
  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
} as const;

