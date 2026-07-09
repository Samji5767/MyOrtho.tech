"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Apple, ArrowRight, Brain, CheckCircle2, ChevronDown,
  Cpu, Download, Edit3, FileBox, FileText, Globe,
  Hexagon, Layers, Lock, Menu, Monitor, Package,
  Printer, RefreshCw, ScanLine, Settings2,
  Shield, Star, Target, Upload,
  Users, Wand2, X, Zap,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import BrandMark from "@/components/BrandMark";

// ── Brand constants ────────────────────────────────────────────────────────────
const TEAL   = "#3dd9b5";
const BLUE   = "#1a6fff";
const TEXT   = "#e8edf2";
const MUTED  = "rgba(160,185,200,0.62)";
const BORDER = "rgba(61,217,181,0.12)";
const BHOVER = "rgba(61,217,181,0.28)";
const CARDBG = "rgba(10,14,18,0.55)";

// ── Dental arch canvas ─────────────────────────────────────────────────────────
function ArchCanvas() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf: number;
    let t = 0;

    function archPoint(u: number, W: number, H: number) {
      const x = W * 0.1 + W * 0.8 * u;
      const base = H * 0.88;
      const apex = H * 0.12;
      const t2 = u * 2 - 1;
      const y = base - (base - apex) * Math.max(0, 1 - t2 * t2 * 2.4);
      return { x, y };
    }

    const NODE_COUNT = 22;

    function draw() {
      if (!canvas || !ctx) return;
      const W = canvas.width;
      const H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const { x, y } = archPoint(i / 120, W, H);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(61,217,181,0.18)";
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.beginPath();
      for (let i = 0; i <= 120; i++) {
        const u = i / 120;
        const outer = archPoint(u, W, H);
        const cx = W / 2, cy = H * 0.5;
        const x = cx + (outer.x - cx) * 0.86;
        const y = cy + (outer.y - cy) * 0.86;
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = "rgba(61,217,181,0.07)";
      ctx.lineWidth = 1;
      ctx.stroke();

      for (let i = 0; i < NODE_COUNT; i++) {
        const u = i / (NODE_COUNT - 1);
        const { x, y } = archPoint(u, W, H);
        const phase = (t * 0.6 + i * 0.28) % (Math.PI * 2);
        const pulse = 0.5 + 0.5 * Math.sin(phase);
        const isApex = Math.abs(u - 0.5) < 0.06;
        const baseR = isApex ? 4.5 : 2.5;
        const r = baseR + pulse * (isApex ? 2.5 : 1.5);

        const grad = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        grad.addColorStop(0, `rgba(61,217,181,${isApex ? 0.55 : 0.22})`);
        grad.addColorStop(1, "rgba(61,217,181,0)");
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = isApex
          ? `rgba(61,217,181,${0.7 + pulse * 0.3})`
          : `rgba(61,217,181,${0.35 + pulse * 0.22})`;
        ctx.fill();

        if (isApex) {
          for (let s = 0; s < 6; s++) {
            const angle = (s / 6) * Math.PI * 2 + t * 0.3;
            const len = 18 + pulse * 10;
            ctx.beginPath();
            ctx.moveTo(x + Math.cos(angle) * (r + 2), y + Math.sin(angle) * (r + 2));
            ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
            ctx.strokeStyle = `rgba(61,217,181,${0.12 * pulse})`;
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }

      for (let i = 0; i < 3; i++) {
        const u = 0.2 + i * 0.3;
        const { x, y } = archPoint(u, W, H);
        const lineH = 20 + i * 8;
        ctx.beginPath();
        ctx.moveTo(x, y - lineH);
        ctx.lineTo(x, y + lineH);
        ctx.strokeStyle = "rgba(61,217,181,0.10)";
        ctx.lineWidth = 0.8;
        ctx.stroke();
      }

      t += 0.018;
      raf = requestAnimationFrame(draw);
    }

    function resize() {
      if (!canvas || !ctx) return;
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    }

    resize();
    draw();
    window.addEventListener("resize", resize);
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return <canvas ref={ref} className="h-full w-full" style={{ display: "block" }} aria-hidden />;
}

// ── Sticky Navbar ──────────────────────────────────────────────────────────────
function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Features",  href: "#features"  },
    { label: "Workflow",  href: "#workflow"   },
    { label: "Pricing",   href: "#pricing"    },
    { label: "Security",  href: "#security"   },
    { label: "Downloads", href: "#downloads"  },
    { label: "Docs",      href: "/docs"       },
    { label: "Contact",   href: "#contact"    },
  ];

  return (
    <header
      role="banner"
      style={{
        position: "sticky",
        top: 0,
        zIndex: 100,
        backdropFilter: "blur(16px)",
        background: scrolled ? "rgba(7,9,12,0.92)" : "rgba(7,9,12,0.72)",
        borderBottom: scrolled ? `1px solid ${BORDER}` : "1px solid transparent",
        transition: "all 0.2s",
      }}
    >
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "0 24px", height: 64, display: "flex", alignItems: "center" }}>
        {/* Logo */}
        <Link
          href="/"
          style={{ display: "flex", alignItems: "center", textDecoration: "none", flexShrink: 0, marginRight: 32 }}
          aria-label="MyOrtho home"
        >
          {/* Override --foreground so BrandMark text is legible on the dark landing background */}
          <span style={{ "--foreground": TEXT } as React.CSSProperties}>
            <BrandMark variant="compact" size="sm" />
          </span>
        </Link>

        {/* Desktop nav links */}
        <nav aria-label="Main navigation" style={{ display: "flex", gap: 20, flex: 1 }} className="hidden lg:flex">
          {navLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              style={{ fontSize: 14, fontWeight: 500, color: MUTED, textDecoration: "none", transition: "color 0.15s", whiteSpace: "nowrap" }}
              onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >{label}</a>
          ))}
        </nav>

        {/* Right actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto" }}>
          <Link
            href="/login"
            className="hidden md:inline-flex"
            style={{
              fontSize: 14, fontWeight: 600, color: TEXT,
              textDecoration: "none", padding: "8px 14px", borderRadius: 8,
              transition: "background 0.15s",
            }}
            onMouseEnter={e => ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.06)")}
            onMouseLeave={e => ((e.currentTarget as HTMLElement).style.background = "transparent")}
          >Sign In</Link>

          <Link
            href="/signup"
            style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: TEAL, color: "#050d0c",
              borderRadius: 9, padding: "9px 18px",
              fontSize: 13, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 0 18px rgba(61,217,181,0.28)",
              whiteSpace: "nowrap",
            }}
          >Get Started <ArrowRight size={13} /></Link>

          <button
            type="button"
            onClick={() => setMenuOpen(v => !v)}
            aria-label="Toggle navigation menu"
            aria-expanded={menuOpen}
            className="lg:hidden"
            style={{ background: "none", border: "none", cursor: "pointer", color: TEXT, padding: 8, display: "flex", marginLeft: 4 }}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div
          className="lg:hidden"
          style={{
            position: "absolute", top: "100%", left: 0, right: 0,
            background: "rgba(7,9,12,0.98)", borderBottom: `1px solid ${BORDER}`,
            padding: "8px 24px 20px",
          }}
        >
          {navLinks.map(({ label, href }) => (
            <a
              key={label}
              href={href}
              onClick={() => setMenuOpen(false)}
              style={{
                display: "block", padding: "13px 0",
                fontSize: 16, fontWeight: 500, color: TEXT,
                textDecoration: "none", borderBottom: `1px solid ${BORDER}`,
              }}
            >{label}</a>
          ))}
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Link href="/login" onClick={() => setMenuOpen(false)}
              style={{
                flex: 1, textAlign: "center", padding: "12px",
                border: `1px solid rgba(255,255,255,0.15)`,
                borderRadius: 9, fontSize: 14, fontWeight: 600, color: TEXT, textDecoration: "none",
              }}
            >Sign In</Link>
            <Link href="/signup" onClick={() => setMenuOpen(false)}
              style={{
                flex: 1, textAlign: "center", padding: "12px",
                background: TEAL, borderRadius: 9,
                fontSize: 14, fontWeight: 700, color: "#050d0c", textDecoration: "none",
              }}
            >Get Started</Link>
          </div>
        </div>
      )}
    </header>
  );
}

// ── Section heading helper ─────────────────────────────────────────────────────
function SectionHeading({ eyebrow, title, sub }: { eyebrow: string; title: string; sub?: string }) {
  return (
    <div style={{ textAlign: "center", marginBottom: 56 }}>
      <p style={{
        fontSize: 11, fontWeight: 700, letterSpacing: "0.16em",
        textTransform: "uppercase", color: TEAL, marginBottom: 12,
      }}>{eyebrow}</p>
      <h2 style={{
        fontSize: "clamp(28px, 3.5vw, 44px)", fontWeight: 800,
        letterSpacing: "-0.025em", color: TEXT,
        lineHeight: 1.1, marginBottom: sub ? 16 : 0,
        textWrap: "balance",
      } as React.CSSProperties}>{title}</h2>
      {sub && (
        <p style={{ fontSize: 16, color: MUTED, maxWidth: 520, margin: "0 auto", lineHeight: 1.6 }}>{sub}</p>
      )}
    </div>
  );
}

// ── Card helper ───────────────────────────────────────────────────────────────
function FeatureCard({ icon: Icon, title, desc }: { icon: LucideIcon; title: string; desc: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        border: `1px solid ${hovered ? BHOVER : BORDER}`,
        borderRadius: 16, padding: "22px 20px",
        background: hovered ? "rgba(61,217,181,0.05)" : CARDBG,
        transition: "all 0.2s",
        cursor: "default",
      }}
    >
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        background: "rgba(61,217,181,0.10)",
        display: "flex", alignItems: "center", justifyContent: "center",
        color: TEAL, marginBottom: 14,
      }}>
        <Icon size={18} />
      </div>
      <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 6 }}>{title}</p>
      <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.6 }}>{desc}</p>
    </div>
  );
}

// ── Hero ───────────────────────────────────────────────────────────────────────
function HeroSection() {
  return (
    <section
      aria-label="Hero"
      style={{ position: "relative", minHeight: "calc(100vh - 64px)", display: "flex", alignItems: "center" }}
    >
      <div
        style={{
          maxWidth: 1220, margin: "0 auto", padding: "64px 24px 48px",
          width: "100%", display: "grid",
          gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center",
        }}
        className="hero-grid"
      >
        {/* Left copy */}
        <div style={{ position: "relative", zIndex: 2 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: `1px solid rgba(61,217,181,0.25)`,
            borderRadius: 999, padding: "5px 14px",
            fontSize: 12, fontWeight: 600, color: "rgba(200,220,215,0.8)",
            marginBottom: 28, background: "rgba(61,217,181,0.05)",
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: "50%",
              background: TEAL, boxShadow: `0 0 8px ${TEAL}`,
              animation: "pulse-dot 2s ease-in-out infinite",
              flexShrink: 0,
            }} />
            From Scan to Smile · AI Segmentation · v2.0
          </div>

          <h1 style={{
            fontSize: "clamp(40px, 5.5vw, 68px)", fontWeight: 800,
            lineHeight: 1.04, letterSpacing: "-0.03em",
            marginBottom: 20, color: "#edf2f7",
          }}>
            The{" "}
            <span style={{ color: TEAL, textShadow: `0 0 40px rgba(61,217,181,0.35)` }}>
              Clinical OS
            </span>
            <br />
            for Orthodontics
          </h1>

          <p style={{ fontSize: 17, lineHeight: 1.65, color: MUTED, maxWidth: 460, marginBottom: 36 }}>
            From intraoral scan to production-ready aligners — in eight steps.
            AI-powered segmentation, precision treatment planning, and export to any printer.
          </p>

          {/* Platform downloads */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 28 }}>
            {[
              { label: "Mac — Apple Silicon", icon: Apple, primary: true },
              { label: "Mac — Intel",          icon: Apple, primary: false },
              { label: "Windows",              icon: Monitor, primary: false },
            ].map(({ label, icon: Icon, primary }) => (
              <a
                key={label}
                href="#downloads"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8,
                  padding: "11px 20px", borderRadius: 11,
                  fontSize: 14, fontWeight: 600, textDecoration: "none",
                  transition: "all 0.15s",
                  background: primary ? "#f0faf8" : "transparent",
                  color: primary ? "#050d0c" : TEXT,
                  border: primary ? "none" : `1px solid rgba(200,215,225,0.20)`,
                }}
              >
                <Icon size={15} />
                {label}
              </a>
            ))}
          </div>

          {/* Trust badges */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
            {[
              { icon: Shield, label: "HIPAA Compliant" },
              { icon: Lock,   label: "End-to-End Encrypted" },
              { icon: Star,   label: "Free for Clinicians" },
            ].map(({ icon: Icon, label }) => (
              <div key={label} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: MUTED }}>
                <Icon size={13} style={{ color: TEAL }} />
                {label}
              </div>
            ))}
          </div>
        </div>

        {/* Right: arch animation */}
        <div style={{ height: "clamp(340px, 44vw, 540px)", position: "relative" }}>
          <ArchCanvas />
        </div>
      </div>
    </section>
  );
}

