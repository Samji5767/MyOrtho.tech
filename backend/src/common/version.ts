export const APP_VERSION = '1.0.0-beta.1';
export const API_VERSION = 'v1';
export const BUILD_DATE = process.env.BUILD_DATE ?? 'unknown';
export const GIT_COMMIT = process.env.GIT_COMMIT ?? 'unknown';

export interface VersionInfo {
  app: string;
  api: string;
  buildDate: string;
  gitCommit: string;
  nodeVersion: string;
  environment: string;
}

export function getVersionInfo(): VersionInfo {
  return {
    app: APP_VERSION,
    api: API_VERSION,
    buildDate: BUILD_DATE,
    gitCommit: GIT_COMMIT,
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? 'development',
  };
}
