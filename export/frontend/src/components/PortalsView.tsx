"use client";

import React, { useState } from "react";
import { useAppointments, useCommunications } from "@/hooks/useApi";
import { 
  ShieldCheck, 
  MessageSquare, 
  Calendar, 
  ChevronRight, 
  FileText, 
  Send, 
  User, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  Lock, 
  Plus 
} from "lucide-react";

interface PortalsViewProps {
  caseId?: string;
  patientId?: string;
}

export default function PortalsView({ caseId = "c1", patientId = "p1" }: PortalsViewProps) {
  const { appointments, loading: apptsLoading, bookAppointment } = useAppointments();
  const { 
    comments, 
    supportMessages, 
    consentRecords, 
    loading: commsLoading,
    addComment,
    sendSupport 
  } = useCommunications(caseId, patientId);
  
  const [activePortal, setActivePortal] = useState<"doctor" | "patient">("doctor");
  const [newComment, setNewComment] = useState("");

  // Patient appointments form states
  const [newApptTitle, setNewApptTitle] = useState("Aligner Attachment Fitting");
  const [newApptDate, setNewApptDate] = useState("2026-06-30");
  const [newApptTime, setNewApptTime] = useState("09:00 AM");

  const [supportInput, setSupportInput] = useState("");

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    try {
      await addComment("Clinician", newComment);
      setNewComment("");
    } catch (err) {
      console.error("Failed to add comment:", err);
    }
  };

  const handleScheduleAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newApptDate || !newApptTime) return;
    const dateFormatted = new Date(newApptDate).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric"
    });
    try {
      await bookAppointment(newApptTitle, `${dateFormatted} at ${newApptTime}`, "Dr. Sarah Jenkins Clinic");
      alert(`📅 Visit booked successfully: ${newApptTitle}`);
    } catch (err) {
      alert("Failed to book appointment.");
    }
  };

  const handleSendSupportMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportInput.trim()) return;
    try {
      await sendSupport("patient", supportInput);
      setSupportInput("");
      setTimeout(async () => {
        try {
          await sendSupport("clinic", "Got your message! A care coordinator will verify and respond within 15 minutes.");
        } catch (err) {
          console.error("Failed to send auto support response:", err);
        }
      }, 1500);
    } catch (err) {
      console.error("Failed to send support message:", err);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-md overflow-hidden max-w-7xl mx-auto">
      
      {/* Portal Tab Switcher */}
      <div className="flex border-b border-border bg-slate-50/50 dark:bg-slate-900/10 p-1">
        <button
          onClick={() => setActivePortal("doctor")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-spring focus-ring ${
            activePortal === "doctor"
              ? "bg-card text-primary shadow-sm"
              : "text-slate-400 hover:text-foreground"
          }`}
        >
          Clinician Portal
        </button>
        <button
          onClick={() => setActivePortal("patient")}
          className={`flex-1 py-3 text-xs font-black uppercase tracking-wider rounded-xl transition-spring focus-ring ${
            activePortal === "patient"
              ? "bg-card text-primary shadow-sm"
              : "text-slate-400 hover:text-foreground"
          }`}
        >
          Patient Portal
        </button>
      </div>

      {activePortal === "doctor" ? (
        /* DOCTOR PORTAL */
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-2">
            <div>
              <h3 className="font-bold text-sm">Case Collaboration & Signoff</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Approve staging steps, verify digital signatures and record notes</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full text-[10px] font-bold self-start">
              <ShieldCheck size={12} /> HIPAA Secure
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Signature Card */}
            <div className="lg:col-span-2 space-y-4">
              <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Treatment Plan Validation</h4>
                <p className="text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                  By signing this staging plan, you verify the tooth movements (maximum 0.25mm/stage) and IPR configurations are clinically sound.
                </p>
                <div className="pt-2">
                  <label className="block text-[9px] uppercase font-bold text-slate-400 mb-1">Clinician Digital Signature</label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Type Full Name (e.g. Dr. Sarah Jenkins, DDS)"
                      className="flex-1 px-3 py-2 bg-card border border-border rounded-lg text-xs focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                    />
                    <button className="px-4 py-2 bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-lg transition-colors focus-ring">
                      Sign Plan
                    </button>
                  </div>
                </div>
              </div>

              {/* Case Summary Report */}
              <div className="p-4 bg-card border border-border rounded-xl space-y-3">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400">Clinical Case Summary</h4>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <span className="text-slate-400">Arch Type:</span>
                    <p className="font-bold text-foreground mt-0.5">Dual Arch (Upper & Lower)</p>
                  </div>
                  <div>
                    <span className="text-slate-400">AI Diagnostic Confidence:</span>
                    <p className="font-bold text-primary mt-0.5 flex items-center gap-1">
                      <Sparkles size={11} /> 94% Confidence
                    </p>
                  </div>
                </div>
                <button className="flex items-center gap-1.5 text-xs text-primary font-bold hover:underline">
                  <FileText size={13} />
                  <span>Download Staging Report PDF</span>
                </button>
              </div>
            </div>

            {/* Internal notes Chat */}
            <div className="border border-border rounded-xl p-4 bg-slate-50/20 flex flex-col justify-between h-[300px]">
              <div className="space-y-3 overflow-y-auto flex-1 pr-1">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 border-b border-border pb-2">Internal Case Notes</h4>
                {commsLoading ? (
                  <div className="space-y-2">
                    <div className="h-12 w-full animate-skeleton rounded-lg" />
                    <div className="h-12 w-full animate-skeleton rounded-lg" />
                  </div>
                ) : (
                  comments.map((comment, idx) => (
                    <div key={idx} className="p-2.5 bg-card border border-border rounded-lg text-xs leading-normal">
                      {comment}
                    </div>
                  ))
                )}
              </div>
              <form onSubmit={handleAddComment} className="mt-4 flex gap-1.5">
                <input
                  type="text"
                  placeholder="Type clinic comment..."
                  className="flex-1 px-3 py-1.5 bg-card border border-border rounded-lg text-xs focus:outline-none focus-ring"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                />
                <button type="submit" className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors focus-ring" aria-label="Submit case note">
                  <Send size={11} />
                </button>
              </form>
            </div>
          </div>
        </div>
      ) : (
        /* PATIENT PORTAL */
        <div className="p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-border pb-4 gap-2">
            <div>
              <h3 className="font-bold text-sm">My Smile Journey Dashboard</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">Track aligner progression, upcoming appointments and message support</p>
            </div>
            <span className="flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 text-blue-500 border border-blue-500/20 rounded-full text-[10px] font-bold self-start">
              <User size={12} /> Patient Mode
            </span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Progress status */}
            <div className="p-5 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl flex flex-col justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Current Progress</span>
                <p className="text-2xl font-bold mt-2 tracking-tight">Aligner 4 / 22</p>
                <div className="w-full bg-slate-200 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                  <div className="bg-primary h-full" style={{ width: "18%" }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-2">Wear for 6 more days (22 hours/day required)</p>
              </div>
              
              <div className="pt-4 border-t border-border/50 mt-4 text-xs space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Treatment Stage:</span>
                  <span className="font-semibold text-foreground">Maxillary alignment</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Estimated Finish:</span>
                  <span className="font-semibold text-primary">Nov 2026</span>
                </div>
              </div>
            </div>

            {/* Appointments booking */}
            <div className="p-5 bg-card border border-border rounded-xl space-y-4 shadow-sm">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-border pb-2">
                <Calendar size={13} className="text-primary" />
                <span>Appointments Schedule</span>
              </h4>
              
              <div className="space-y-3.5 max-h-36 overflow-y-auto pr-1">
                {apptsLoading ? (
                  <div className="h-10 w-full animate-skeleton rounded-lg" />
                ) : (
                  appointments.map((appt, idx) => (
                    <div key={idx} className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-1">
                      <p className="text-xs font-bold text-foreground">{appt.title}</p>
                      <p className="text-[10px] text-slate-400">{appt.dateTime}</p>
                      <p className="text-[9px] text-primary font-bold uppercase tracking-wider">{appt.doctor}</p>
                    </div>
                  ))
                )}
              </div>

              {/* Schedule form */}
              <form onSubmit={handleScheduleAppointment} className="space-y-3 pt-3 border-t border-border/50 text-xs">
                <span className="block text-[9px] uppercase font-bold text-slate-400">Schedule New Appointment</span>
                <div>
                  <select
                    value={newApptTitle}
                    onChange={(e) => setNewApptTitle(e.target.value)}
                    className="w-full px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus-ring font-semibold"
                  >
                    <option value="Aligner Attachment Fitting">Aligner Attachment Fitting</option>
                    <option value="IPR Clearance Reduction">IPR Clearance Reduction</option>
                    <option value="Final Retainer Impression">Final Retainer Impression</option>
                  </select>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={newApptDate}
                    onChange={(e) => setNewApptDate(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus-ring"
                  />
                  <select
                    value={newApptTime}
                    onChange={(e) => setNewApptTime(e.target.value)}
                    className="px-2 py-1.5 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none focus:ring-1 focus:ring-primary focus-ring font-semibold"
                  >
                    <option value="09:00 AM">09:00 AM</option>
                    <option value="11:30 AM">11:30 AM</option>
                    <option value="02:00 PM">02:00 PM</option>
                    <option value="04:30 PM">04:30 PM</option>
                  </select>
                </div>
                <button type="submit" className="w-full py-2 bg-primary hover:bg-primary-hover text-white font-bold text-[10px] rounded-lg transition-colors flex items-center justify-center gap-1 focus-ring">
                  <Plus size={11} />
                  <span>Book Appointment</span>
                </button>
              </form>
            </div>

            {/* Support Messaging Chat */}
            <div className="p-5 bg-card border border-border rounded-xl flex flex-col justify-between h-[300px] shadow-sm">
              <div className="space-y-2 text-xs flex-1 flex flex-col">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-border pb-2 mb-2">
                  <MessageSquare size={13} className="text-primary" />
                  <span>Clinic Messaging Channel</span>
                </h4>
                <div className="flex-1 overflow-y-auto space-y-2.5 pr-1 max-h-36">
                  {commsLoading ? (
                    <div className="space-y-2">
                      <div className="h-12 w-full animate-skeleton rounded-lg" />
                      <div className="h-12 w-full animate-skeleton rounded-lg" />
                    </div>
                  ) : (
                    supportMessages.map((m, idx) => (
                      <div key={idx} className={`p-2.5 rounded-lg text-[11px] leading-relaxed ${
                        m.sender === "patient" ? "bg-primary/10 border border-primary/20 text-right ml-6" : "bg-slate-50 dark:bg-slate-900/40 border border-border mr-6"
                      }`}>
                        <p className="font-bold text-[9px] text-primary">{m.sender === "patient" ? "You" : "Care Coordinator"}</p>
                        <p className="text-foreground mt-0.5">{m.text}</p>
                      </div>
                    ))
                  )}
                </div>
              </div>
              <form onSubmit={handleSendSupportMessage} className="flex gap-1.5 pt-2">
                <input
                  type="text"
                  placeholder="Ask care coordinator..."
                  value={supportInput}
                  onChange={(e) => setSupportInput(e.target.value)}
                  className="flex-1 px-3 py-1.5 bg-slate-50 dark:bg-slate-900/60 border border-border rounded-lg text-xs focus:outline-none focus-ring"
                />
                <button type="submit" className="p-2 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors focus-ring" aria-label="Send support query">
                  <Send size={11} />
                </button>
              </form>
            </div>
          </div>

          {/* Signed Consents Logs */}
          <div className="bg-card border border-border rounded-xl p-5 space-y-3.5 m-5 mt-0 shadow-sm">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5 border-b border-border pb-2">
              <Lock size={13} className="text-primary" />
              <span>Signed Consents & Disclosures (21 CFR Part 11 Audit Trail)</span>
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              {commsLoading ? (
                <>
                  <div className="h-14 w-full animate-skeleton rounded-xl" />
                  <div className="h-14 w-full animate-skeleton rounded-xl" />
                </>
              ) : (
                consentRecords.map((rec, idx) => (
                  <div key={idx} className="p-3 border border-border rounded-xl flex items-center justify-between hover:border-slate-350 dark:hover:border-slate-800 transition-spring bg-slate-50/15">
                    <div className="space-y-1">
                      <p className="font-bold text-foreground">{rec.name}</p>
                      <div className="flex gap-3 text-[9px] text-slate-400">
                        <span className="flex items-center gap-0.5"><Clock size={10} /> Signed: {rec.signedAt}</span>
                        <span className="font-mono text-slate-500">{rec.hash}</span>
                      </div>
                    </div>
                    <span className="flex items-center gap-1 px-2.5 py-0.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded font-black uppercase text-[8px] shrink-0 select-none">
                      <CheckCircle2 size={10} /> {rec.status}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
