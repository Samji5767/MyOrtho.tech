"use client";

import React, { useState, useRef } from "react";
import { Case, Patient } from "@/types";
import { useCases, usePatients } from "@/hooks/useApi";
import { 
  Search, 
  UserPlus, 
  Calendar, 
  Activity, 
  CheckSquare, 
  Square, 
  PlayCircle, 
  FileCheck,
  ChevronRight,
  User,
  AlertCircle
} from "lucide-react";

interface PatientManagementProps {
  onSelectCase: (caseItem: Case) => void;
  selectedCaseId?: string;
}

export default function PatientManagement({ onSelectCase, selectedCaseId }: PatientManagementProps) {
  const { cases, loading: casesLoading, error: casesError, createCase, updateCaseStatus } = useCases();
  const { patients, loading: patientsLoading, createPatient } = usePatients();

  const [searchTerm, setSearchTerm] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedCaseIds, setSelectedCaseIds] = useState<string[]>([]);
  const [inspectedCaseId, setInspectedCaseId] = useState<string | null>(selectedCaseId || "c1");

  // Context Menu State
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; caseItem: Case } | null>(null);
  const pressTimer = useRef<NodeJS.Timeout | null>(null);

  // New patient form inputs
  const [newFirst, setNewFirst] = useState("");
  const [newLast, setNewLast] = useState("");
  const [newDob, setNewDob] = useState("");
  const [newGender, setNewGender] = useState("Female");
  const [newNotes, setNewNotes] = useState("");

  const filteredCases = cases.filter(c => 
    c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    c.status.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAddPatient = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirst || !newLast || !newDob) return;
    try {
      await createPatient(newFirst, newLast, newDob, newGender, newNotes);
      setShowAddModal(false);
      setNewFirst("");
      setNewLast("");
      setNewDob("");
      setNewNotes("");
    } catch (err) {
      alert("Failed to register patient profile.");
    }
  };

  const getStatusColor = (status: Case["status"]) => {
    switch (status) {
      case "draft": return "bg-slate-500/10 text-slate-500 border-slate-500/20";
      case "segmenting": return "bg-amber-500/10 text-amber-500 border-amber-500/20";
      case "planning": return "bg-blue-500/10 text-blue-500 border-blue-500/20";
      case "pending_approval": return "bg-orange-500/10 text-orange-500 border-orange-500/20";
      case "approved": return "bg-emerald-500/10 text-emerald-500 border-emerald-500/20";
      case "manufacturing": return "bg-purple-500/10 text-purple-500 border-purple-500/20";
      case "completed": return "bg-teal-500/10 text-teal-500 border-teal-500/20";
      default: return "bg-slate-500/10 text-slate-500 border-slate-500/20";
    }
  };

  const toggleSelectCase = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedCaseIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handleBulkAction = async (action: string) => {
    try {
      if (action === "Approve") {
        for (const id of selectedCaseIds) {
          await updateCaseStatus(id, "approved");
        }
      } else if (action === "Print") {
        for (const id of selectedCaseIds) {
          await updateCaseStatus(id, "manufacturing");
        }
      }
      setSelectedCaseIds([]);
    } catch (err) {
      alert("Failed executing bulk status update.");
    }
  };

  const startLongPress = (caseItem: Case, e: React.TouchEvent) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;
    
    pressTimer.current = setTimeout(() => {
      if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
        window.navigator.vibrate(25);
      }
      setContextMenu({
        x: clientX,
        y: clientY,
        caseItem
      });
    }, 600);
  };

  const cancelLongPress = () => {
    if (pressTimer.current) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };

  const handleRightClick = (caseItem: Case, e: React.MouseEvent) => {
    e.preventDefault();
    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
      window.navigator.vibrate(15);
    }
    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      caseItem
    });
  };

  const activeInspectedCase = cases.find(c => c.id === inspectedCaseId) || cases[0];
  const activeInspectedPatient = activeInspectedCase ? patients.find(p => p.id === activeInspectedCase.patientId) : null;

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-full w-full overflow-hidden relative">
      
      {/* Left List Card Container */}
      <div className="flex-1 flex flex-col bg-card border border-border rounded-2xl shadow-md overflow-hidden min-w-0">
        
        {/* Header toolbar */}
        <div className="p-5 border-b border-border flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold tracking-tight">Case Directory</h2>
            <p className="text-xs text-slate-400">Clinical workflow list</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary-hover text-white rounded-xl text-xs font-semibold transition-colors shrink-0 focus-ring"
            aria-label="Add new patient profile"
          >
            <UserPlus size={14} />
            <span>New Case</span>
          </button>
        </div>

        {/* Search */}
        <div className="p-3 border-b border-border bg-slate-50/50 dark:bg-slate-900/10">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Search patient, status..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-card border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-primary focus:border-primary transition-all focus-ring"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {/* Dynamic State List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {casesLoading || patientsLoading ? (
            <div className="space-y-3" aria-label="Loading Patient Cases">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 w-full animate-skeleton rounded-xl border border-border" />
              ))}
            </div>
          ) : casesError ? (
            <div className="text-center py-10 text-rose-500 text-xs flex flex-col items-center justify-center gap-2">
              <AlertCircle size={24} />
              <span>{casesError}</span>
            </div>
          ) : filteredCases.length === 0 ? (
            <div className="text-center py-10 text-slate-400 text-xs">
              No matching orthodontic records found.
            </div>
          ) : (
            filteredCases.map((c) => {
              const pat = patients.find(p => p.id === c.patientId);
              const isSelected = inspectedCaseId === c.id;
              const isChecked = selectedCaseIds.includes(c.id);

              return (
                <div
                  key={c.id}
                  onClick={() => {
                    setInspectedCaseId(c.id);
                    onSelectCase(c);
                  }}
                  onContextMenu={(e) => handleRightClick(c, e)}
                  onTouchStart={(e) => startLongPress(c, e)}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  className={`p-3.5 rounded-xl border transition-spring cursor-pointer relative select-none ${
                    isSelected 
                      ? "bg-primary/5 border-primary shadow-glow" 
                      : "bg-card border-border hover:border-slate-350 dark:hover:border-slate-700"
                  }`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      setInspectedCaseId(c.id);
                      onSelectCase(c);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <button 
                      onClick={(e) => toggleSelectCase(c.id, e)}
                      className="p-0.5 hover:text-primary transition-colors text-slate-400 focus-ring"
                      aria-label={`Select case for bulk action: ${c.patientName}`}
                    >
                      {isChecked ? <CheckSquare className="text-primary" size={15} /> : <Square size={15} />}
                    </button>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-bold text-xs truncate">{c.patientName}</h3>
                        <span className={`text-[9px] uppercase font-black tracking-wider px-2 py-0.5 rounded-full border shrink-0 ${getStatusColor(c.status)}`}>
                          {c.status.replace("_", " ")}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-400 mt-0.5">DOB: {pat?.dob || "N/A"}</p>
                    </div>
                  </div>
                  
                  <div className="mt-2.5 flex items-center justify-between text-[10px] text-slate-400 border-t border-border/50 pt-2">
                    <span className="flex items-center gap-1">
                      <Activity size={10} className="text-primary" />
                      ID: {c.id.slice(0, 8)}...
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar size={10} />
                      Updated: {c.updatedAt}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bulk Action Footer Drawer */}
        {selectedCaseIds.length > 0 && (
          <div className="p-3 bg-slate-900 border-t border-border flex items-center justify-between animate-in slide-in-from-bottom duration-200">
            <span className="text-[10px] font-bold text-slate-300">
              {selectedCaseIds.length} Selected
            </span>
            <div className="flex gap-2">
              <button 
                onClick={() => handleBulkAction("Approve")}
                className="flex items-center gap-1 px-3 py-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-lg text-[10px] font-bold hover:bg-emerald-500/20 focus-ring"
              >
                <FileCheck size={11} /> Approve
              </button>
              <button 
                onClick={() => handleBulkAction("Print")}
                className="flex items-center gap-1 px-3 py-1.5 bg-purple-500/10 text-purple-400 border border-purple-500/20 rounded-lg text-[10px] font-bold hover:bg-purple-500/20 focus-ring"
              >
                <PlayCircle size={11} /> Route Print
              </button>
              <button 
                onClick={() => setSelectedCaseIds([])}
                className="px-2.5 py-1.5 border border-slate-700 text-slate-300 hover:text-white text-[10px] font-semibold rounded-lg hover:bg-slate-800 focus-ring"
              >
                Clear
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Right Split View Patient Details Panel */}
      {activeInspectedCase && (
        <div className="w-full lg:w-80 bg-card border border-border rounded-2xl flex flex-col justify-between shadow-md overflow-hidden shrink-0">
          <div className="p-5 border-b border-border flex items-center gap-2 bg-slate-50/50 dark:bg-slate-900/30">
            <User size={15} className="text-primary" />
            <h3 className="font-bold text-xs">Patient Details Card</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {/* Profile */}
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-1.5">
              <span className="text-[9px] uppercase font-black tracking-widest text-primary block">Clinical Diagnosis Notes</span>
              <h4 className="font-bold text-xs">{activeInspectedCase.patientName}</h4>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                {activeInspectedPatient?.clinicalNotes || "No registered notes for this patient profile."}
              </p>
            </div>

            {/* Micro timelines */}
            <div className="space-y-3">
              <span className="block text-[9px] uppercase font-black tracking-widest text-slate-400">Orthodontic Stages</span>
              
              <div className="space-y-4 relative pl-3.5 border-l border-border ml-2 text-xs">
                <div className="relative">
                  <div className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                  <span className="block font-bold text-foreground">Initial Scan Upload</span>
                  <span className="block text-[9px] text-slate-400">Completed on {activeInspectedCase.createdAt}</span>
                </div>

                <div className="relative">
                  <div className="absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full bg-primary" />
                  <span className="block font-bold text-foreground">AI Separation Segmentation</span>
                  <span className="block text-[9px] text-slate-400">Validated</span>
                </div>

                <div className="relative">
                  <div className={`absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full ${
                    ["planning", "pending_approval", "approved", "manufacturing", "completed"].includes(activeInspectedCase.status) ? "bg-primary" : "bg-slate-700"
                  }`} />
                  <span className="block font-bold text-foreground">Clinician Staging Plans</span>
                  <span className="block text-[9px] text-slate-400">
                    {activeInspectedCase.status === "draft" ? "Pending Setup" : "In Progress"}
                  </span>
                </div>

                <div className="relative">
                  <div className={`absolute -left-[20.5px] top-1.5 w-2 h-2 rounded-full ${
                    ["approved", "manufacturing", "completed"].includes(activeInspectedCase.status) ? "bg-primary" : "bg-slate-700"
                  }`} />
                  <span className="block font-bold text-foreground">FDA Signature Lock</span>
                  <span className="block text-[9px] text-slate-400">
                    {["approved", "manufacturing", "completed"].includes(activeInspectedCase.status) ? "Locked & Signed" : "Awaiting Clinician Action"}
                  </span>
                </div>
              </div>
            </div>
          </div>

          <div className="p-4 border-t border-border bg-slate-50/50 dark:bg-slate-900/30">
            <button 
              onClick={() => onSelectCase(activeInspectedCase)}
              className="w-full py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1 transition-colors focus-ring"
              aria-label="Open clinical planning viewport"
            >
              <span>Launch Planning View</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Modal for adding patient */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/55 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <form onSubmit={handleAddPatient} className="bg-card border border-border w-full max-w-md rounded-2xl shadow-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="p-5 border-b border-border">
              <h3 className="text-base font-bold">New Patient Intake Setup</h3>
              <p className="text-[11px] text-slate-400 mt-1">Register new case and model schedule records</p>
            </div>
            
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">First Name</label>
                  <input
                    type="text" required
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                    value={newFirst} onChange={(e) => setNewFirst(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Last Name</label>
                  <input
                    type="text" required
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                    value={newLast} onChange={(e) => setNewLast(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">DOB</label>
                  <input
                    type="date" required
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                    value={newDob} onChange={(e) => setNewDob(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Gender</label>
                  <select
                    className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                    value={newGender} onChange={(e) => setNewGender(e.target.value)}
                  >
                    <option value="Female">Female</option>
                    <option value="Male">Male</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Clinical Spacing Notes</label>
                <textarea
                  rows={3}
                  className="w-full px-3 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                  value={newNotes} onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="e.g. Incisor crowding, diastema, thin enamel alerts..."
                />
              </div>
            </div>

            <div className="p-4 bg-slate-50 dark:bg-slate-900/30 border-t border-border flex justify-end gap-3.5">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 border border-border text-xs font-semibold rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors focus-ring"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring"
              >
                Create Case
              </button>
            </div>
          </form>
        </div>
      )}

      {/* iOS styled context menu */}
      {contextMenu && (
        <div className="fixed inset-0 z-50 overflow-hidden" onClick={() => setContextMenu(null)}>
          <div 
            className="absolute bg-card/95 border border-border backdrop-blur-md rounded-2xl w-48 shadow-lg p-1.5 ios-context-menu"
            style={{
              top: Math.min(contextMenu.y, typeof window !== "undefined" ? window.innerHeight - 200 : 300),
              left: Math.min(contextMenu.x, typeof window !== "undefined" ? window.innerWidth - 200 : 200),
            }}
          >
            <div className="px-3 py-1.5 border-b border-border/50 text-[10px] text-slate-400 font-bold uppercase truncate">
              {contextMenu.caseItem.patientName}
            </div>
            <button
              onClick={() => {
                onSelectCase(contextMenu.caseItem);
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs font-bold hover:bg-slate-500/10 rounded-lg text-primary"
            >
              Launch Planning
            </button>
            <button
              onClick={async () => {
                try {
                  await updateCaseStatus(contextMenu.caseItem.id, "approved");
                  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate([15, 15]);
                  }
                } catch (e) {
                  alert("Failed to update status.");
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-500/10 rounded-lg text-emerald-500 font-semibold"
            >
              Sign & Approve
            </button>
            <button
              onClick={async () => {
                try {
                  await updateCaseStatus(contextMenu.caseItem.id, "manufacturing");
                  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate([15, 15]);
                  }
                } catch (e) {
                  alert("Failed to route print.");
                }
                setContextMenu(null);
              }}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-500/10 rounded-lg text-purple-500 font-semibold"
            >
              Route Print Job
            </button>
            <button
              onClick={() => setContextMenu(null)}
              className="w-full text-left px-3 py-2 text-xs hover:bg-slate-500/10 rounded-lg text-rose-500 font-semibold border-t border-border/40 mt-1"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
