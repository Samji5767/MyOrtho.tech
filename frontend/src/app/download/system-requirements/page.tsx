import type { Metadata } from "next";
import { Apple, Monitor, Globe, CheckCircle2, AlertCircle, XCircle } from "lucide-react";

export const metadata: Metadata = {
  title: "System Requirements",
  description: "Minimum and recommended system requirements for MyOrtho on macOS, Windows, and the web platform.",
};

interface Req {
  label: string;
  minimum: string;
  recommended: string;
}

interface Platform {
  id: string;
  name: string;
  icon: React.ReactNode;
  reqs: Req[];
  notes: string[];
}

const PLATFORMS: Platform[] = [
  {
    id: "macos",
    name: "macOS",
    icon: <Apple size={16} />,
    reqs: [
      { label: "OS Version", minimum: "macOS 12 Monterey", recommended: "macOS 14 Sonoma or later" },
      { label: "Processor", minimum: "Intel Core i5 (6th gen) / Apple M1", recommended: "Apple M2 Pro or later" },
      { label: "RAM", minimum: "8 GB", recommended: "16 GB or more" },
      { label: "Storage", minimum: "4 GB free (SSD required)", recommended: "16 GB free SSD" },
      { label: "GPU", minimum: "Metal-compatible GPU", recommended: "Dedicated GPU with 4 GB VRAM" },
      { label: "Display", minimum: "1280 × 800", recommended: "Retina 2560 × 1600 or larger" },
      { label: "Network", minimum: "10 Mbps broadband", recommended: "50 Mbps or faster" },
    ],
    notes: [
      "Apple Silicon (M1/M2/M3/M4) is natively supported — no Rosetta translation needed.",
      "3D STL rendering and AI segmentation perform significantly faster on Apple Silicon.",
      "macOS Gatekeeper approval required on first launch.",
    ],
  },
  {
    id: "windows",
    name: "Windows",
    icon: <Monitor size={16} />,
    reqs: [
      { label: "OS Version", minimum: "Windows 10 22H2 (64-bit)", recommended: "Windows 11 23H2 or later" },
      { label: "Processor", minimum: "Intel Core i5 (8th gen) / AMD Ryzen 5 3600", recommended: "Intel Core i7 (12th gen) / AMD Ryzen 7 5800X" },
      { label: "RAM", minimum: "8 GB DDR4", recommended: "16 GB DDR4 or DDR5" },
      { label: "Storage", minimum: "4 GB free (NVMe SSD required)", recommended: "20 GB free NVMe SSD" },
      { label: "GPU", minimum: "DirectX 12 / Vulkan-compatible GPU", recommended: "NVIDIA RTX 3060 / AMD RX 6600 or better" },
      { label: "Display", minimum: "1366 × 768", recommended: "1920 × 1080 or higher" },
      { label: "Network", minimum: "10 Mbps broadband", recommended: "50 Mbps or faster" },
    ],
    notes: [
      "Windows 10 S mode is not supported.",
      "NVIDIA GPU with CUDA 11.8+ unlocks hardware-accelerated AI segmentation.",
      "Virtual machines and ARM-based Windows are not officially supported in v2.0.",
    ],
  },
  {
    id: "web",
    name: "Web Platform",
    icon: <Globe size={16} />,
    reqs: [
      { label: "Browser", minimum: "Chrome 110 / Edge 110 / Firefox 115 / Safari 16.4", recommended: "Chrome 120+ / Safari 17+" },
      { label: "RAM", minimum: "4 GB system RAM", recommended: "8 GB or more" },
      { label: "WebGL", minimum: "WebGL 1.0", recommended: "WebGL 2.0" },
      { label: "Network", minimum: "5 Mbps broadband", recommended: "25 Mbps or faster" },
      { label: "Cookies", minimum: "First-party cookies enabled", recommended: "—" },
      { label: "JavaScript", minimum: "Enabled (required)", recommended: "—" },
    ],
    notes: [
      "The web platform supports all clinical features except local file rendering and offline mode.",
      "For 3D viewer performance on complex scans, the desktop app is strongly recommended.",
      "Safari on iOS/iPadOS has limited 3D rendering support; use desktop Safari for full functionality.",
    ],
  },
];

const LEGEND = [
  { icon: <CheckCircle2 size={13} className="text-emerald-500" />, label: "Fully supported" },
  { icon: <AlertCircle size={13} className="text-amber-500" />, label: "Limited support" },
  { icon: <XCircle size={13} className="text-red-500" />, label: "Not supported" },
];

export default function SystemRequirementsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Header */}
      <div className="mb-14">
        <div className="inline-flex items-center gap-1.5 rounded-full border border-dl-border bg-dl-surface px-3 py-1 text-[11px] font-medium text-dl-muted mb-5">
          System Requirements
        </div>
        <h1 className="text-3xl font-bold tracking-tight text-dl-text mb-3">
          System Requirements
        </h1>
        <p className="text-dl-muted leading-relaxed max-w-xl">
          Minimum specs to run MyOrtho, and recommended specs for the best clinical experience.
          All figures are for MyOrtho v2.0.
        </p>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-4 mb-10 text-xs text-dl-muted">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            {l.icon}
            {l.label}
          </span>
        ))}
      </div>

      {/* Platform tables */}
      <div className="flex flex-col gap-10">
        {PLATFORMS.map((platform) => (
          <section key={platform.id}>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-dl-accent">{platform.icon}</span>
              <h2 className="text-base font-semibold text-dl-text">{platform.name}</h2>
            </div>

            <div className="rounded-xl border border-dl-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-dl-border bg-dl-surface">
                      <th className="px-4 py-3 text-left font-medium text-dl-muted w-[200px]">
                        Component
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-dl-muted">
                        Minimum
                      </th>
                      <th className="px-4 py-3 text-left font-medium text-dl-muted">
                        Recommended
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {platform.reqs.map((req, i) => (
                      <tr
                        key={req.label}
                        className={[
                          "border-b border-dl-border last:border-0",
                          i % 2 === 0 ? "" : "bg-dl-surface/40",
                        ].join(" ")}
                      >
                        <td className="px-4 py-3 font-medium text-dl-text whitespace-nowrap">
                          {req.label}
                        </td>
                        <td className="px-4 py-3 text-dl-muted">{req.minimum}</td>
                        <td className="px-4 py-3 text-dl-text">{req.recommended}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {platform.notes.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5">
                {platform.notes.map((note, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-xs text-dl-muted"
                  >
                    <AlertCircle size={12} className="mt-0.5 shrink-0 text-dl-muted/60" />
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>

      {/* Compliance note */}
      <div className="mt-12 rounded-xl border border-dl-border bg-dl-surface p-5 text-sm text-dl-muted leading-relaxed">
        <span className="font-semibold text-dl-text">HIPAA &amp; clinical environment note: </span>
        MyOrtho is designed to operate on clinic workstations that meet your organization&#39;s
        IT security policy. All patient data is encrypted in transit (TLS 1.3) and at rest
        (AES-256). Network access to{" "}
        <code className="text-xs bg-dl-border/50 rounded px-1 py-0.5">app.myortho.tech</code>{" "}
        and your Supabase project endpoint is required. Proxy and firewall configurations
        should allow WebSocket connections for real-time collaboration.
      </div>
    </div>
  );
}
