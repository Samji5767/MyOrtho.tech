import { isNative } from "./platform";

export interface ShareOptions {
  title?: string;
  text?: string;
  url?: string;
  /** Absolute path on the device (only meaningful when native) */
  filePath?: string;
  dialogTitle?: string;
}

/**
 * Opens the native share sheet on iOS/Android.
 * Falls back to the Web Share API, then clipboard copy, then a noop.
 */
export async function nativeShare(opts: ShareOptions): Promise<void> {
  if (typeof window === "undefined") return;

  if (isNative()) {
    try {
      const { Share } = (await import(/* webpackIgnore: true */ "@capacitor/share" as any)) as {
        Share: {
          share: (opts: ShareOptions) => Promise<void>;
          canShare: () => Promise<{ value: boolean }>;
        };
      };
      const { value: canShare } = await Share.canShare();
      if (canShare) {
        await Share.share({
          title: opts.title,
          text: opts.text,
          url: opts.url,
          dialogTitle: opts.dialogTitle ?? "Share via",
        });
        return;
      }
    } catch {
      // @capacitor/share not installed — fall through
    }
  }

  // Web Share API
  if (typeof navigator !== "undefined" && navigator.share) {
    try {
      await navigator.share({ title: opts.title, text: opts.text, url: opts.url });
      return;
    } catch {
      // User cancelled or not supported
    }
  }

  // Last resort: copy URL to clipboard
  if (opts.url && typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(opts.url);
  }
}
