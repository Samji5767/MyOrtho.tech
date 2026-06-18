import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder";

// Environment validation
if (typeof window !== "undefined") {
  const isPlaceholder = url.includes("placeholder") || anonKey === "placeholder";
  
  if (isPlaceholder) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "PRODUCTION ERROR: Next.js NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must be set to valid values."
      );
    } else {
      console.warn(
        "WARNING: Next.js Supabase credentials are not configured or are placeholders. The client service layer will fall back to localStorage."
      );
    }
  }
}

export const supabase = createClient(url, anonKey);

// Automated credential login for developer workflow/local testing
let authPromise: Promise<void> | null = null;

export async function ensureAuth(): Promise<void> {
  const isPlaceholder = url.includes("placeholder") || anonKey === "placeholder";
  if (isPlaceholder) {
    // If placeholders are configured, let's do nothing so we can fallback to localStorage
    return;
  }

  if (authPromise) return authPromise;

  authPromise = (async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.log("Supabase: No active session. Attempting seed auto-login...");
        const email = "sarah.jenkins@myortho.tech";
        const password = "Password123!"; // Matching database seed password
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.warn("Supabase auto-login failed:", error.message);
        } else {
          console.log("Supabase: Logged in successfully as Sarah Jenkins.");
        }
      }
    } catch (err) {
      console.warn("Supabase auth check failed:", err);
    }
  })();

  return authPromise;
}
