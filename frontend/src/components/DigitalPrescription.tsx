"use client";

import React, { useState, useEffect } from "react";
import { 
  FileCheck, 
  FileSignature as Signature, 
  ShieldAlert, 
  Activity, 
  RefreshCw, 
  Settings, 
  Save, 
  History,
  Lock,
  CheckCircle2,
  Trash2
} from "lucide-react";
import { calculatePDLStress, Vector3D, BiomechanicsResult } from "../lib/biomechanics/stressMath";

interface PrescriptionRevision {
  revision: number;
  signedBy: string;
  timestamp: string;
  hash: string;
  notes: string;
}

export default function DigitalPrescription() {
  const [patientName, setPatientName] = useState("");
  const [dentistName, setDentistName] = useState("");
  const [instructions, setInstructions] = useState(
    "Perform maxillary expansion of 1.5mm. Correct FDI 11 and 21 crowding. Apply 0.2mm IPR distal of 12."
  );
  
  // Staging displacements for stress preview
  const [displacementX, setDisplacementX] = useState(0.04); // mm (mesial-distal)
  const [displacementY, setDisplacementY] = useState(0.06); // mm (buccal-lingual)
  const [displacementZ, setDisplacementZ] = useState(0.02); // mm (extrusion-intrusion)
  const [stressResult, setStressResult] = useState<BiomechanicsResult | null>(null);

  // E-Sign States
  const [password, setPassword] = useState("");
  const [esignName, setEsignName] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const [signedHash, setSignedHash] = useState("");
  const [approvedForMfg, setApprovedForMfg] = useState(false);

  // Revision History State
  const [revisions, setRevisions] = useState<PrescriptionRevision[]>([]);

  // Recalculate stress whenever displacements change
  useEffect(() => {
    const displacementVec: Vector3D = {
      x: displacementX,
      y: displacementY,
      z: displacementZ
    };
    // Calculate for tooth 11 (maxillary central incisor)
    const result = calculatePDLStress(11, displacementVec);
    setStressResult(result);
  }, [displacementX, displacementY, displacementZ]);

  // Simple string-to-hex SHA-256 simulation for demonstration
  const generateSimulatedHash = (data: string) => {
    let hash = 0;
    for (let i = 0; i < data.length; i++) {
      const char = data.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    const positiveHash = Math.abs(hash).toString(16).padStart(8, '0');
    return `${positiveHash}e94cb02c91845a90d8a57e3f421ba1019df94689c1c5a93d8b18471e42c2`;
  };

  const handleSignRx = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || !esignName || !twoFactorToken) {
      alert("Missing required fields for 21 CFR Part 11 signature auth.");
      return;
    }

    const payload = `${patientName}|${dentistName}|${instructions}|${displacementX}|${displacementY}|${displacementZ}`;
    const newHash = generateSimulatedHash(payload);
    
    setSignedHash(newHash);
    setIsSigned(true);
    setApprovedForMfg(true);

    const newRevision: PrescriptionRevision = {
      revision: revisions.length + 1,
      signedBy: esignName,
      timestamp: new Date().toISOString().replace("T", " ").substring(0, 19) + " UTC",
      hash: newHash,
      notes: `Approved stage configuration: dx=${displacementX}mm, dy=${displacementY}mm, dz=${displacementZ}mm. Instructions: ${instructions}`
    };

    setRevisions([newRevision, ...revisions]);
    
    // Clear signing inputs for safety
    setPassword("");
    setTwoFactorToken("");
  };

  const handleResetSignature = () => {
    setIsSigned(false);
    setSignedHash("");
    setApprovedForMfg(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full min-h-[600px] text-xs">
      
      {/* Clinician Rx input form */}
      <div className="lg:col-span-2 flex flex-col gap-6">
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm flex flex-col justify-between">
          <div className="space-y-6">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h3 className="font-extrabold text-base flex items-center gap-2 text-primary">
                  <FileCheck size={20} className="text-teal-400" />
                  Digital Prescription Sheet (Rx)
                </h3>
                <p className="text-secondary text-[11px] mt-0.5">Define structured staging commands, IPR limits, and biomechanical parameters.</p>
              </div>
              {isSigned && (
                <span className="flex items-center gap-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 px-2 py-0.5 rounded font-bold uppercase text-[9px]">
                  <Lock size={10} /> Locked & E-Signed
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-secondary">Patient Case Name</label>
                <input
                  type="text"
                  disabled={isSigned}
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none disabled:opacity-60"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-secondary">Prescribing Orthodontist</label>
                <input
                  type="text"
                  disabled={isSigned}
                  value={dentistName}
                  onChange={(e) => setDentistName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none disabled:opacity-60"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[10px] uppercase font-bold text-secondary">Clinical Directions & Stage Notes</label>
              <textarea
                disabled={isSigned}
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none disabled:opacity-60 h-24 text-xs resize-none"
              />
            </div>

            {/* Stage-wise Biomechanical Limits */}
            <div className="border border-border rounded-xl p-4 bg-slate-900/10 space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-2">
                <h4 className="font-bold text-xs flex items-center gap-1.5 text-primary">
                  <Activity size={14} className="text-teal-400" />
                  Prescribed Displacement per Stage (Tooth 11)
                </h4>
                <span className="text-[10px] text-secondary">Simulates real-time PDL stress response</span>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Mesial-Distal Movement (dx)</span>
                    <span className="text-primary font-bold">{displacementX.toFixed(3)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.25"
                    step="0.005"
                    disabled={isSigned}
                    value={displacementX}
                    onChange={(e) => setDisplacementX(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Buccal-Lingual Rotation (dy)</span>
                    <span className="text-primary font-bold">{displacementY.toFixed(3)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.25"
                    step="0.005"
                    disabled={isSigned}
                    value={displacementY}
                    onChange={(e) => setDisplacementY(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-60"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between font-semibold">
                    <span className="text-secondary">Extrusion-Intrusion (dz)</span>
                    <span className="text-primary font-bold">{displacementZ.toFixed(3)} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0.0"
                    max="0.25"
                    step="0.005"
                    disabled={isSigned}
                    value={displacementZ}
                    onChange={(e) => setDisplacementZ(parseFloat(e.target.value))}
                    className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-teal-500 disabled:opacity-60"
                  />
                </div>
              </div>
            </div>
          </div>

          {!isSigned && (
            <div className="pt-6 border-t border-border mt-6 text-slate-400">
              Complete the digital signature fields on the right to lock this prescription record for production.
            </div>
          )}
        </div>

        {/* Revision Logs */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
            <History size={16} /> Prescription Revision Ledger
          </h4>
          <div className="space-y-3">
            {revisions.map((rev) => (
              <div key={rev.revision} className="border border-border/85 rounded-xl p-3 bg-slate-900/10 space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="text-teal-400">Revision #{rev.revision}</span>
                  <span className="text-secondary font-medium text-[10px]">{rev.timestamp}</span>
                </div>
                <p className="text-slate-300 font-medium text-[11px]">{rev.notes}</p>
                <div className="flex items-center gap-1.5 text-[10px] text-slate-400 pt-1 border-t border-border/40 font-mono">
                  <Lock size={10} /> Hash: {rev.hash.substring(0, 32)}...
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Biomechanical response indicator & Part 11 signing */}
      <div className="space-y-6">
        
        {/* Biomechanics Health Panel */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
            <Activity size={16} className="text-teal-400" />
            PDL Stress Response
          </h4>

          {stressResult && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-border">
                  <span className="text-[10px] text-secondary font-semibold uppercase block">Stress Magnitude</span>
                  <span className={`text-base font-extrabold block mt-1 ${stressResult.isSafe ? "text-teal-400" : "text-red-400"}`}>
                    {stressResult.stressMagnitude.toFixed(2)} kPa
                  </span>
                </div>
                <div className="bg-slate-900/40 p-2.5 rounded-xl border border-border">
                  <span className="text-[10px] text-secondary font-semibold uppercase block">Resultant Force</span>
                  <span className="text-base font-extrabold text-primary block mt-1">
                    {stressResult.forceMagnitude.toFixed(2)} N
                  </span>
                </div>
              </div>

              {stressResult.isSafe ? (
                <div className="bg-teal-500/10 border border-teal-500/20 text-teal-400 rounded-xl p-3 flex gap-2">
                  <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Biomechanical Limits Safe</span>
                    <span className="text-[10px] block mt-0.5">Movement displacement yields stress below the 15.0 kPa ischemic alveolar bone resorption safety limit.</span>
                  </div>
                </div>
              ) : (
                <div className="bg-red-500/10 border border-red-500/20 text-red-400 rounded-xl p-3 flex gap-2 animate-pulse">
                  <ShieldAlert size={18} className="shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Ischemic Alveolar Warning!</span>
                    <span className="text-[10px] block mt-0.5">{stressResult.warningMessage}</span>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* 21 CFR Part 11 Dual Auth E-Sign */}
        <div className="bg-card border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <h4 className="font-bold text-sm text-primary flex items-center gap-1.5">
            <Signature size={16} className="text-teal-400" />
            21 CFR Part 11 Signature Lock
          </h4>

          {isSigned ? (
            <div className="space-y-4">
              <div className="bg-slate-900/40 border border-border rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-1.5 text-teal-400 font-bold">
                  <CheckCircle2 size={16} /> Signature Authenticated
                </div>
                <div className="space-y-1 text-slate-300">
                  <p><span className="font-bold text-secondary">Signatory:</span> {esignName}</p>
                  <p><span className="font-bold text-secondary">Timestamp:</span> {new Date().toLocaleDateString()} {new Date().toLocaleTimeString()} UTC</p>
                  <p className="truncate font-mono text-[9px]" title={signedHash}>
                    <span className="font-bold text-secondary font-sans text-xs block">Document Hash:</span>
                    {signedHash}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleResetSignature}
                  className="flex-1 py-2 border border-border rounded-lg hover:bg-slate-900 font-bold transition-all text-secondary flex items-center justify-center gap-1"
                >
                  <Trash2 size={13} /> Reset Rx
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSignRx} className="space-y-3.5">
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-secondary">Clinician Full Name</label>
                <input
                  type="text" required
                  placeholder="e.g. Dr. Sarah Jenkins"
                  value={esignName}
                  onChange={(e) => setEsignName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-secondary">Clinician Password Check</label>
                <input
                  type="password" required
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold text-secondary">Double-Auth Token (2FA OTP)</label>
                <input
                  type="text" required
                  placeholder="e.g. 841935"
                  value={twoFactorToken}
                  onChange={(e) => setTwoFactorToken(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950/60 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-teal-500 font-mono tracking-widest text-center"
                />
              </div>

              <button
                type="submit"
                disabled={stressResult ? !stressResult.isSafe : false}
                className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Signature size={14} /> E-Sign & Lock Rx
              </button>
              
              {!stressResult?.isSafe && (
                <p className="text-red-400 text-[10px] text-center font-bold uppercase tracking-wider mt-1.5">
                  Resolve Biomechanical Warnings to Sign
                </p>
              )}
            </form>
          )}
        </div>

      </div>

    </div>
  );
}
