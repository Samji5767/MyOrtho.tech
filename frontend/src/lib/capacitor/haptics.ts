import { isNative } from "./platform";

export type HapticStyle = "light" | "medium" | "heavy" | "success" | "warning" | "error";

/**
 * Cross-platform haptic feedback.
 * On native iOS/Android: delegates to @capacitor/haptics if installed.
 * On web: falls back to the Web Vibration API where supported.
 */
export async function haptic(style: HapticStyle = "medium"): Promise<void> {
  if (typeof window === "undefined") return;

  if (isNative()) {
    try {
      // Dynamic import so the app doesn't hard-crash when @capacitor/haptics
      // is not yet installed in the native project.
      const { Haptics, ImpactStyle, NotificationType } =
        // webpackIgnore keeps Next.js from bundling this Capacitor plugin.
        // It only runs inside the native Capacitor shell where the plugin IS available.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (await import(/* webpackIgnore: true */ "@capacitor/haptics" as any)) as {
          Haptics: {
            impact: (opts: { style: string }) => Promise<void>;
            notification: (opts: { type: string }) => Promise<void>;
            vibrate: () => Promise<void>;
          };
          ImpactStyle: { Light: string; Medium: string; Heavy: string };
          NotificationType: { Success: string; Warning: string; Error: string };
        };

      if (style === "success" || style === "warning" || style === "error") {
        const typeMap = {
          success: NotificationType.Success,
          warning: NotificationType.Warning,
          error: NotificationType.Error,
        };
        await Haptics.notification({ type: typeMap[style] });
      } else {
        const impactMap = {
          light: ImpactStyle.Light,
          medium: ImpactStyle.Medium,
          heavy: ImpactStyle.Heavy,
        };
        await Haptics.impact({ style: impactMap[style] });
      }
    } catch {
      // Plugin not installed — fail silently
    }
    return;
  }

  // Web Vibration API fallback
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    const patterns: Record<HapticStyle, number | number[]> = {
      light: 8,
      medium: 18,
      heavy: 45,
      success: [8, 40, 8],
      warning: [25, 25],
      error: [40, 40, 40],
    };
    navigator.vibrate(patterns[style]);
  }
}

/** Convenience wrappers */
export const hapticLight   = () => haptic("light");
export const hapticSuccess = () => haptic("success");
export const hapticWarning = () => haptic("warning");
export const hapticError   = () => haptic("error");
