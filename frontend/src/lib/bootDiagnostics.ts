import { APP_VERSION, APP_BUILD } from './constants';

export interface BootDiagnostic {
  version: string;
  build: string;
  supabaseConfigured: boolean;
  fastApiConfigured: boolean;
  nestJsConfigured: boolean;
  demoMode: boolean;
  platform: 'ios-native' | 'android-native' | 'web';
  timestamp: string;
}

function detectPlatform(): BootDiagnostic['platform'] {
  if (typeof window === 'undefined') return 'web';
  const ua = navigator.userAgent;
  if (/iPhone|iPad/.test(ua) && /Capacitor/.test(ua)) return 'ios-native';
  if (/Android/.test(ua) && /Capacitor/.test(ua)) return 'android-native';
  return 'web';
}

export function runBootDiagnostics(): BootDiagnostic {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

  return {
    version: APP_VERSION,
    build: APP_BUILD,
    supabaseConfigured:
      !!supabaseUrl &&
      !supabaseUrl.includes('placeholder') &&
      !!supabaseKey &&
      supabaseKey !== 'placeholder',
    fastApiConfigured: !!(process.env.NEXT_PUBLIC_FASTAPI_URL ?? ''),
    nestJsConfigured: !!(process.env.NEXT_PUBLIC_NESTJS_URL ?? ''),
    demoMode: process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === 'true',
    platform: detectPlatform(),
    timestamp: new Date().toISOString(),
  };
}
