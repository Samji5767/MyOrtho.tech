import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

if (typeof window !== "undefined") {
  const isPlaceholder = url.includes("placeholder") || anonKey === "placeholder";
  if (isPlaceholder) {
    console.warn(
      "MyOrtho: Supabase credentials are not configured. Data operations will use localStorage fallback."
    );
  }
}

export const supabase = createClient(url, anonKey);

let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  const isPlaceholder = url.includes("placeholder") || anonKey === "placeholder";
  if (isPlaceholder) return;

  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // TODO: Implement proper auth flow — redirect to login or use OAuth
        console.warn("MyOrtho: No active Supabase session. Connect backend authentication.");
      }
    } catch (err) {
      console.warn("MyOrtho: Supabase auth check failed:", err);
    }
  })();

  return authPromise;
}
