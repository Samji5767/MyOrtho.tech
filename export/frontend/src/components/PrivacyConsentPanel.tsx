"use client";

import React, { useState } from "react";
import { 
  ShieldAlert, 
  Download, 
  Trash2, 
  CheckCircle, 
  Lock, 
  Share2,
  FileCheck2
} from "lucide-react";

export default function PrivacyConsentPanel() {
  const [allowAiTraining, setAllowAiTraining] = useState(false);
  const [allowThirdParty, setAllowThirdParty] = useState(false);
  const [patientName, setPatientName] = useState("Eleanor Vance");
  const [showPortabilityAlert, setShowPortabilityAlert] = useState(false);

  const handleDownloadPortability = () => {
    setShowPortabilityAlert(true);
    setTimeout(() => setShowPortabilityAlert(false), 3000);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[500px] text-xs">
      
      {/* HIPAA/GDPR configuration forms */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <form className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-semibold text-lg flex items-center gap-2">
                <Lock size={20} className="text-primary" />
                Data Ownership & Privacy Panel
              </h3>
              <p className="text-xs text-secondary mt-0.5">Configure compliance sharing boundaries, AI training opt-ins, and export portals.</p>
            </div>
            <span className="flex items-center gap-1 bg-slate-900 border border-border text-teal-400 px-2.5 py-0.5 rounded font-bold uppercase text-[9px]">
              GDPR/HIPAA Active
            </span>
          </div>

          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-secondary">Subject Patient</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
              />
            </div>

            {/* AI training permissions check */}
            <div className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-4">
              <div className="flex items-start justify-between">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                    Consent-based AI Model Training
                  </h4>
                  <p className="text-secondary text-[10px]">Allow anonymized STL scans and clinical photos to train MyOrtho tooth segmentations models.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowAiTraining}
                    onChange={(e) => setAllowAiTraining(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>

              <div className="flex items-start justify-between pt-4 border-t border-border/50">
                <div className="space-y-0.5">
                  <h4 className="font-bold text-xs text-primary flex items-center gap-1.5">
                    Third-Party Laboratory Data Sharing
                  </h4>
                  <p className="text-secondary text-[10px]">Enable sharing of clinical charts with outsourcing dental groups or local manufacturing plants.</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allowThirdParty}
                    onChange={(e) => setAllowThirdParty(e.target.checked)}
                    className="sr-only peer"
                  />
                  <div className="w-9 h-5 bg-slate-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-500"></div>
                </label>
              </div>
            </div>
          </div>

          <div className="pt-6 border-t border-border mt-6 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleDownloadPortability}
              className="flex items-center gap-1.5 px-4 py-2 border border-border hover:bg-slate-900 text-xs font-semibold rounded-lg transition-colors"
            >
              <Download size={14} /> Request Portability Export (JSON)
            </button>
          </div>
        </form>
      </div>

      {/* Portability status tracker */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <Share2 size={16} className="text-teal-400" /> Portability Log
        </h4>

        {showPortabilityAlert ? (
          <div className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl p-3 flex gap-2">
            <CheckCircle size={16} className="shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">JSON Export Package Ready</span>
              <span className="text-[10px] block mt-0.5">Download links sent to patient registry profile.</span>
            </div>
          </div>
        ) : (
          <p className="text-slate-400">Requesting portability generates an encrypted archive of STL models, prescription notes, and diagnostic records.</p>
        )}
      </div>

    </div>
  );
}