// ── Stats bar ─────────────────────────────────────────────────────────────────
function StatsBar() {
  const stats = [
    { value: "22+",    label: "Tooth IDs Supported"  },
    { value: "7",      label: "Export Formats"        },
    { value: "HIPAA",  label: "Compliance Level"      },
    { value: "v2.0",   label: "Current Version"       },
  ];
  return (
    <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, background: "rgba(7,9,12,0.7)" }}>
      <div style={{
        maxWidth: 1220, margin: "0 auto", padding: "0 24px",
        display: "grid", gridTemplateColumns: "repeat(4, 1fr)",
      }}>
        {stats.map(({ value, label }, i) => (
          <div
            key={value}
            style={{
              padding: "26px 0", textAlign: "center",
              borderRight: i < stats.length - 1 ? `1px solid ${BORDER}` : "none",
            }}
          >
            <div style={{
              fontSize: "clamp(22px, 2.8vw, 32px)", fontWeight: 800,
              color: TEAL, letterSpacing: "-0.02em", lineHeight: 1, marginBottom: 5,
            }}>{value}</div>
            <div style={{
              fontSize: 11, fontWeight: 500, color: "rgba(160,180,190,0.50)",
              letterSpacing: "0.04em", textTransform: "uppercase",
            }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Features ──────────────────────────────────────────────────────────────────
function FeaturesSection() {
  const features = [
    { icon: Upload,       title: "STL Upload",           desc: "Drag-and-drop STL, OBJ, PLY with auto jaw-type detection." },
    { icon: Cpu,          title: "AI Segmentation",      desc: "Per-tooth extraction with FDI labelling and confidence scores." },
    { icon: Target,       title: "Arch Detection",       desc: "Automatic maxillary/mandibular classification via PCA analysis." },
    { icon: Wand2,        title: "Treatment Planning",   desc: "AI-derived movement prescriptions with stage constraint optimisation." },
    { icon: Edit3,        title: "Per-Tooth Editor",     desc: "Precise translation, rotation, torque, and IPR per tooth." },
    { icon: Layers,       title: "Stage Simulation",     desc: "0.25 mm / 2° per-stage constraints with collision detection." },
    { icon: Settings2,    title: "Attachment Planning",  desc: "Optimised attachment placement for predictable movements." },
    { icon: Package,      title: "STL Export",           desc: "Seven export types including aligners, pontics, and gingival masks." },
    { icon: RefreshCw,    title: "Watertight Repair",    desc: "Normals, manifold check, and millimetre-accurate mesh repair." },
    { icon: Zap,          title: "Unlimited Exports",    desc: "No caps. Export as many cases and formats as you need." },
    { icon: Shield,       title: "HIPAA Compliant",      desc: "PHI encrypted at rest and in transit. SOC 2 Type II pending." },
    { icon: Globe,        title: "Multi-Platform",       desc: "Mac, Windows, and Web — one account, one workspace." },
  ];

  return (
    <section
      id="features"
      style={{ maxWidth: 1220, margin: "0 auto", padding: "96px 24px" }}
      aria-label="Features"
    >
      <SectionHeading
        eyebrow="Full Clinical Workflow"
        title="Everything from scan to printer"
        sub="A complete clinical operating system built for the pace of a modern orthodontic practice."
      />
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
        gap: 14,
      }}>
        {features.map(({ icon: Icon, title, desc }) => (
          <FeatureCard key={title} icon={Icon} title={title} desc={desc} />
        ))}
      </div>
    </section>
  );
}

// ── Workflow timeline ─────────────────────────────────────────────────────────
function WorkflowSection() {
  const steps = [
    { n: 1, icon: ScanLine,   label: "Scan",               desc: "Intraoral scan or desktop model scan" },
    { n: 2, icon: Upload,     label: "Upload",             desc: "STL / OBJ / PLY — up to 250 MB" },
    { n: 3, icon: Cpu,        label: "AI Segmentation",    desc: "Automatic per-tooth & gingiva extraction" },
    { n: 4, icon: Wand2,      label: "Treatment Planning", desc: "Movement prescriptions with AI assist" },
    { n: 5, icon: FileText,   label: "Clinical Review",    desc: "Doctor reviews and approves the plan" },
    { n: 6, icon: Edit3,      label: "Fine Adjustment",    desc: "Per-tooth refinements & IPR scheduling" },
    { n: 7, icon: Package,    label: "Export",             desc: "Printer-ready STL, 3MF, or OBJ" },
    { n: 8, icon: Printer,    label: "Print & Deliver",    desc: "Send to lab or in-house printer" },
  ];

  return (
    <section
      id="workflow"
      style={{
        background: "rgba(61,217,181,0.025)",
        borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
        padding: "96px 24px",
      }}
      aria-label="Workflow"
    >
      <div style={{ maxWidth: 1220, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="How It Works"
          title="Scan to smile in eight steps"
          sub="A structured clinical pathway that keeps every case on track — from first scan to final delivery."
        />

        {/* Desktop horizontal steps */}
        <div className="workflow-grid" style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: 8, position: "relative" }}>
          {/* Connector line */}
          <div aria-hidden style={{
            position: "absolute", top: 36, left: "7%", right: "7%",
            height: 1, background: `linear-gradient(90deg, transparent, ${BORDER} 10%, ${BORDER} 90%, transparent)`,
            zIndex: 0,
          }} />

          {steps.map(({ n, icon: Icon, label, desc }) => (
            <div key={n} style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
              <div style={{
                width: 52, height: 52, borderRadius: "50%",
                background: n <= 3 ? `linear-gradient(135deg, ${BLUE} 0%, ${TEAL} 100%)` : CARDBG,
                border: n <= 3 ? "none" : `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                margin: "0 auto 12px",
                boxShadow: n <= 3 ? "0 0 20px rgba(61,217,181,0.25)" : "none",
              }}>
                <Icon size={18} style={{ color: n <= 3 ? "#fff" : MUTED }} />
              </div>
              <div style={{
                fontSize: 10, fontWeight: 700, color: TEAL,
                letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4,
              }}>{String(n).padStart(2, "0")}</div>
              <p style={{ fontSize: 12, fontWeight: 700, color: TEXT, marginBottom: 4, lineHeight: 1.3 }}>{label}</p>
              <p style={{ fontSize: 11, color: MUTED, lineHeight: 1.5 }} className="hidden lg:block">{desc}</p>
            </div>
          ))}
        </div>

        {/* Mobile vertical steps */}
        <div className="workflow-list lg:hidden" style={{ display: "none" }}>
          {steps.map(({ n, icon: Icon, label, desc }) => (
            <div key={n} style={{ display: "flex", gap: 16, padding: "16px 0", borderBottom: `1px solid ${BORDER}` }}>
              <div style={{
                width: 44, height: 44, borderRadius: "50%", flexShrink: 0,
                background: n <= 3 ? `linear-gradient(135deg, ${BLUE} 0%, ${TEAL} 100%)` : CARDBG,
                border: n <= 3 ? "none" : `1px solid ${BORDER}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: n <= 3 ? "0 0 14px rgba(61,217,181,0.20)" : "none",
              }}>
                <Icon size={16} style={{ color: n <= 3 ? "#fff" : MUTED }} />
              </div>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEAL, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 3 }}>
                  Step {n}
                </div>
                <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, marginBottom: 3 }}>{label}</p>
                <p style={{ fontSize: 12, color: MUTED, lineHeight: 1.5 }}>{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── AI section ────────────────────────────────────────────────────────────────
function AISection() {
  const capabilities = [
    "Automatic per-tooth segmentation from raw mesh",
    "FDI / ISO 3950 tooth labelling (11–48)",
    "Auto maxillary / mandibular arch classification",
    "\"Auto-detect\" jaw type via PCA surface analysis",
    "Gingiva mesh extraction as a separate STL",
    "Per-tooth segmentation confidence scores",
    "AI treatment movement prescriptions",
    "Stage constraint optimisation (0.25 mm / 2°)",
    "Watertight mesh auto-repair for print readiness",
  ];

  return (
    <section
      id="ai"
      style={{ maxWidth: 1220, margin: "0 auto", padding: "96px 24px" }}
      aria-label="AI Capabilities"
    >
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 64, alignItems: "center" }} className="ai-grid">
        {/* Left */}
        <div>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color: TEAL, marginBottom: 12 }}>
            AI-Powered Engine
          </p>
          <h2 style={{
            fontSize: "clamp(28px, 3.5vw, 42px)", fontWeight: 800,
            letterSpacing: "-0.025em", color: TEXT, lineHeight: 1.1, marginBottom: 16,
          }}>
            Precision at<br />clinical scale
          </h2>
          <p style={{ fontSize: 16, color: MUTED, lineHeight: 1.65, marginBottom: 32, maxWidth: 440 }}>
            MyOrtho&apos;s segmentation engine processes raw dental mesh files and
            returns per-tooth STLs in seconds — no manual labelling required.
          </p>
          <Link
            href="/signup"
            style={{
              display: "inline-flex", alignItems: "center", gap: 8,
              background: TEAL, color: "#050d0c",
              borderRadius: 10, padding: "12px 22px",
              fontSize: 14, fontWeight: 700, textDecoration: "none",
              boxShadow: "0 0 22px rgba(61,217,181,0.30)",
            }}
          >
            <Brain size={16} />
            Try AI Segmentation
          </Link>
        </div>

        {/* Right: capability list */}
        <div style={{
          border: `1px solid ${BORDER}`,
          borderRadius: 20, padding: 28,
          background: CARDBG,
        }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: TEAL, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 20 }}>
            Capabilities
          </p>
          <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 12 }}>
            {capabilities.map((cap) => (
              <li key={cap} style={{ display: "flex", alignItems: "flex-start", gap: 10, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                <CheckCircle2 size={14} style={{ color: TEAL, flexShrink: 0, marginTop: 2 }} />
                {cap}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

// ── Export section ────────────────────────────────────────────────────────────
function ExportSection() {
  const exports = [
    { icon: Layers,   title: "Aligner Shells",       desc: "Per-stage thermoforming shells, upper and lower" },
    { icon: Settings2,title: "Attachment Templates", desc: "Precisely placed attachment cutouts per arch" },
    { icon: Hexagon,  title: "Pontic Models",        desc: "Missing tooth fill meshes for aesthetic planning" },
    { icon: FileBox,  title: "Gingival Mask",        desc: "Soft tissue representation for realistic preview" },
    { icon: Target,   title: "Occlusal Indices",     desc: "Bite registration guides for accurate seating" },
    { icon: Package,  title: "Individual Teeth",     desc: "Per-tooth STLs with FDI labelling for reference" },
    { icon: Wand2,    title: "Gingiva Mesh",         desc: "Extracted gingival geometry as a standalone STL" },
  ];

  return (
    <section
      id="export"
      style={{
        background: "rgba(61,217,181,0.018)",
        borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
        padding: "96px 24px",
      }}
      aria-label="Export Formats"
    >
      <div style={{ maxWidth: 1220, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="Production-Ready Outputs"
          title="Seven export types, zero compromises"
          sub="Every file format a modern orthodontic lab or in-house printer needs."
        />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
          {exports.map(({ icon: Icon, title, desc }) => (
            <FeatureCard key={title} icon={Icon} title={title} desc={desc} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Security section ──────────────────────────────────────────────────────────
function SecuritySection() {
  const items = [
    { icon: Shield,   title: "HIPAA Compliant",          desc: "All PHI handled per HIPAA Privacy and Security Rules." },
    { icon: Lock,     title: "End-to-End Encryption",    desc: "AES-256 at rest, TLS 1.3 in transit — always." },
    { icon: Users,    title: "Role-Based Access Control", desc: "Granular permissions: admin, clinician, lab, read-only." },
    { icon: FileText, title: "Audit Logging",            desc: "Immutable audit trail for every PHI access event." },
    { icon: CheckCircle2, title: "SOC 2 Type II",        desc: "Annual third-party security audit in progress." },
    { icon: Globe,    title: "GDPR Ready",               desc: "EU patient data stays in EU-region storage." },
    { icon: Zap,      title: "Zero-Knowledge Design",    desc: "Encryption keys never leave your account boundary." },
    { icon: Target,   title: "Penetration Tested",       desc: "External red-team assessment conducted annually." },
  ];

  return (
    <section
      id="security"
      style={{ maxWidth: 1220, margin: "0 auto", padding: "96px 24px" }}
      aria-label="Security"
    >
      <SectionHeading
        eyebrow="Enterprise-Grade Security"
        title="Your patients' data is sacred"
        sub="Security is not a checkbox. It is a first-class clinical requirement built into every layer."
      />
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 14 }}>
        {items.map(({ icon: Icon, title, desc }) => (
          <FeatureCard key={title} icon={Icon} title={title} desc={desc} />
        ))}
      </div>
    </section>
  );
}

// ── Pricing section ───────────────────────────────────────────────────────────
function PricingSection() {
  const proFeatures = [
    "Unlimited patient cases",
    "Unlimited AI segmentation",
    "Unlimited STL exports (all 7 types)",
    "All 3 platforms: Mac, Windows, Web",
    "Per-tooth editor & stage simulation",
    "Attachment planning tools",
    "HIPAA-compliant storage",
    "Email support",
  ];

  const enterpriseFeatures = [
    "Everything in Professional",
    "Team management & roles",
    "SSO / SAML 2.0",
    "Dedicated account manager",
    "SLA guarantee",
    "Custom integrations & API",
    "On-premise deployment option",
    "Priority support & training",
  ];

  return (
    <section
      id="pricing"
      style={{
        background: "rgba(61,217,181,0.018)",
        borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`,
        padding: "96px 24px",
      }}
      aria-label="Pricing"
    >
      <div style={{ maxWidth: 900, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="Simple Pricing"
          title="One plan for clinicians, one for teams"
          sub="Free during our beta. Subscriptions launch when the platform exits beta."
        />

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }} className="pricing-grid">
          {/* Professional */}
          <div style={{
            border: `1.5px solid ${TEAL}`,
            borderRadius: 22, padding: 32,
            background: "rgba(61,217,181,0.04)",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", top: -12, left: 24,
              background: TEAL, color: "#050d0c",
              fontSize: 11, fontWeight: 800, letterSpacing: "0.06em",
              textTransform: "uppercase", padding: "3px 12px", borderRadius: 999,
            }}>Most Popular</div>

            <p style={{ fontSize: 13, fontWeight: 700, color: TEAL, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Professional
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>$49</span>
              <span style={{ fontSize: 14, color: MUTED }}>/month</span>
            </div>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 28, lineHeight: 1.5 }}>
              For individual orthodontists and small practices.
              <br />Free during beta.
            </p>

            <Link href="/signup"
              style={{
                display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                background: TEAL, color: "#050d0c",
                borderRadius: 11, padding: "13px", width: "100%",
                fontSize: 14, fontWeight: 700, textDecoration: "none",
                boxShadow: "0 0 20px rgba(61,217,181,0.28)",
                marginBottom: 24,
              }}
            >Start Free Trial <ArrowRight size={14} /></Link>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {proFeatures.map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                  <CheckCircle2 size={14} style={{ color: TEAL, flexShrink: 0, marginTop: 2 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>

          {/* Enterprise */}
          <div style={{
            border: `1px solid ${BORDER}`,
            borderRadius: 22, padding: 32,
            background: CARDBG,
          }}>
            <p style={{ fontSize: 13, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 8 }}>
              Enterprise
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 6 }}>
              <span style={{ fontSize: 40, fontWeight: 800, color: TEXT, letterSpacing: "-0.03em" }}>Custom</span>
            </div>
            <p style={{ fontSize: 13, color: MUTED, marginBottom: 28, lineHeight: 1.5 }}>
              For multi-location clinics, DSOs, and dental laboratories.
              <br />Volume pricing available.
            </p>

            <a href="mailto:enterprise@myortho.tech"
              style={{
                display: "flex", justifyContent: "center", alignItems: "center", gap: 8,
                border: `1px solid rgba(200,215,225,0.22)`, color: TEXT,
                borderRadius: 11, padding: "13px", width: "100%",
                fontSize: 14, fontWeight: 600, textDecoration: "none",
                transition: "border-color 0.15s",
                marginBottom: 24,
              }}
              onMouseEnter={e => ((e.currentTarget as HTMLElement).style.borderColor = TEAL)}
              onMouseLeave={e => ((e.currentTarget as HTMLElement).style.borderColor = "rgba(200,215,225,0.22)")}
            >Contact Sales <ArrowRight size={14} /></a>

            <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
              {enterpriseFeatures.map(f => (
                <li key={f} style={{ display: "flex", gap: 10, fontSize: 13, color: TEXT, lineHeight: 1.5 }}>
                  <CheckCircle2 size={14} style={{ color: MUTED, flexShrink: 0, marginTop: 2 }} />
                  {f}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Downloads section ─────────────────────────────────────────────────────────
function DownloadsSection() {
  const platforms = [
    { icon: Apple,   os: "macOS",   label: "Apple Silicon",   sub: "M1, M2, M3, M4",        available: true  },
    { icon: Apple,   os: "macOS",   label: "Intel Mac",       sub: "10.14 Mojave or later",  available: true  },
    { icon: Monitor, os: "Windows", label: "Windows",         sub: "Windows 10 / 11 64-bit", available: true  },
    { icon: Globe,   os: "Linux",   label: "Linux",           sub: "AppImage — coming soon", available: false },
  ];

  return (
    <section
      id="downloads"
      style={{ maxWidth: 1220, margin: "0 auto", padding: "96px 24px" }}
      aria-label="Downloads"
    >
      <SectionHeading
        eyebrow="Available Everywhere"
        title="Native apps for every platform"
        sub="Download the desktop app or use the web version — same account, same cases."
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 14, marginBottom: 28 }}>
        {platforms.map(({ icon: Icon, os, label, sub, available }) => (
          <a
            key={label}
            href={available ? "#" : undefined}
            aria-disabled={!available}
            style={{
              display: "block", padding: "24px 20px",
              border: `1px solid ${available ? BORDER : "rgba(61,217,181,0.07)"}`,
              borderRadius: 16,
              background: available ? CARDBG : "rgba(10,14,18,0.30)",
              textDecoration: "none",
              opacity: available ? 1 : 0.55,
              transition: "all 0.2s",
              cursor: available ? "pointer" : "default",
            }}
            onMouseEnter={e => { if (available) (e.currentTarget as HTMLElement).style.borderColor = BHOVER; }}
            onMouseLeave={e => { if (available) (e.currentTarget as HTMLElement).style.borderColor = BORDER; }}
          >
            <Icon size={28} style={{ color: available ? TEAL : MUTED, marginBottom: 14 }} />
            <p style={{ fontSize: 11, fontWeight: 700, color: MUTED, letterSpacing: "0.06em", textTransform: "uppercase", marginBottom: 4 }}>{os}</p>
            <p style={{ fontSize: 15, fontWeight: 700, color: TEXT, marginBottom: 4 }}>{label}</p>
            <p style={{ fontSize: 12, color: MUTED }}>{sub}</p>
            {available && (
              <div style={{
                marginTop: 16, display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 12, fontWeight: 700, color: TEAL,
              }}>
                <Download size={12} /> Download
              </div>
            )}
          </a>
        ))}
      </div>

      {/* Web app CTA */}
      <div style={{
        border: `1px solid ${BORDER}`, borderRadius: 18,
        padding: "28px 32px", background: CARDBG,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        flexWrap: "wrap", gap: 20,
      }}>
        <div>
          <p style={{ fontSize: 16, fontWeight: 700, color: TEXT, marginBottom: 4 }}>Prefer the browser?</p>
          <p style={{ fontSize: 13, color: MUTED }}>The web app works on any modern browser — no download required.</p>
        </div>
        <Link href="/login"
          style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            border: `1px solid rgba(200,215,225,0.22)`, color: TEXT,
            borderRadius: 10, padding: "12px 20px",
            fontSize: 14, fontWeight: 600, textDecoration: "none",
            whiteSpace: "nowrap",
          }}
        >Open Web App <ArrowRight size={14} /></Link>
      </div>
    </section>
  );
}

// ── FAQ section ───────────────────────────────────────────────────────────────
function FAQSection() {
  const [open, setOpen] = useState<number | null>(null);

  const faqs = [
    {
      q: "Is MyOrtho free to use?",
      a: "Yes — MyOrtho is free for individual orthodontists during our open beta. Subscriptions will be introduced when the platform exits beta, with a generous free tier for solo clinicians.",
    },
    {
      q: "What scan file formats are supported?",
      a: "MyOrtho accepts STL, OBJ, and PLY formats. Files up to 250 MB are supported. Both ASCII and binary variants of STL are accepted.",
    },
    {
      q: "How accurate is the AI tooth segmentation?",
      a: "Segmentation accuracy depends on scan quality. On high-quality intraoral scans, per-tooth separation achieves clinical-grade results. All outputs should be reviewed by a licensed clinician before use in treatment — AI output is a workflow aid, not a clinical decision.",
    },
    {
      q: "Is patient data stored securely?",
      a: "Yes. All patient data is encrypted at rest (AES-256) and in transit (TLS 1.3). MyOrtho is HIPAA-compliant. EU customers' data is stored in EU-region infrastructure in accordance with GDPR.",
    },
    {
      q: "What printers are compatible with the exported STLs?",
      a: "The exported STLs are watertight and manifold-checked, compatible with any FDM, SLA, or DLP printer that accepts standard STL input — including FormLabs, Bambu, Carbon, SprintRay, and Envision.",
    },
    {
      q: "Does the desktop app require an internet connection?",
      a: "The 3D editor and basic tools work offline. AI segmentation and cloud sync require a connection. A full offline mode is on our roadmap.",
    },
    {
      q: "Can I use MyOrtho in a multi-doctor practice?",
      a: "Yes. The Enterprise plan includes team management, role-based access control, and admin dashboards for multi-location practices, DSOs, and dental laboratories.",
    },
  ];

  return (
    <section
      id="faq"
      style={{
        background: "rgba(61,217,181,0.018)",
        borderTop: `1px solid ${BORDER}`,
        padding: "96px 24px",
      }}
      aria-label="Frequently Asked Questions"
    >
      <div style={{ maxWidth: 720, margin: "0 auto" }}>
        <SectionHeading
          eyebrow="FAQ"
          title="Common questions"
        />
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {faqs.map(({ q, a }, i) => (
            <div
              key={i}
              style={{
                border: `1px solid ${open === i ? BHOVER : BORDER}`,
                borderRadius: 14,
                background: open === i ? "rgba(61,217,181,0.04)" : CARDBG,
                overflow: "hidden",
                transition: "all 0.15s",
                marginBottom: 6,
              }}
            >
              <button
                type="button"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
                style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  width: "100%", padding: "18px 20px",
                  background: "none", border: "none", cursor: "pointer",
                  textAlign: "left", gap: 12,
                }}
              >
                <span style={{ fontSize: 15, fontWeight: 600, color: TEXT, lineHeight: 1.4 }}>{q}</span>
                <ChevronDown
                  size={16}
                  style={{
                    color: MUTED, flexShrink: 0,
                    transform: open === i ? "rotate(180deg)" : "none",
                    transition: "transform 0.2s",
                  }}
                />
              </button>
              {open === i && (
                <p style={{
                  padding: "0 20px 18px",
                  fontSize: 14, color: MUTED, lineHeight: 1.7, margin: 0,
                }}>{a}</p>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Footer ────────────────────────────────────────────────────────────────────
function Footer() {
  const cols = [
    {
      heading: "Product",
      links: [
        { label: "Features",   href: "#features"   },
        { label: "Workflow",   href: "#workflow"    },
        { label: "Pricing",    href: "#pricing"     },
        { label: "Downloads",  href: "#downloads"   },
        { label: "Changelog",  href: "/changelog"   },
      ],
    },
    {
      heading: "Developers",
      links: [
        { label: "Documentation", href: "/docs"    },
        { label: "API Reference", href: "/api"     },
        { label: "GitHub",        href: "https://github.com/myortho" },
      ],
    },
    {
      heading: "Company",
      links: [
        { label: "Security",   href: "#security"    },
        { label: "Contact",    href: "#contact"     },
        { label: "LinkedIn",   href: "https://linkedin.com/company/myortho" },
        { label: "Support",    href: "mailto:support@myortho.tech" },
      ],
    },
    {
      heading: "Legal",
      links: [
        { label: "Privacy Policy",   href: "/privacy" },
        { label: "Terms of Service", href: "/terms"   },
        { label: "Security Policy",  href: "/security"},
        { label: "HIPAA Notice",     href: "/hipaa"   },
      ],
    },
  ];

  return (
    <footer
      id="contact"
      style={{
        borderTop: `1px solid ${BORDER}`,
        padding: "64px 24px 40px",
      }}
      aria-label="Footer"
    >
      <div style={{ maxWidth: 1220, margin: "0 auto" }}>
        {/* Top: logo + columns */}
        <div style={{ display: "grid", gridTemplateColumns: "1.5fr repeat(4, 1fr)", gap: 40, marginBottom: 48 }} className="footer-grid">
          {/* Brand */}
          <div>
            <div style={{ marginBottom: 14 }}>
              {/* Override --foreground for legibility on the dark footer background */}
              <span style={{ "--foreground": TEXT } as React.CSSProperties}>
                <BrandMark variant="compact" size="sm" />
              </span>
            </div>
            <p style={{ fontSize: 13, color: MUTED, lineHeight: 1.65, maxWidth: 220 }}>
              The clinical operating system for modern orthodontics.
            </p>
            <div style={{ display: "flex", gap: 6, marginTop: 16 }}>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: "4px 10px",
              }}>
                <Shield size={11} style={{ color: TEAL }} /> HIPAA
              </div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 5,
                fontSize: 11, color: MUTED, border: `1px solid ${BORDER}`,
                borderRadius: 6, padding: "4px 10px",
              }}>
                <Globe size={11} style={{ color: TEAL }} /> GDPR
              </div>
            </div>
          </div>

          {/* Link columns */}
          {cols.map(({ heading, links }) => (
            <div key={heading}>
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: MUTED, marginBottom: 14 }}>
                {heading}
              </p>
              <ul style={{ listStyle: "none", padding: 0, margin: 0, display: "flex", flexDirection: "column", gap: 10 }}>
                {links.map(({ label, href }) => (
                  <li key={label}>
                    <a
                      href={href}
                      style={{ fontSize: 13, color: MUTED, textDecoration: "none", transition: "color 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.color = TEXT)}
                      onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
                    >{label}</a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexWrap: "wrap", gap: 10,
          borderTop: `1px solid ${BORDER}`, paddingTop: 24,
        }}>
          <span style={{ fontSize: 12, color: "rgba(140,160,175,0.50)" }}>
            © 2026 MyOrtho.tech — Clinical Software. All rights reserved.
          </span>
          <span style={{ fontSize: 12, color: "rgba(140,160,175,0.45)" }}>
            AI output is a workflow tool only. Must be reviewed by a licensed clinician.
          </span>
        </div>
      </div>
    </footer>
  );
}

// ── Main landing page ─────────────────────────────────────────────────────────
export default function LandingPage() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    }
  }, [status, router]);

  return (
    <div
      style={{
        minHeight: "100vh",
        overflowX: "hidden",
        background: "linear-gradient(160deg, #07090c 0%, #080e0d 40%, #070b09 70%, #07090c 100%)",
        color: TEXT,
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
    >
      {/* Radial ambient glow */}
      <div
        aria-hidden
        style={{
          position: "fixed", inset: 0, pointerEvents: "none",
          background: "radial-gradient(ellipse 55% 50% at 72% 40%, rgba(61,217,181,0.05) 0%, transparent 70%)",
        }}
      />

      <Navbar />
      <HeroSection />
      <StatsBar />
      <FeaturesSection />
      <WorkflowSection />
      <AISection />
      <ExportSection />
      <SecuritySection />
      <PricingSection />
      <DownloadsSection />
      <FAQSection />
      <Footer />

      <style>{`
        @keyframes pulse-dot {
          0%, 100% { opacity: 1; box-shadow: 0 0 8px #3dd9b5; }
          50%       { opacity: 0.65; box-shadow: 0 0 3px #3dd9b5; }
        }
        @media (max-width: 768px) {
          .hero-grid     { grid-template-columns: 1fr !important; }
          .ai-grid       { grid-template-columns: 1fr !important; }
          .pricing-grid  { grid-template-columns: 1fr !important; }
          .footer-grid   { grid-template-columns: 1fr 1fr !important; }
        }
        @media (max-width: 900px) {
          .workflow-grid { display: none !important; }
          .workflow-list { display: flex !important; flex-direction: column; }
        }
        @media (min-width: 901px) {
          .workflow-list { display: none !important; }
        }
      `}</style>
    </div>
  );
}
