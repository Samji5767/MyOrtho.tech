"use client";

import React, { useState, useEffect } from "react";
import { Sparkles, FileText, CheckCircle2, ChevronRight, BarChart3, ShieldCheck } from "lucide-react";

export default function ClinicalDiagnostics() {
  // Tooth widths state for Bolton Analysis
  const [maxillaryWidths, setMaxillaryWidths] = useState<Record<number, number>>({
    16: 10.0, 15: 7.0, 14: 7.2, 13: 8.0, 12: 6.5, 11: 8.5,
    21: 8.5, 22: 6.5, 23: 8.0, 24: 7.2, 25: 7.0, 26: 10.0
  });

  const [mandibularWidths, setMandibularWidths] = useState<Record<number, number>>({
    46: 10.5, 45: 7.1, 44: 7.0, 43: 6.9, 42: 5.9, 41: 5.4,
    31: 5.4, 32: 5.9, 33: 6.9, 34: 7.0, 35: 7.1, 36: 10.5
  });

  // Clinical parameters for Angle classification
  const [overjet, setOverjet] = useState(2.2); // mm
  const [overbite, setOverbite] = useState(2.0); // mm
  const [crowding, setCrowding] = useState(3.5); // mm
  const [crossbite, setCrossbite] = useState(false);

  // Ratios results
  const [boltonOverall, setBoltonOverall] = useState(91.3);
  const [boltonAnterior, setBoltonAnterior] = useState(77.2);
  const [angleClass, setAngleClass] = useState("Class I");
  const [complexity, setComplexity] = useState(35);
  const [hl7Message, setHl7Message] = useState("");

  // Re-run Bolton math & Case classification when states change
  useEffect(() => {
    // 1. Bolton Overall (12 teeth)
    const sumMax12 = Object.values(maxillaryWidths).reduce((a, b) => a + b, 0);
    const sumMan12 = Object.values(mandibularWidths).reduce((a, b) => a + b, 0);
    const overall = sumMax12 > 0 ? (sumMan12 / sumMax12) * 100 : 91.3;
    setBoltonOverall(overall);

    // 2. Bolton Anterior (6 teeth: 13, 12, 11, 21, 22, 23)
    const max6Keys = [13, 12, 11, 21, 22, 23];
    const man6Keys = [33, 32, 31, 41, 42, 43];
    const sumMax6 = max6Keys.reduce((acc, k) => acc + (maxillaryWidths[k] || 0), 0);
    const sumMan6 = man6Keys.reduce((acc, k) => acc + (mandibularWidths[k] || 0), 0);
    const anterior = sumMax6 > 0 ? (sumMan6 / sumMax6) * 100 : 77.2;
    setBoltonAnterior(anterior);

    // 3. Classifications
    let classification = "Class I";
    let score = 35;
    if (overjet > 4.5) {
      classification = "Class II";
      score = 75;
    } else if (overjet < 0.0) {
      classification = "Class III";
      score = 85;
    }

    if (crowding > 6.0 || overbite < 0.0) {
      score += 15;
    }
    if (crossbite) {
      score += 10;
    }
    setAngleClass(classification);
    setComplexity(Math.min(score, 100));

    // 4. Update HL7 Message
    const timestampStr = new Date().toISOString().replace(/[-:T]/g, "").slice(0, 12);
    const msh = `MSH|^~\\&|MYORTHO_AI|CLINIC_NODE|||${timestampStr}||ORU^R01|MSG001|P|2.5`;
    const pid = `PID|||PAT_9410||Vance^Eleanor||19940812|F|`;
    const obx1 = `OBX|1|NM|BOLTON_OVERALL||${overall.toFixed(1)}|%|89.0-93.0|N|||F`;
    const obx2 = `OBX|2|TX|ANGLE_CLASS||${classification}||||||F`;
    const obx3 = `OBX|3|NM|COMPLEXITY_SCORE||${Math.min(score, 100)}||1-100|N|||F`;
    setHl7Message([msh, pid, obx1, obx2, obx3].join("\n"));

  }, [maxillaryWidths, mandibularWidths, overjet, overbite, crowding, crossbite]);

  return (
    <div className="space-y-6">
      {/* Regulatory Scope Disclaimer Banner */}
      <div className="bg-amber-500/10 border border-amber-500/20 text-amber-400 rounded-2xl p-4 text-[11px] font-semibold">
        <strong>Regulatory Notice:</strong> MyOrtho.tech is a clinical workflow assistance and visualization tool. It does NOT diagnose malocclusions or compile autonomous treatment staging plans. All staging calculations and clinical indices are suggestions that require dentist validation and approval under FDA guidelines.
      </div>

      {/* Overview */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            <Sparkles className="text-primary" size={20} />
            Clinical AI Staging Suggestions
          </h3>
          <p className="text-xs text-secondary mt-0.5">Bolton indexes, malocclusion staging models, and HL7 structural logs</p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-bold">
          <ShieldCheck size={14} /> Clinician Oversight Enforced
        </span>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Bolton width adjusting sliders */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-4">
          <h4 className="font-semibold text-sm border-b border-border pb-3 flex items-center gap-2">
            <BarChart3 size={16} className="text-primary" />
            Bolton Analysis Widths
          </h4>
          
          <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block">Central Incisors Widths (mm)</span>
            {/* Tooth 11 slider */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Maxillary Central (FDI 11)</span>
                <span className="text-primary font-bold">{maxillaryWidths[11]} mm</span>
              </div>
              <input
                type="range" min="6.0" max="11.0" step="0.1"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={maxillaryWidths[11]}
                onChange={(e) => setMaxillaryWidths({ ...maxillaryWidths, 11: parseFloat(e.target.value) })}
              />
            </div>

            {/* Tooth 41 slider */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Mandibular Central (FDI 41)</span>
                <span className="text-primary font-bold">{mandibularWidths[41]} mm</span>
              </div>
              <input
                type="range" min="4.0" max="8.0" step="0.1"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={mandibularWidths[41]}
                onChange={(e) => setMandibularWidths({ ...mandibularWidths, 41: parseFloat(e.target.value) })}
              />
            </div>
            
            <span className="text-[10px] uppercase font-bold text-secondary tracking-wider block pt-2 border-t border-border/50">Angle Class Parameters</span>
            {/* Overjet */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Overjet (Sagittal Gap)</span>
                <span className="text-primary font-bold">{overjet.toFixed(1)} mm</span>
              </div>
              <input
                type="range" min="-2.0" max="8.0" step="0.1"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={overjet}
                onChange={(e) => setOverjet(parseFloat(e.target.value))}
              />
            </div>

            {/* Overbite */}
            <div>
              <div className="flex justify-between text-xs font-medium mb-1">
                <span>Overbite (Vertical Overlap)</span>
                <span className="text-primary font-bold">{overbite.toFixed(1)} mm</span>
              </div>
              <input
                type="range" min="-4.0" max="8.0" step="0.1"
                className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary"
                value={overbite}
                onChange={(e) => setOverbite(parseFloat(e.target.value))}
              />
            </div>
          </div>
        </div>

        {/* Calculations display */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <h4 className="font-semibold text-sm border-b border-border pb-3">Clinical Metrics Summary</h4>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Bolton Overall</span>
              <p className="text-2xl font-bold tracking-tight mt-1">{boltonOverall.toFixed(1)}%</p>
              <span className="text-[9px] text-slate-400 block mt-0.5">Target: 91.3%</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Bolton Anterior</span>
              <p className="text-2xl font-bold tracking-tight mt-1">{boltonAnterior.toFixed(1)}%</p>
              <span className="text-[9px] text-slate-400 block mt-0.5">Target: 77.2%</span>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Angle Class</span>
              <p className="text-xl font-bold text-teal-400 mt-1">{angleClass}</p>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
              <span className="text-[10px] uppercase font-bold text-secondary">Complexity Rating</span>
              <p className={`text-xl font-bold mt-1 ${complexity > 60 ? "text-amber-500" : "text-green-400"}`}>
                {complexity} / 100
              </p>
            </div>
          </div>

          <div className="p-4 bg-primary/5 border border-primary/10 rounded-xl text-xs space-y-2">
            <span className="font-bold flex items-center gap-1"><Sparkles size={14} className="text-primary" /> Staging Suggestion (Review Required)</span>
            <p className="text-secondary">
              Indicates suspected {angleClass} malocclusion indicators. Bolton Overall ratio of {boltonOverall.toFixed(1)}% is suggested for clinician review. Ultimate clinical diagnosis remains with the prescribing professional.
            </p>
          </div>
        </div>

        {/* HL7 Output Display */}
        <div className="bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h4 className="font-semibold text-sm border-b border-border pb-3 flex items-center gap-2">
              <FileText size={16} className="text-primary" />
              HL7 Messaging (ORU^R01)
            </h4>
            <p className="text-[10px] text-secondary">Standard structural observational log payload ready for hospital information syncs</p>
            <textarea
              readOnly
              rows={8}
              className="w-full p-3 bg-slate-50 dark:bg-slate-950/60 border border-border rounded-xl text-[10px] font-mono focus:outline-none resize-none"
              value={hl7Message}
            />
          </div>
          <button className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 mt-4">
            Transmit HL7 Packet
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
