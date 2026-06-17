"use client";

import React, { useState } from "react";
import { 
  FileText, 
  FileSignature as Signature, 
  Globe, 
  ShieldCheck, 
  Plus, 
  Download, 
  History, 
  Lock, 
  CheckCircle2 
} from "lucide-react";

interface LegalConsentRecord {
  id: string;
  patientName: string;
  jurisdiction: string;
  signedAt: string;
  retentionUntil: string;
  documentHash: string;
  status: "signed" | "pending";
}

export default function ConsentPortal() {
  const [jurisdiction, setJurisdiction] = useState("US-CA");
  const [patientName, setPatientName] = useState("Eleanor Vance");
  const [signName, setSignName] = useState("");
  const [agreedToRisks, setAgreedToRisks] = useState(false);
  const [isSigned, setIsSigned] = useState(false);
  const [signedHash, setSignedHash] = useState("");
  
  const [records, setRecords] = useState<LegalConsentRecord[]>([
    {
      id: "csr-801",
      patientName: "Eleanor Vance",
      jurisdiction: "US-CA",
      signedAt: "Pending",
      retentionUntil: "2036-06-14",
      documentHash: "Pending Signing",
      status: "pending"
    },
    {
      id: "csr-802",
      patientName: "Jameson Foster",
      jurisdiction: "EU-DE",
      signedAt: "2026-06-08 14:15 UTC",
      retentionUntil: "2036-06-08",
      documentHash: "f1a8e94cb02c91845a90d8a57e3f421ba1019df94689c1c5a93d8b18471e42c2",
      status: "signed"
    }
  ]);

  const handleSignConsent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!agreedToRisks) {
      alert("Must acknowledge patient risk disclosures.");
      return;
    }

    const docHash = Math.floor(Math.random() * 999999) + "e94cb02c91845a90d8a57e3f421ba1019df94689";
    setSignedHash(docHash);
    setIsSigned(true);

    setRecords(records.map(rec => 
      rec.patientName === patientName 
        ? { 
            ...rec, 
            signedAt: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC", 
            documentHash: docHash, 
            status: "signed" 
          }
        : rec
    ));
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Dynamic consent form builder */}
      <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-border pb-4">
            <div>
              <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                <FileText size={20} className="text-teal-400" />
                Digital Consent & Legal Agreement
              </h3>
              <p className="text-secondary text-[11px] mt-0.5">Generate jurisdiction-specific risk disclosures, e-signature requests, and retention trails.</p>
            </div>
            <span className="flex items-center gap-1 bg-slate-900 border border-border text-teal-400 px-2 py-0.5 rounded font-bold uppercase text-[9px]">
              <Globe size={11} /> {jurisdiction} Compliance
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-secondary">Target Jurisdiction</label>
              <select
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
              >
                <option value="US-CA">United States (California DPH)</option>
                <option value="EU-DE">European Union (Germany BfArM)</option>
                <option value="UK-MHRA">United Kingdom (MHRA)</option>
                <option value="APAC-SG">Singapore (HSA Med Device)</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-secondary">Patient Subject</label>
              <input
                type="text"
                value={patientName}
                onChange={(e) => setPatientName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
              />
            </div>
          </div>

          {/* Legal disclosure text block */}
          <div className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-3">
            <h4 className="font-bold text-xs text-primary">Clinical Disclosures & Acknowledgement</h4>
            <div className="max-h-40 overflow-y-auto space-y-2 pr-1 text-slate-300 leading-normal">
              {jurisdiction === "US-CA" && (
                <p>California State Law mandates disclosure of orthodontic risks: Periodontal Ligament resorption, transient root shortening, potential decalification under orthodontic attachments if oral hygiene is neglected, and muscle soreness during active aligner staging.</p>
              )}
              {jurisdiction === "EU-DE" && (
                <p>Gemäß EU-Medizinprodukteverordnung (MDR 2017/745): Erklärung über Risiken wie temporäre Kieferschmerzen, Wurzelresorption und Entmineralisierung. Der Patient bestätigt den Erhalt dieser Aufklärung.</p>
              )}
              {jurisdiction !== "US-CA" && jurisdiction !== "EU-DE" && (
                <p>Orthodontic treatment carries specific clinical risks including tooth soreness, periodontal bone remodeling limits, transient tooth mobility, and soft tissue irritation. Patient must commit to wear-time compliance (22 hours daily).</p>
              )}
            </div>

            <label className="flex items-start gap-2 pt-2 border-t border-border/50 cursor-pointer">
              <input
                type="checkbox"
                checked={agreedToRisks}
                onChange={(e) => setAgreedToRisks(e.target.checked)}
                className="mt-0.5 accent-teal-500 rounded"
              />
              <span className="font-semibold text-secondary">
                I hereby verify that I have reviewed the clinical risk disclosures and jurisdiction-specific advisories.
              </span>
            </label>
          </div>
        </div>

        {isSigned ? (
          <div className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl p-4 mt-6 flex justify-between items-center">
            <div className="flex gap-2">
              <CheckCircle2 size={16} className="mt-0.5" />
              <div>
                <span className="font-bold block">Document E-Signed and Sealed</span>
                <span className="text-[10px] block mt-0.5">SHA-256 Hash: {signedHash}</span>
              </div>
            </div>
            <button className="p-2 hover:bg-teal-500/20 rounded-lg">
              <Download size={14} />
            </button>
          </div>
        ) : (
          <form onSubmit={handleSignConsent} className="pt-6 border-t border-border mt-6 flex flex-col sm:flex-row gap-3 items-end">
            <div className="flex-1 w-full space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-secondary">Patient or Legal Guardian Signature</label>
              <input
                type="text" required
                placeholder="Type full legal name..."
                value={signName}
                onChange={(e) => setSignName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full sm:w-auto px-4 py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
            >
              <Signature size={14} /> Sign Consent
            </button>
          </form>
        )}
      </div>

      {/* Record retention history list */}
      <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
        <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
          <History size={16} /> Legal Archive (10 Year Retention)
        </h4>

        <div className="space-y-3">
          {records.map((rec) => (
            <div key={rec.id} className="border border-border rounded-xl p-3.5 bg-slate-900/10 space-y-2">
              <div className="flex justify-between items-center font-bold">
                <span className="text-primary">{rec.patientName}</span>
                <span className={`px-2 py-0.5 rounded uppercase text-[8px] font-bold ${
                  rec.status === "signed" 
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {rec.status}
                </span>
              </div>
              <div className="space-y-1 text-slate-400 text-[10px]">
                <p><span className="font-bold text-secondary">Jurisdiction:</span> {rec.jurisdiction}</p>
                <p><span className="font-bold text-secondary">Signed Date:</span> {rec.signedAt}</p>
                <p><span className="font-bold text-secondary">Retention:</span> Active until {rec.retentionUntil}</p>
                <p className="truncate font-mono text-[9px]" title={rec.documentHash}>
                  <Lock size={10} className="inline mr-1" />
                  {rec.documentHash}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
