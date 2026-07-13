import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";


export const supabase = createClient(url, anonKey);

let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  const isPlaceholder = url.includes("placeholder") || anonKey === "placeholder";
  if (isPlaceholder) return;

  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      await supabase.auth.getSession();
    } catch {
      // Supabase not configured — silently skip
    } finally {
      authPromise = null;
    }
  })();

  return authPromise;
}
