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

// Warn in dev if API URL is not set
if (typeof window !== 'undefined' && !config.apiUrl) {
  console.warn(
    '[MyOrtho] NEXT_PUBLIC_API_URL is not set. ' +
    'API calls will use relative URLs (works if frontend is served from the backend origin).',
  );
}
