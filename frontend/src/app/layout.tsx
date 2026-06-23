import type { Metadata, Viewport } from "next";
import { Manrope } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/ThemeContext";
import { AppShell } from "@/components/mobile/AppShell";
import { AuthProvider } from "@/context/AuthContext";

const manrope = Manrope({ subsets: ["latin"], variable: "--font-sans" });

/**
 * Runs synchronously before any stylesheet loads.
 * 1. Reads stored/system theme and applies .dark class immediately — prevents FOUC.
 * 2. Fades out the launch shell once the DOM is fully parsed.
 */
const bootstrapScript = `
(function () {
  try {
    var stored = window.localStorage.getItem('theme');
    var system = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    var theme  = stored === 'light' || stored === 'dark' ? stored : system;
    document.documentElement.classList.toggle('dark', theme === 'dark');
    document.documentElement.style.colorScheme = theme;
  } catch (e) {}

  // Remove launch shell once the page is interactive.
  // DOMContentLoaded fires after HTML is parsed + inline scripts run,
  // which is well before React hydration — gives a brief skeleton moment.
  function removeLaunchShell() {
    var el = document.getElementById('__mo-launch');
    if (!el) return;
    el.style.transition = 'opacity 0.18s ease';
    el.style.opacity    = '0';
    el.style.pointerEvents = 'none';
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', removeLaunchShell);
  } else {
    removeLaunchShell();
  }
})();
`;

/**
 * Critical above-the-fold styles injected inline.
 * These apply BEFORE the external stylesheet is fetched,
 * preventing the white flash on first Capacitor/WebView load.
 */
const criticalCSS = `
html,body{margin:0;padding:0;background:#f4f7fb;color:#0f172a}
html.dark,html.dark body{background:#080c13;color:#f5f7fb}
#__mo-launch{
  position:fixed;inset:0;z-index:9999;
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:16px;
  background:#f4f7fb;padding-top:env(safe-area-inset-top,0px);
}
html.dark #__mo-launch{background:#080c13}
#__mo-launch-logo{
  width:76px;height:76px;border-radius:22px;
  overflow:hidden;position:relative;
  background:linear-gradient(135deg,#0f9f8f,#5b6ee1);
  box-shadow:0 8px 24px rgba(15,159,143,.3);
}
html.dark #__mo-launch-logo{background:linear-gradient(135deg,#2dd4bf,#9da7ff)}
#__mo-launch-logo img{width:76px;height:76px;object-fit:cover;display:block;border-radius:22px}
#__mo-launch-text{font-size:13px;font-weight:500;color:#708095;letter-spacing:.02em}
html.dark #__mo-launch-text{color:#7f8ca0}
#__mo-launch-bar{
  width:120px;height:3px;border-radius:999px;overflow:hidden;
  background:rgba(15,159,143,.12);
}
html.dark #__mo-launch-bar{background:rgba(45,212,191,.12)}
#__mo-launch-fill{
  height:100%;width:0;border-radius:999px;
  background:linear-gradient(90deg,#0f9f8f,#5b6ee1);
  animation:mo-boot-fill 0.9s cubic-bezier(.16,1,.3,1) forwards;
}
html.dark #__mo-launch-fill{background:linear-gradient(90deg,#2dd4bf,#9da7ff)}
@keyframes mo-boot-fill{from{width:0}to{width:100%}}
`;

export const metadata: Metadata = {
  title: "MyOrtho 2.0 | Clinical Orthodontic Operating System",
  description:
    "MyOrtho 2.0 — a complete clinical operating system for scan processing, AI segmentation, CAD design, treatment planning, and manufacturing. Built for orthodontists and dental labs.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8fb" },
    { media: "(prefers-color-scheme: dark)",  color: "#080c13" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        {/* Critical CSS — applied before external stylesheet fetch */}
        <style dangerouslySetInnerHTML={{ __html: criticalCSS }} />
        {/* Theme + launch-shell bootstrap — runs synchronously before paint */}
        <script dangerouslySetInnerHTML={{ __html: bootstrapScript }} />
      </head>
      <body className={manrope.variable}>
        {/*
          Launch shell — visible before React hydration.
          The bootstrapScript removes it on DOMContentLoaded.
          Rendered as static HTML so it paints immediately.
        */}
        <div id="__mo-launch" aria-hidden="true">
          <div id="__mo-launch-logo" dangerouslySetInnerHTML={{ __html: `<img src="/app-icon.png" alt="MyOrtho" onerror="this.style.display='none'">` }} />
          <div id="__mo-launch-text">Preparing clinical workspace</div>
          <div id="__mo-launch-bar">
            <div id="__mo-launch-fill" />
          </div>
        </div>

        <ThemeProvider>
          <AuthProvider>
            <AppShell>{children}</AppShell>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
