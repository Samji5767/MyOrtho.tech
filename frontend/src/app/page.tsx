"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { Case } from "@/types";
import { useTheme } from "@/components/ThemeContext";
import { 
  FolderHeart, 
  Upload, 
  Activity, 
  Sliders, 
  Smartphone, 
  Printer, 
  Users, 
  ShieldAlert, 
  Sun, 
  Moon,
  Sparkles,
  Layers,
  BarChart,
  BrainCircuit,
  Eye,
  GitFork,
  Palette,
  ShieldCheck,
  FileCheck,
  BookOpen,
  Lock,
  Package,
  Building2,
  Cpu,
  CreditCard,
  BarChart3,
  Search,
  LifeBuoy,
  Bell,
  Menu,
  X,
  ChevronRight,
  User,
  ActivitySquare,
  ArrowLeft,
  RefreshCw
} from "lucide-react";

import NativeSheet from "@/components/NativeSheet";
import NativeAlert from "@/components/NativeAlert";

// Lazy-loaded routes / components for code splitting & initial performance
const PatientManagement = dynamic(() => import("@/components/PatientManagement"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const ScanImportSystem = dynamic(() => import("@/components/ScanImportSystem"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const Viewer3D = dynamic(() => import("@/components/Viewer3D"), {
  loading: () => <div className="h-[550px] w-full animate-skeleton rounded-2xl" />,
  ssr: false
});
const AlignerStaging = dynamic(() => import("@/components/AlignerStaging"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const ManufacturingCenter = dynamic(() => import("@/components/ManufacturingCenter"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const PortalsView = dynamic(() => import("@/components/PortalsView"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const EnterpriseDashboard = dynamic(() => import("@/components/EnterpriseDashboard"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const SegmentationWorkspace = dynamic(() => import("@/components/SegmentationWorkspace"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const ObservabilityConsole = dynamic(() => import("@/components/ObservabilityConsole"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const WhiteLabelSettings = dynamic(() => import("@/components/WhiteLabelSettings"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const SupplyChain = dynamic(() => import("@/components/SupplyChain"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const BillingManager = dynamic(() => import("@/components/BillingManager"), {
  loading: () => <div className="h-96 w-full animate-skeleton rounded-2xl" />
});
const CommandPalette = dynamic(() => import("@/components/CommandPalette"), {
  ssr: false
});

type ActiveTab = 
  | "cases" 
  | "patients"
  | "upload" 
  | "viewer" 
  | "staging" 
  | "printers" 
  | "production" 
  | "inventory"
  | "portal" 
  | "appointments"
  | "progress"
  | "billing"
  | "revenue"
  | "analytics"
  | "organizations"
  | "users"
  | "compliance"
  | "ai"
  | "integrations"
  | "monitoring"
  | "settings"; // Mobile Settings Menu

interface SidebarItem {
  id: ActiveTab;
  label: string;
  icon: React.ComponentType<any>;
}

interface SidebarSection {
  title: string;
  items: SidebarItem[];
}

export default function Dashboard() {
  const { theme, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<ActiveTab>("cases");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [commandCenterActive, setCommandCenterActive] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  // Viewport & Network Connectivity states for iOS Native simulation
  const [isMobile, setIsMobile] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [scrolled, setScrolled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Native iOS Modals & Alerts simulator states
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertConfig, setAlertConfig] = useState({
    title: "",
    message: "",
    primaryLabel: "OK",
    destructive: false,
    onPrimary: () => {}
  });

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetTitle, setSheetTitle] = useState("");
  const [sheetData, setSheetData] = useState<Case | null>(null);

  // Touch swipe gesture states
  const touchStart = useRef({ x: 0, y: 0 });

  const triggerHaptic = () => {
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
  };

  // Viewport & Network listener + Hash routing
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    handleResize();
    window.addEventListener("resize", handleResize);

    // Online/Offline listener
    setIsOnline(navigator.onLine);
    const goOnline = () => setIsOnline(true);
    const goOffline = () => setIsOnline(false);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    // Initial Hash check
    const handleHashChange = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash) {
        setActiveTab(hash as ActiveTab);
      }
    };
    window.addEventListener("hashchange", handleHashChange);
    handleHashChange();

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
      window.removeEventListener("hashchange", handleHashChange);
    };
  }, []);

  // Update hash when tab changes
  useEffect(() => {
    if (typeof window !== "undefined") {
      window.location.hash = activeTab;
    }
  }, [activeTab]);

  // Active Case Profile State (Shared context)
  const [selectedCase, setSelectedCase] = useState<Case>({
    id: "c1111111-1111-1111-1111-111111111111",
    patientId: "11111111-1111-1111-1111-111111111111",
    patientName: "Eleanor Vance",
    status: "planning",
    notes: "Requires upper/lower clear aligners. 18 maxillary stages.",
    createdAt: "2026-05-10",
    updatedAt: "2026-06-12"
  });

  // Simulated live clinical alerts
  const notifications = useMemo(() => [
    { id: 1, text: "Formlabs 3B+ (Lab A) resin level low (850 ml remaining)", type: "warning" },
    { id: 2, text: "Print Job #4 failed on Asiga Max UV: check thin wall risks", type: "error" },
    { id: 3, text: "Informed Aligner Consent signed by Julian Kerr", type: "info" }
  ], []);

  // Keyboard shortcut listener for Cmd/Ctrl+K search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCommandCenterActive(prev => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectCase = (caseItem: Case) => {
    setSelectedCase(caseItem);
    triggerHaptic();
    if (isMobile) {
      // Present clinical drawer sheet on mobile viewports
      setSheetData(caseItem);
      setSheetTitle(caseItem.patientName);
      setSheetOpen(true);
    } else {
      if (caseItem.status === "draft") {
        setActiveTab("upload");
      } else if (caseItem.status === "planning") {
        setActiveTab("viewer");
      } else if (caseItem.status === "manufacturing") {
        setActiveTab("production");
      } else {
        setActiveTab("cases");
      }
    }
  };

  // Primary mobile tabs transitions list
  const mobileTabOrder: ActiveTab[] = ["cases", "patients", "production", "analytics", "settings"];

  const goNextTab = () => {
    const idx = mobileTabOrder.indexOf(activeTab);
    if (idx !== -1 && idx < mobileTabOrder.length - 1) {
      setActiveTab(mobileTabOrder[idx + 1]);
    }
  };

  const goPrevTab = () => {
    const idx = mobileTabOrder.indexOf(activeTab);
    if (idx > 0) {
      setActiveTab(mobileTabOrder[idx - 1]);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diffX = e.changedTouches[0].clientX - touchStart.current.x;
    const diffY = e.changedTouches[0].clientY - touchStart.current.y;
    // Swipe left/right threshold
    if (Math.abs(diffX) > 120 && Math.abs(diffY) < 60) {
      if (diffX > 0) {
        goPrevTab();
      } else {
        goNextTab();
      }
    }
  };

  const handleScroll = (e: React.UIEvent<HTMLElement>) => {
    const target = e.currentTarget;
    if (target.scrollTop > 20) {
      setScrolled(true);
    } else {
      setScrolled(false);
    }
  };

  const simulatePullToRefresh = () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    triggerHaptic();
    setTimeout(() => {
      setIsRefreshing(false);
      // Trigger a light confirmation dialog simulation
      setAlertConfig({
        title: "Database Synced",
        message: "Successfully loaded latest patient cases and printer telemetries from Stuttgart Hub.",
        primaryLabel: "Dismiss",
        destructive: false,
        onPrimary: () => {}
      });
      setAlertOpen(true);
    }, 1200);
  };

  // Sections navigation mapping for Desktop Sidebar
  const navigationSections: SidebarSection[] = useMemo(() => [
    {
      title: "Clinical",
      items: [
        { id: "cases", label: "Cases Directory", icon: FolderHeart },
        { id: "patients", label: "Patient Intake", icon: Users },
        { id: "upload", label: "Scan Acquisition", icon: Upload },
        { id: "viewer", label: "3D Treatment View", icon: ActivitySquare }
      ]
    },
    {
      title: "Manufacturing",
      items: [
        { id: "printers", label: "Printers Array", icon: Printer },
        { id: "production", label: "Print Queue", icon: Cpu },
        { id: "inventory", label: "Supply Inventory", icon: Package }
      ]
    },
    {
      title: "Patient Portal",
      items: [
        { id: "portal", label: "Smile Engagement", icon: Smartphone },
        { id: "appointments", label: "Appointments", icon: BookOpen },
        { id: "progress", label: "Progress Logs", icon: Sliders }
      ]
    },
    {
      title: "Business Operations",
      items: [
        { id: "billing", label: "SaaS Billing", icon: CreditCard },
        { id: "revenue", label: "Executive Growth", icon: BarChart },
        { id: "analytics", label: "Regional Analysis", icon: BarChart3 }
      ]
    },
    {
      title: "Enterprise",
      items: [
        { id: "organizations", label: "Clinic Groups", icon: Building2 },
        { id: "users", label: "Security & MFA", icon: Lock },
        { id: "compliance", label: "HIPAA Auditing", icon: ShieldCheck }
      ]
    },
    {
      title: "Platform Console",
      items: [
        { id: "ai", label: "Dental AI Engine", icon: BrainCircuit },
        { id: "integrations", label: "Integrations Hub", icon: GitFork },
        { id: "monitoring", label: "System Telemetry", icon: Activity }
      ]
    }
  ], []);

  // Map active tab to current section title for breadcrumbs
  const activeBreadcrumbs = useMemo(() => {
    if (activeTab === "settings") {
      return { section: "iOS System", page: "Preferences Settings" };
    }
    for (const section of navigationSections) {
      const match = section.items.find(item => item.id === activeTab);
      if (match) {
        return { section: section.title, page: match.label };
      }
    }
    return { section: "Clinical", page: "Orthodontics" };
  }, [activeTab, navigationSections]);

  const renderContent = () => {
    switch (activeTab) {
      case "cases":
        return (
          <div className="h-full overflow-hidden">
            <PatientManagement 
              onSelectCase={handleSelectCase} 
              selectedCaseId={selectedCase.id} 
            />
          </div>
        );
      case "patients":
        return (
          <div className="max-w-4xl mx-auto h-full overflow-y-auto">
            <PatientManagement 
              onSelectCase={handleSelectCase} 
              selectedCaseId={selectedCase.id} 
            />
          </div>
        );
      case "upload":
        return (
          <div className="max-w-3xl mx-auto h-full overflow-y-auto pb-10">
            <ScanImportSystem 
              caseId={selectedCase.id} 
              patientName={selectedCase.patientName} 
              onUploadSuccess={(metrics) => console.log("Scan AI metrics:", metrics)}
            />
          </div>
        );
      case "viewer":
        return (
          <div className="h-full rounded-2xl overflow-hidden relative">
            <button 
              onClick={() => setActiveTab("cases")}
              className="absolute top-4 left-4 z-40 p-2 bg-card/85 backdrop-blur-md rounded-xl border border-border shadow-sm flex items-center gap-1.5 text-xs font-bold md:hidden"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <Viewer3D />
          </div>
        );
      case "staging":
      case "progress":
        return <AlignerStaging caseId={selectedCase.id} patientName={selectedCase.patientName} />;
      case "printers":
      case "production":
        return <ManufacturingCenter />;
      case "inventory":
        return <SupplyChain />;
      case "portal":
      case "appointments":
        return <PortalsView caseId={selectedCase?.id} patientId={selectedCase?.patientId} />;
      case "billing":
        return <BillingManager />;
      case "revenue":
      case "analytics":
        return <EnterpriseDashboard />;
      case "organizations":
      case "users":
      case "compliance":
        return <EnterpriseDashboard />;
      case "ai":
        return <SegmentationWorkspace />;
      case "integrations":
        return <WhiteLabelSettings />;
      case "monitoring":
        return <ObservabilityConsole />;
      case "settings":
        return renderMobileSettings();
      default:
        return <div className="text-secondary text-sm">Please select a dashboard view.</div>;
    }
  };

  // Grouped Settings Menu for mobile tab viewports mimicking iPhone iOS Preferences
  const renderMobileSettings = () => {
    return (
      <div className="space-y-6 max-w-lg mx-auto pb-20">
        <div className="bg-card/60 border border-border rounded-2xl p-4 flex items-center gap-3">
          <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl font-extrabold text-base">
            SJ
          </div>
          <div>
            <h4 className="font-extrabold text-sm text-foreground">Dr. Sarah Jenkins</h4>
            <p className="text-[10px] text-slate-400">Clinic Administrator • West Region</p>
          </div>
        </div>

        <div className="space-y-1 bg-card border border-border rounded-2xl overflow-hidden divide-y divide-border/40 shadow-sm text-xs font-semibold">
          {[
            { id: "integrations", label: "White Label Styling", desc: "Custom themes and portal layouts" },
            { id: "billing", label: "SaaS Billing Panel", desc: "Subscription invoices and meters" },
            { id: "compliance", label: "HIPAA Security Audits", desc: "Patient access logs and compliance checks" },
            { id: "monitoring", label: "System Telemetry Node", desc: "Live printer connection status" }
          ].map((item) => (
            <button
              key={item.id}
              onClick={() => {
                triggerHaptic();
                setActiveTab(item.id as ActiveTab);
              }}
              className="w-full px-4 py-3 flex items-center justify-between text-left hover:bg-slate-500/5 transition-colors active:bg-slate-500/10"
            >
              <div>
                <span className="block text-foreground">{item.label}</span>
                <span className="block text-[9px] text-slate-400 font-medium">{item.desc}</span>
              </div>
              <ChevronRight size={14} className="text-slate-400" />
            </button>
          ))}
        </div>

        <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-between shadow-sm">
          <div>
            <span className="block text-xs font-bold text-foreground">Dark Visual Theme</span>
            <span className="block text-[9px] text-slate-400">Toggle dark mode visuals</span>
          </div>
          <button 
            onClick={() => {
              triggerHaptic();
              toggleTheme();
            }}
            className="p-2 border border-border rounded-xl bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 transition-colors"
          >
            {theme === "light" ? <Moon size={14} /> : <Sun size={14} />}
          </button>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="min-h-screen bg-background text-foreground flex flex-col md:flex-row font-sans antialiased transition-colors duration-200 relative pb-safe-bottom"
      onTouchStart={isMobile ? handleTouchStart : undefined}
      onTouchEnd={isMobile ? handleTouchEnd : undefined}
    >
      
      {/* Offline Status Warning banner */}
      {!isOnline && (
        <div className="bg-amber-600 text-white text-center py-1 text-[10px] font-black tracking-widest uppercase z-50 sticky top-0 flex items-center justify-center gap-1.5 animate-in fade-in slide-in-from-top duration-300">
          <ShieldAlert size={12} className="animate-pulse" />
          <span>Connection Offline — Emulated Offline Fallback Mode</span>
        </div>
      )}

      {/* Left Sidebar Layout - Hidden on mobile viewports */}
      <aside className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-card/85 backdrop-blur-md p-5 flex flex-col justify-between transform transition-transform duration-300 md:translate-x-0 md:static ${
        sidebarOpen ? "translate-x-0" : "-translate-x-0 hidden md:flex"
      }`}>
        <div className="space-y-6 overflow-y-auto pr-1">
          {/* Logo & Header */}
          <div className="flex items-center gap-3 px-2">
            <div className="h-9 w-9 bg-primary text-white flex items-center justify-center rounded-xl font-bold shadow-glow">
              O
            </div>
            <div>
              <h1 className="text-sm font-black tracking-wider text-primary">MYORTHO.TECH</h1>
              <p className="text-[10px] text-secondary font-semibold uppercase tracking-widest">Clinic Operations</p>
            </div>
          </div>

          {/* Navigation Category Groups */}
          <nav className="space-y-5 animate-in fade-in duration-300" aria-label="Sidebar Navigation">
            {navigationSections.map((section, idx) => (
              <div key={idx} className="space-y-1">
                <span className="block px-3 text-[10px] uppercase font-bold text-slate-400 dark:text-slate-500 tracking-wider">
                  {section.title}
                </span>
                <div className="flex flex-wrap gap-2 w-full px-3">
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => {
                          triggerHaptic();
                          setActiveTab(item.id);
                          setSidebarOpen(false);
                        }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-spring ${
                          isActive
                            ? "bg-primary text-white shadow-glow"
                            : "text-secondary hover:text-foreground hover:bg-slate-100 dark:hover:bg-slate-800/60 border border-border/40"
                        }`}
                        aria-current={isActive ? "page" : undefined}
                      >
                        <Icon size={16} className={isActive ? "text-white" : "text-muted-foreground"} />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </div>

        {/* Footer telemetry node status */}
        <div className="pt-4 border-t border-border mt-4 flex items-center justify-between text-[10px] text-slate-400 px-2">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Node: West-SaaS</span>
          </div>
          <span className="font-semibold">v1.2.0</span>
        </div>
      </aside>

      {/* Right Content Panels */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        
        {/* Top Command Bar Header */}
        <header className={`h-16 border-b border-border bg-card/60 backdrop-blur-md sticky top-0 z-30 px-6 flex items-center justify-between transition-shadow ${
          scrolled ? "shadow-sm border-b/80" : ""
        }`}>
          
          {/* Mobile breadcrumbs title */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => {
                triggerHaptic();
                setSidebarOpen(prev => !prev);
              }}
              className="p-2 border border-border rounded-lg bg-card hover:bg-slate-50 dark:hover:bg-slate-800 md:hidden transition-colors"
              aria-label="Toggle Navigation Sidebar"
            >
              {sidebarOpen ? <X size={16} /> : <Menu size={16} />}
            </button>

            {/* Breadcrumb Indicators (Hidden on mobile) */}
            <nav className="hidden sm:flex items-center gap-2 text-xs font-semibold text-secondary animate-in fade-in" aria-label="Breadcrumb">
              <span className="hover:text-foreground transition-colors">Enterprise</span>
              <ChevronRight size={12} className="text-slate-400" />
              <span>{activeBreadcrumbs.section}</span>
              <ChevronRight size={12} className="text-slate-400" />
              <span className="text-foreground font-bold">{activeBreadcrumbs.page}</span>
            </nav>

            {/* Mobile-only Centered Header Title (Collapsing interaction helper) */}
            <span className={`text-sm font-extrabold tracking-tight md:hidden transition-opacity duration-200 ${
              scrolled ? "opacity-100" : "opacity-0"
            }`}>
              {activeTab.toUpperCase()}
            </span>
          </div>

          {/* Center search bar palette trigger */}
          <div className="flex-1 max-w-sm mx-4">
            <button
              onClick={() => {
                triggerHaptic();
                setCommandCenterActive(true);
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 bg-slate-100 hover:bg-slate-200 dark:bg-slate-900/60 dark:hover:bg-slate-900 border border-border rounded-xl text-left text-xs text-secondary hover:text-foreground transition-spring"
            >
              <div className="flex items-center gap-2">
                <Search size={14} className="text-muted-foreground" />
                <span>Search patient or status...</span>
              </div>
              <kbd className="hidden md:inline-block px-1.5 py-0.5 bg-slate-200 dark:bg-slate-800 rounded font-mono text-[9px]">⌘K</kbd>
            </button>
          </div>

          {/* Right Action Widgets */}
          <div className="flex items-center gap-3">
            
            {/* Pull to refresh helper for mobile */}
            <button
              onClick={simulatePullToRefresh}
              className={`p-2 border border-border rounded-xl bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors md:hidden ${
                isRefreshing ? "animate-spin text-primary" : "text-slate-400"
              }`}
              title="Pull to Refresh Simulation"
            >
              <RefreshCw size={14} />
            </button>

            {/* Live Notifications Badge */}
            <div className="relative">
              <button 
                onClick={() => {
                  triggerHaptic();
                  setNotificationsOpen(prev => !prev);
                }}
                className={`p-2 border border-border rounded-xl bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors relative ${
                  notificationsOpen ? "bg-slate-50 dark:bg-slate-850" : ""
                }`}
                aria-label="Toggle Clinical Alerts Panel"
              >
                <Bell size={15} />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500 animate-ping" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-rose-500" />
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-card border border-border rounded-2xl shadow-lg p-4 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex justify-between items-center border-b border-border pb-2 mb-3">
                    <h4 className="text-xs font-black uppercase tracking-wider text-foreground">Clinical Alarm Alerts</h4>
                    <span className="text-[9px] bg-rose-500/10 text-rose-500 font-bold px-2 py-0.5 rounded">3 Active</span>
                  </div>
                  <div className="space-y-2.5">
                    {notifications.map(n => (
                      <div key={n.id} className="p-2 border border-border/50 rounded-xl bg-slate-50/50 dark:bg-slate-900/30 text-xs flex gap-2">
                        <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${
                          n.type === "error" ? "bg-rose-500" : n.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                        }`} />
                        <span className="text-secondary leading-normal">{n.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dark Mode Toggle - Hidden on mobile settings panel handles it */}
            <button 
              onClick={() => {
                triggerHaptic();
                toggleTheme();
              }}
              className="hidden md:block p-2 border border-border rounded-xl bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
              aria-label="Toggle Visual Theme"
            >
              {theme === "light" ? <Moon size={15} /> : <Sun size={15} />}
            </button>

            {/* Doctor Profile Menu - Hidden on mobile */}
            <div className="relative border-l border-border pl-3 hidden md:flex items-center">
              <button 
                onClick={() => {
                  triggerHaptic();
                  setUserMenuOpen(prev => !prev);
                }}
                className="flex items-center gap-2 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-800 p-1.5 rounded-xl border border-border transition-colors"
                aria-label="Toggle Profile Menu"
              >
                <div className="h-6.5 w-6.5 bg-primary/15 text-primary rounded-lg flex items-center justify-center text-[10px] font-bold">
                  SJ
                </div>
                <span className="hidden lg:inline text-xs font-bold pr-1">Dr. Sarah Jenkins</span>
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-11 mt-2 w-48 bg-card border border-border rounded-2xl shadow-lg p-2.5 z-50 text-xs text-secondary">
                  <div className="p-2 border-b border-border mb-1.5">
                    <p className="font-bold text-foreground">Dr. Sarah Jenkins</p>
                    <p className="text-[10px] text-slate-400">Orthodontist • Clinic Admin</p>
                  </div>
                  <button 
                    onClick={() => { triggerHaptic(); setActiveTab("users"); setUserMenuOpen(false); }}
                    className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                  >
                    <Lock size={12} /> Security Options
                  </button>
                  <button 
                    onClick={() => { triggerHaptic(); setActiveTab("billing"); setUserMenuOpen(false); }}
                    className="w-full text-left p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg flex items-center gap-2"
                  >
                    <CreditCard size={12} /> Billing Setup
                  </button>
                </div>
              )}
            </div>

          </div>
        </header>

        {/* Main View Area Container */}
        <main 
          onScroll={handleScroll}
          className="flex-1 p-4 md:p-6 overflow-y-auto no-scrollbar relative focus:outline-none"
        >
          {/* iOS Pull-to-refresh spinner decoration */}
          {isMobile && isRefreshing && (
            <div className="w-full flex justify-center py-2 shrink-0 animate-pulse text-xs text-primary font-bold gap-1.5 items-center">
              <RefreshCw className="animate-spin" size={14} />
              <span>Updating patient registry...</span>
            </div>
          )}

          {/* iOS Collapsing Large Title layout */}
          {isMobile && activeTab !== "viewer" && (
            <div className={`mb-6 transition-all duration-300 ${
              scrolled ? "opacity-0 scale-95 h-0 overflow-hidden mb-0" : "opacity-100 scale-100"
            }`}>
              <h2 className="text-3xl font-black tracking-tight text-foreground capitalize">
                {activeTab === "production" ? "Manufacturing" : activeTab === "integrations" ? "Settings" : activeTab}
              </h2>
              <p className="text-xs text-slate-400 mt-1">MyOrtho.tech Intelligent Portal</p>
            </div>
          )}

          {renderContent()}
        </main>
      </div>

      {/* iOS Floating Bottom Tab Bar Navigation (iPhone/Mobile viewports) */}
      <nav 
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-card/85 backdrop-blur-md border-t border-border flex justify-around items-center pt-2 pb-safe-bottom shadow-lg transition-transform"
        style={{
          paddingBottom: "calc(6px + env(safe-area-inset-bottom))"
        }}
      >
        {[
          { id: "cases", label: "Cases", icon: FolderHeart },
          { id: "patients", label: "Patients", icon: Users },
          { id: "production", label: "Printers", icon: Printer },
          { id: "analytics", label: "Analytics", icon: BarChart3 },
          { id: "settings", label: "Settings", icon: Sliders }
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id || (tab.id === "production" && activeTab === "printers") || (tab.id === "settings" && ["integrations", "billing", "compliance", "monitoring"].includes(activeTab));
          return (
            <button
              key={tab.id}
              onClick={() => {
                triggerHaptic();
                setActiveTab(tab.id as ActiveTab);
              }}
              className={`flex flex-col items-center gap-1.5 py-1 text-[9px] font-bold transition-all ${
                isActive ? "text-primary scale-105" : "text-muted-foreground"
              }`}
              style={{
                width: "20%"
              }}
            >
              <Icon size={20} className={isActive ? "text-primary" : "text-muted-foreground"} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Global Command Center Search Palette Modal */}
      <CommandPalette
        active={commandCenterActive}
        onClose={() => setCommandCenterActive(false)}
        onNavigate={(tab) => {
          triggerHaptic();
          setActiveTab(tab as any);
          setCommandCenterActive(false);
        }}
        onToggleTheme={toggleTheme}
        onResetArch={() => {
          setAlertConfig({
            title: "Reset Coordinates?",
            message: "This will restore dental landmark parameters and clear manual aligner stage adjustments. This action is irreversible.",
            primaryLabel: "Reset",
            destructive: true,
            onPrimary: () => {
              triggerHaptic();
              console.log("Arch layout reset done.");
            }
          });
          setAlertOpen(true);
        }}
      />

      {/* iOS Native sheet modal presenting selected patient diagnostic logs */}
      {isMobile && sheetData && (
        <NativeSheet
          isOpen={sheetOpen}
          title={sheetTitle}
          onClose={() => {
            triggerHaptic();
            setSheetOpen(false);
          }}
        >
          <div className="space-y-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-2xl">
              <span className="block text-[8px] font-black uppercase text-primary tracking-widest mb-1.5">Prescription Case Details</span>
              <h4 className="font-extrabold text-sm text-foreground mb-1">{sheetData.patientName}</h4>
              <p className="text-secondary text-[11px] leading-normal">{sheetData.notes}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900 border border-border rounded-2xl space-y-2.5">
              <span className="block text-[8px] font-black uppercase text-slate-400 tracking-widest">Case Metadata</span>
              <div className="grid grid-cols-2 gap-2 text-[10px] text-secondary">
                <div>
                  <span className="text-slate-400">Case ID:</span>
                  <span className="block font-bold text-foreground font-mono">{sheetData.id.slice(0, 8)}...</span>
                </div>
                <div>
                  <span className="text-slate-400">Status:</span>
                  <span className="block font-bold text-primary capitalize">{sheetData.status.replace("_", " ")}</span>
                </div>
                <div>
                  <span className="text-slate-400">Created:</span>
                  <span className="block font-bold text-foreground">{sheetData.createdAt}</span>
                </div>
                <div>
                  <span className="text-slate-400">Last Active:</span>
                  <span className="block font-bold text-foreground">{sheetData.updatedAt}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => {
                  setSheetOpen(false);
                  setActiveTab("viewer");
                }}
                className="w-full py-3 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <ActivitySquare size={14} /> Launch 3D Treatment Planner
              </button>
              
              <button
                onClick={() => {
                  setSheetOpen(false);
                  setAlertConfig({
                    title: "Authorize Dental STL?",
                    message: "Are you sure you want to approve this digital prescription for clear aligner printing?",
                    primaryLabel: "Sign & Route",
                    destructive: false,
                    onPrimary: () => {
                      triggerHaptic();
                      console.log("Approved case:", sheetData.id);
                    }
                  });
                  setAlertOpen(true);
                }}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-xl flex items-center justify-center gap-1.5 transition-colors shadow-sm"
              >
                <FileCheck size={14} /> Approve & Sign Case
              </button>
            </div>
          </div>
        </NativeSheet>
      )}

      {/* Global Native Alert simulator (UIAlertController) */}
      <NativeAlert
        isOpen={alertOpen}
        title={alertConfig.title}
        message={alertConfig.message}
        primaryActionLabel={alertConfig.primaryLabel}
        primaryActionDestructive={alertConfig.destructive}
        onPrimaryAction={alertConfig.onPrimary}
        secondaryActionLabel="Cancel"
        onSecondaryAction={() => {}}
        onClose={() => setAlertOpen(false)}
      />

    </div>
  );
}
