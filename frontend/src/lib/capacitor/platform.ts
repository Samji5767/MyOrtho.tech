type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
};

function cap(): CapacitorGlobal | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;
}

export const isNative = (): boolean => cap()?.isNativePlatform?.() ?? false;
export const isIOS = (): boolean => cap()?.getPlatform?.() === "ios";
export const isAndroid = (): boolean => cap()?.getPlatform?.() === "android";
