import type { Metadata } from "next";
import Link from "next/link";
import { DownloadNav } from "@/components/download/DownloadNav";

export const metadata: Metadata = {
  title: {
    template: "%s · MyOrtho",
    default: "Download Center · MyOrtho",
  },
  description: "Download MyOrtho — the clinical operating system for orthodontics. Available for macOS and Windows.",
  openGraph: {
    siteName: "MyOrtho",
    type: "website",
  },
};

export default function DownloadLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-dl-bg text-dl-text font-dl antialiased">
      <DownloadNav />
      <main>{children}</main>
      <footer className="border-t border-dl-border mt-24 py-12">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2.5">
              <div className="h-6 w-6 rounded-md bg-dl-accent flex items-center justify-center">
                <span className="text-white text-[10px] font-black">M</span>
              </div>
              <span className="text-sm font-semibold text-dl-text">MyOrtho</span>
              <span className="text-xs text-dl-muted ml-1">v2.0 · Stable</span>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-xs text-dl-muted">
              <Link href="/download" className="hover:text-dl-text transition-colors">Download</Link>
              <Link href="/download/release-notes" className="hover:text-dl-text transition-colors">Release Notes</Link>
              <Link href="/download/system-requirements" className="hover:text-dl-text transition-colors">System Requirements</Link>
              <Link href="/download/enterprise" className="hover:text-dl-text transition-colors">Enterprise</Link>
              <Link href="/download/privacy" className="hover:text-dl-text transition-colors">Privacy</Link>
              <Link href="/download/terms" className="hover:text-dl-text transition-colors">Terms</Link>
            </nav>
            <p className="text-[11px] text-dl-muted">© 2026 MyOrtho Technologies, Inc.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
