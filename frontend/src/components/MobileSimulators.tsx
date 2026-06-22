"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Send,
  Check,
  AlertTriangle,
  Printer,
  Thermometer,
  User,
  Award,
  ShieldAlert,
  Cpu,
  Sparkles,
  MessageSquare,
  Battery,
  Wifi,
  Signal,
  Calendar,
  Lock,
  ChevronRight,
  RefreshCw,
  Sliders,
  DollarSign
} from "lucide-react";

type MobileAppType = "doctor" | "patient" | "lab" | "manufacturing";

export default function MobileSimulators() {
  const [selectedApp, setSelectedApp] = useState<MobileAppType>("doctor");
  const [phoneTime, setPhoneTime] = useState("09:41");

  // Telemetry updates
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setPhoneTime(
        now.getHours().toString().padStart(2, "0") +
          ":" +
          now.getMinutes().toString().padStart(2, "0")
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Premium Header Banner */}
      <div className="bg-gradient-to-r from-teal-900/30 via-slate-900 to-teal-950/20 border border-teal-500/20 rounded-2xl p-6 relative overflow-hidden shadow-lg">
        <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
          <Smartphone size={160} className="text-teal-400 rotate-12" />
        </div>
        <div className="relative z-10 space-y-2">
          <span className="px-3 py-1 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded-full text-xs font-bold uppercase tracking-wider">
            Mobile Ecosystem
          </span>
          <h3 className="font-extrabold text-2xl tracking-tight text-slate-100">
            Interactive Cross-Platform Mobile Simulators
          </h3>
          <p className="text-sm text-slate-400 max-w-2xl leading-relaxed">
            Verify real-time workflows and layouts across Doctor, Patient, Lab, and Manufacturing apps.
            Changes inside these simulated instances sync instantly through our orchestration gateway.
          </p>
        </div>
      </div>

      {/* Clinical Safety Warning Banner */}
      <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex gap-3 text-xs text-amber-300 shadow-sm">
        <ShieldAlert size={20} className="shrink-0 text-amber-400 animate-pulse" />
        <div>
          <span className="font-bold uppercase tracking-wider block mb-1">
            ⚠️ CLINICAL REQUIREMENT FOR PRESCRIPTION DEVICES
          </span>
          MyOrtho AI diagnostics and simulator outputs are clinical decision-support tools only.
          All clear aligner prescriptions, staging coordinates, and manufacturing runs must be
          verified and approved by a licensed orthodontist before patient administration.
        </div>
      </div>

      {/* Simulator Interface Container */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* App Selection Panel */}
        <div className="lg:col-span-4 space-y-4">
          <span className="block text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Select Active Mobile App
          </span>
          <div className="space-y-3">
            {[
              {
                id: "doctor",
                title: "Doctor App",
                desc: "Treatment setup signatures & chat",
                color: "from-teal-500 to-emerald-600",
                icon: <User size={18} />
              },
              {
                id: "patient",
                title: "Patient App",
                desc: "Aligner wear schedules & billing",
                color: "from-indigo-500 to-purple-600",
                icon: <Calendar size={18} />
              },
              {
                id: "lab",
                title: "Lab Technician App",
                desc: "SLA queues & case prioritizations",
                color: "from-amber-500 to-orange-600",
                icon: <Award size={18} />
              },
              {
                id: "manufacturing",
                title: "Manufacturing App",
                desc: "Real-time printer telemetry & resins",
                color: "from-rose-500 to-red-600",
                icon: <Printer size={18} />
              }
            ].map((app) => (
              <button
                key={app.id}
                onClick={() => setSelectedApp(app.id as MobileAppType)}
                className={`w-full text-left p-4 rounded-2xl border transition-all flex items-center justify-between gap-4 ${
                  selectedApp === app.id
                    ? "bg-slate-900 border-teal-500/50 shadow-md translate-x-1"
                    : "bg-card border-border hover:bg-slate-900/40 hover:border-slate-800"
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-xl bg-gradient-to-tr ${app.color} flex items-center justify-center text-white shadow-sm`}
                  >
                    {app.icon}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-200">{app.title}</h4>
                    <p className="text-[11px] text-slate-400 mt-0.5">{app.desc}</p>
                  </div>
                </div>
                <ChevronRight
                  size={16}
                  className={`transition-all ${
                    selectedApp === app.id ? "text-teal-400" : "text-slate-600"
                  }`}
                />
              </button>
            ))}
          </div>
        </div>

        {/* Dynamic Simulator View */}
        <div className="lg:col-span-8 flex justify-center items-center py-4">
          <div className="relative mx-auto w-[360px] h-[720px] rounded-[52px] border-[12px] border-slate-800 bg-slate-950 shadow-2xl ring-1 ring-slate-700/50 flex flex-col overflow-hidden select-none">
            {/* Camera / Dynamic Island notch */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-7 bg-slate-950 rounded-full z-50 flex items-center justify-center">
              <div className="w-3 h-3 rounded-full bg-slate-900 border border-slate-800/80 mr-12" />
              <div className="w-1.5 h-1.5 rounded-full bg-teal-500/80" />
            </div>

            {/* Simulated Status Bar */}
            <div className="h-12 pt-4 px-6 flex justify-between items-center text-xs font-bold text-white z-40 select-none bg-slate-950">
              <span>{phoneTime}</span>
              <div className="flex items-center gap-1.5">
                <Signal size={12} />
                <Wifi size={12} />
                <Battery size={12} />
              </div>
            </div>

            {/* App Screen Content Frame */}
            <div className="flex-1 bg-slate-900 text-white overflow-hidden flex flex-col relative">
              {selectedApp === "doctor" && <SimulatedDoctorApp />}
              {selectedApp === "patient" && <SimulatedPatientApp />}
              {selectedApp === "lab" && <SimulatedLabApp />}
              {selectedApp === "manufacturing" && <SimulatedManufacturingApp />}
            </div>

            {/* Apple Home Indicator Bar */}
            <div className="h-5 bg-slate-900 flex justify-center items-center pb-2 z-40">
              <div className="w-32 h-1 bg-white/40 rounded-full" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 1. DOCTOR APP SIMULATOR
// ----------------------------------------------------
function SimulatedDoctorApp() {
  const [messages, setMessages] = useState([
    { sender: "lab", text: "Dr. Jenkins, FDI 12 tooth segmentation is ready. Please review coordinates." },
    { sender: "doctor", text: "Got it, checking clearances now." }
  ]);
  const [inputValue, setInputValue] = useState("");
  const [isSigned, setIsSigned] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputValue.trim()) return;
    setMessages([...messages, { sender: "doctor", text: inputValue }]);
    setInputValue("");
    // Simulate auto reply
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        { sender: "lab", text: "Understood, updating case STL parameters based on your response." }
      ]);
    }, 1500);
  };

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      {/* Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase font-bold text-teal-400">Orthodontist Mobile</span>
          <h4 className="font-extrabold text-sm text-slate-100">Orthodontist</h4>
        </div>
        <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
      </div>

      {/* Scrollable Workspace */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Active Case Summary Card */}
        <div className="p-3 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-2">
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase font-bold text-slate-400">Active Case</span>
            <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 rounded text-[9px] font-bold">
              Planning
            </span>
          </div>
          <p className="text-xs font-bold text-slate-200">No case loaded (FDI —)</p>
          <div className="w-full bg-slate-800 h-1 rounded-full overflow-hidden">
            <div className="bg-teal-500 h-full w-[45%]" />
          </div>
        </div>

        {/* Digital Prescription Signature Panel */}
        <div className="p-4 bg-slate-900/90 border border-slate-800 rounded-2xl space-y-3">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">
            Digital E-Signature Sign-off
          </span>
          <p className="text-[10px] text-slate-400 leading-normal">
            Approve case staging coordinates and release patient STL file sets to physical printing.
          </p>

          <div className="h-24 bg-slate-950 rounded-xl border border-dashed border-slate-800 flex flex-col justify-center items-center relative overflow-hidden">
            {isSigned ? (
              <div className="text-center space-y-1">
                <Check size={20} className="text-teal-400 mx-auto" />
                <span className="text-[9px] font-bold text-slate-300">Signed: Doctor</span>
                <span className="text-[8px] text-slate-500 font-mono">MD-2026-06-15</span>
              </div>
            ) : (
              <div className="text-center p-2">
                <span className="text-[10px] text-slate-500 block">Digital signature box</span>
                <button
                  onClick={() => setIsSigned(true)}
                  className="mt-2 px-3 py-1 bg-teal-600 hover:bg-teal-500 text-white font-bold text-[10px] rounded-lg transition-all shadow-sm"
                >
                  Authorize & Sign
                </button>
              </div>
            )}
          </div>
          <div className="text-[8px] text-slate-500 text-center flex items-center justify-center gap-1">
            <Lock size={8} /> SECURE CRYPTOGRAPHIC HASH ENCRYPTED
          </div>
        </div>

        {/* Interactive Chat Thread */}
        <div className="space-y-2">
          <span className="text-[9px] uppercase font-bold text-slate-400 block">
            Lab Support Messaging
          </span>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {messages.map((m, idx) => (
              <div
                key={idx}
                className={`max-w-[80%] p-2.5 rounded-2xl text-[10px] leading-relaxed ${
                  m.sender === "doctor"
                    ? "bg-teal-600 text-white ml-auto rounded-tr-none"
                    : "bg-slate-900 text-slate-200 rounded-tl-none border border-slate-800"
                }`}
              >
                {m.text}
              </div>
            ))}
            <div ref={chatBottomRef} />
          </div>
        </div>
      </div>

      {/* Chat input bar */}
      <form onSubmit={handleSend} className="p-3 bg-slate-900 border-t border-slate-800 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Ask Lab Support..."
          className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          className="p-2 bg-teal-600 hover:bg-teal-500 text-white rounded-xl transition-colors shrink-0"
        >
          <Send size={12} />
        </button>
      </form>
    </div>
  );
}

