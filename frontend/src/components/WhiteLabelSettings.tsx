"use client";

import React, { useState } from "react";
import { Sparkles, Save, CheckCircle2, Globe, Palette, Mail } from "lucide-react";

export default function WhiteLabelSettings() {
  const [domain, setDomain] = useState("aligners.smileclinic.com");
  const [primaryColor, setPrimaryColor] = useState("#0d9488");
  const [themePref, setThemePref] = useState("dark");
  const [invoiceEmail, setInvoiceEmail] = useState("billing@smileclinic.com");
  const [previewActive, setPreviewActive] = useState(false);

  const handleApplyBranding = (e: React.FormEvent) => {
    e.preventDefault();
    setPreviewActive(true);
    // Apply custom primary color to theme CSS variables dynamically
    document.documentElement.style.setProperty("--primary", primaryColor);
    setTimeout(() => setPreviewActive(false), 2000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px]">
      
      {/* Brand customizer settings form */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-card">
        <form onSubmit={handleApplyBranding} className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Palette size={20} className="text-primary" />
                White-Label branding
              </h3>
              <p className="text-xs text-secondary mt-0.5">Customize clinic portal themes, DNS domains, and logos</p>
            </div>
            {previewActive && (
              <span className="flex items-center gap-1.5 text-xs text-teal-400 font-bold animate-pulse">
                <CheckCircle2 size={14} /> Applying Theme CSS...
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
            {/* Custom domain */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-secondary flex items-center gap-1">
                <Globe size={12} /> Domain DNS Mapping
              </label>
              <input
                type="text" required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary"
                value={domain} onChange={(e) => setDomain(e.target.value)}
                placeholder="e.g. aligners.smileclinic.com"
              />
              <span className="text-[10px] text-slate-400">Map a CNAME DNS record targeting portal.myortho.tech.</span>
            </div>

            {/* Colors picker */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-secondary">Primary Color Theme</label>
              <div className="flex gap-2">
                <input
                  type="color"
                  className="h-9 w-12 border border-border rounded-lg bg-transparent cursor-pointer"
                  value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                />
                <input
                  type="text"
                  className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg font-mono focus:outline-none"
                  value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </div>
            </div>

            {/* Theme selection */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-secondary">Portal Default Mode</label>
              <select
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                value={themePref} onChange={(e) => setThemePref(e.target.value)}
              >
                <option value="dark">Dark Theme (Medical Polish)</option>
                <option value="light">Light Theme (Minimalist Clean)</option>
              </select>
            </div>

            {/* Email template */}
            <div className="space-y-2">
              <label className="block text-[10px] uppercase font-bold text-secondary flex items-center gap-1">
                <Mail size={12} /> Accounting Invoicing Email
              </label>
              <input
                type="email" required
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
                value={invoiceEmail} onChange={(e) => setInvoiceEmail(e.target.value)}
                placeholder="billing@smileclinic.com"
              />
            </div>
          </div>

          <div className="pt-6 border-t border-border mt-6 flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors shadow-sm"
            >
              <Save size={14} /> Save & Apply Branding
            </button>
          </div>
        </form>
      </div>

      {/* Live branding preview pane */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between shadow-sm">
        <div className="space-y-4">
          <h4 className="font-semibold text-sm border-b border-border pb-3 flex items-center gap-2">
            <Sparkles size={16} className="text-primary" />
            Live Preview Frame
          </h4>
          <p className="text-[10px] text-secondary">Simulates clinician portal rendering under custom subdomain headers</p>
          
          <div className="border border-border rounded-xl p-4 space-y-4 bg-slate-50 dark:bg-slate-950/40 text-xs">
            <div className="flex justify-between items-center pb-2 border-b border-border/50">
              <span className="font-mono text-[9px] text-slate-400 truncate max-w-[120px]">{domain}</span>
              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: primaryColor }} />
            </div>

            <div className="space-y-2">
              <p className="font-bold">Clinic Workspace Header</p>
              <button 
                className="w-full py-2 text-white font-bold rounded-lg text-[10px]" 
                style={{ backgroundColor: primaryColor }}
              >
                Custom Brand Button
              </button>
            </div>
          </div>
        </div>

        <div className="pt-6 border-t border-border mt-6 text-[10px] text-slate-400">
          CSS styling variables will apply globally to active sub-components.
        </div>
      </div>

    </div>
  );
}