// ----------------------------------------------------
// 2. PATIENT APP SIMULATOR
// ----------------------------------------------------
function SimulatedPatientApp() {
  const [currentDay, setCurrentDay] = useState(6);
  const [totalDays] = useState(14);
  const [emiTerm, setEmiTerm] = useState(12);
  const [emiAmount, setEmiAmount] = useState(199);

  // EMI Calculator
  const handleTermChange = (term: number) => {
    setEmiTerm(term);
    const calculated = Math.round(2390 / term);
    setEmiAmount(calculated);
  };

  const progressPercentage = Math.round((currentDay / totalDays) * 100);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      {/* Patient Header */}
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-indigo-500 flex items-center justify-center text-[10px] font-bold">
            —
          </div>
          <div>
            <h4 className="font-extrabold text-xs text-slate-100">No patient loaded</h4>
            <span className="text-[8px] text-indigo-400 font-semibold uppercase">Patient Profile</span>
          </div>
        </div>
        <span className="px-2 py-0.5 bg-indigo-500/10 text-indigo-400 rounded text-[9px] font-bold">
          Aligner 3 / 18
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Progress Ring View */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400">Wear Progress</span>
            <p className="text-xs font-bold text-slate-200">Day {currentDay} of {totalDays}</p>
            <p className="text-[10px] text-slate-400">Keep aligners in for 22h/day</p>
          </div>
          <div className="relative h-16 w-16 flex items-center justify-center shrink-0">
            <svg className="w-full h-full transform -rotate-90">
              <circle cx="32" cy="32" r="26" stroke="#1e293b" strokeWidth="4" fill="transparent" />
              <circle
                cx="32"
                cy="32"
                r="26"
                stroke="#6366f1"
                strokeWidth="4"
                fill="transparent"
                strokeDasharray="163.36"
                strokeDashoffset={163.36 - (163.36 * progressPercentage) / 100}
                className="transition-all duration-300"
              />
            </svg>
            <span className="absolute text-[10px] font-bold text-slate-200">
              {progressPercentage}%
            </span>
          </div>
        </div>

        {/* Check in interactive switch */}
        <button
          onClick={() => setCurrentDay((prev) => (prev < totalDays ? prev + 1 : 1))}
          className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
        >
          <Check size={14} /> Log Aligner Check-In
        </button>

        {/* EMI Aligner Billing and financing Calculator */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex justify-between items-center border-b border-slate-800 pb-2">
            <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <DollarSign size={10} /> Billing & EMI Financing
            </span>
            <span className="text-[9px] text-slate-500">Plan Total: $2,390</span>
          </div>
          <p className="text-[10px] text-slate-400 leading-relaxed">
            Select financing period to recalculate monthly installments. No interest fees.
          </p>

          <div className="space-y-3">
            <div className="flex justify-between text-[10px] text-slate-200 font-bold">
              <span>Installment Period</span>
              <span>{emiTerm} Months</span>
            </div>
            <input
              type="range"
              min="6"
              max="24"
              step="6"
              value={emiTerm}
              onChange={(e) => handleTermChange(parseInt(e.target.value))}
              className="w-full h-1 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-indigo-500"
            />
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <span className="text-[10px] text-slate-400 font-bold">Monthly Installment</span>
              <span className="text-sm font-extrabold text-indigo-400">${emiAmount} / mo</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 3. LAB APP SIMULATOR
// ----------------------------------------------------
function SimulatedLabApp() {
  const [slaCases, setSlaCases] = useState([
    { id: "c-1", patient: "Marcus Aurelius", sla: "2.5 hrs left", status: "Staging Setup", priority: "high" },
    { id: "c-2", patient: "Clara Oswald", sla: "5.0 hrs left", status: "STL Decimation", priority: "medium" },
    { id: "c-3", patient: "Arthur Dent", sla: "12.0 hrs left", status: "SLA Queueing", priority: "low" }
  ]);

  const togglePriority = (id: string) => {
    setSlaCases(
      slaCases.map((c) => {
        if (c.id === id) {
          const nextPri = c.priority === "high" ? "medium" : c.priority === "medium" ? "low" : "high";
          return { ...c, priority: nextPri };
        }
        return c;
      })
    );
  };

  const getPriorityBadgeColor = (pri: string) => {
    switch (pri) {
      case "high": return "bg-red-500/10 text-red-400 border-red-500/20";
      case "medium": return "bg-amber-500/10 text-amber-400 border-amber-500/20";
      default: return "bg-slate-500/10 text-slate-400 border-slate-500/20";
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase font-bold text-amber-500">Stuttgart Lab</span>
          <h4 className="font-extrabold text-xs text-slate-100">Lab Technician Workspace</h4>
        </div>
        <span className="px-2 py-0.5 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded text-[9px] font-bold">
          SLA Target
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-[9px] uppercase font-bold text-slate-400">Active SLA Queue</span>
          <button
            onClick={() =>
              setSlaCases([...slaCases].sort((a, b) => (a.priority === "high" ? -1 : 1)))
            }
            className="text-[9px] text-amber-400 font-bold hover:underline flex items-center gap-1"
          >
            <RefreshCw size={10} /> Sort by Priority
          </button>
        </div>

        <div className="space-y-2">
          {slaCases.map((c) => (
            <div
              key={c.id}
              className="p-3 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs hover:border-slate-700 transition-colors"
            >
              <div className="space-y-1">
                <p className="font-bold text-slate-200">{c.patient}</p>
                <div className="flex items-center gap-2 text-[9px] text-slate-400">
                  <span className="font-semibold text-slate-500">{c.status}</span>
                  <span>•</span>
                  <span>SLA: {c.sla}</span>
                </div>
              </div>
              <button
                onClick={() => togglePriority(c.id)}
                className={`text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 border rounded-full transition-all ${getPriorityBadgeColor(
                  c.priority
                )}`}
              >
                {c.priority}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// 4. MANUFACTURING APP SIMULATOR
// ----------------------------------------------------
function SimulatedManufacturingApp() {
  const [resinVolume, setResinVolume] = useState(82);
  const [temperature, setTemperature] = useState(36.8);
  const [sparkline, setSparkline] = useState<number[]>([36.5, 36.6, 36.5, 36.7, 36.8, 36.8]);

  useEffect(() => {
    const telemetryInterval = setInterval(() => {
      setTemperature((t) => {
        const delta = (Math.random() - 0.5) * 0.4;
        const nextTemp = Math.max(35, Math.min(39, parseFloat((t + delta).toFixed(2))));
        setSparkline((prev) => [...prev.slice(1), nextTemp]);
        return nextTemp;
      });
      setResinVolume((vol) => (vol > 15 ? vol - 1 : 90));
    }, 3000);
    return () => clearInterval(telemetryInterval);
  }, []);

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-950">
      <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between">
        <div>
          <span className="text-[9px] uppercase font-bold text-rose-400 animate-pulse">SLA Printing Run</span>
          <h4 className="font-extrabold text-xs text-slate-100">Telemetry Monitor</h4>
        </div>
        <span className="px-2 py-0.5 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded text-[9px] font-bold">
          PRINTER 04
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Temperature Gauge */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Thermometer size={10} className="text-rose-400" /> Chamber Temperature
            </span>
            <p className="text-xl font-black text-slate-100">{temperature} °C</p>
            <p className="text-[9px] text-slate-500 font-semibold">Target: 37.0 °C (Optimal resin flow)</p>
          </div>
          {/* Animated SVG Sparkline */}
          <div className="h-10 w-24 shrink-0 bg-slate-950 border border-slate-800 rounded-lg p-1">
            <svg className="w-full h-full" viewBox="0 0 100 40">
              <path
                d={`M ${sparkline
                  .map((t, idx) => `${idx * 20},${40 - (t - 35) * 8}`)
                  .join(" L ")}`}
                fill="none"
                stroke="#f43f5e"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>

        {/* Resin tank progress bar */}
        <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1">
              <Cpu size={10} className="text-rose-400" /> Photopolymer Resin Tank
            </span>
            <span className="text-xs font-bold text-slate-200">{resinVolume}%</span>
          </div>
          <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                resinVolume < 20 ? "bg-red-500 animate-pulse" : "bg-rose-500"
              }`}
              style={{ width: `${resinVolume}%` }}
            />
          </div>
          <div className="flex justify-between text-[8px] text-slate-500 font-semibold uppercase">
            <span>Critical limit: 15%</span>
            <span>Capacity: 500 mL</span>
          </div>
        </div>

        {/* Job detail info */}
        <div className="p-3 bg-slate-900 border border-slate-850 rounded-xl space-y-1.5 text-[10px]">
          <div className="flex justify-between">
            <span className="text-slate-500">Active Job ID</span>
            <span className="font-mono text-slate-300">#JOB-2026-FDI12</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Total Layers</span>
            <span className="text-slate-300">1,420</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-500">Estimated Print Time</span>
            <span className="text-slate-300">42 mins</span>
          </div>
        </div>
      </div>
    </div>
  );
}
