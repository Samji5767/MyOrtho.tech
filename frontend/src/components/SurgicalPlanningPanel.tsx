"use client";

import React, { useEffect, useState, useCallback } from "react";
import { Plus, Trash2, AlertTriangle, CheckCircle2, ShieldAlert, Download, RefreshCw } from "lucide-react";
import {
  listImplants, listPlacements, createPlacement, deletePlacement,
  listTadPlans, createTadPlan, deleteTadPlan,
  listGuides, createGuide, markGuideExported,
  Implant, ImplantPlacement, TadPlan, SurgicalGuide,
} from "@/lib/api/surgical";

type Section = "implants" | "tads" | "guides";

const SAFETY_COLOR: Record<string, string> = {
  safe: "text-green-600",
  warning: "text-amber-500",
  collision: "text-red-500",
};

const SAFETY_ICON: Record<string, React.ReactNode> = {
  safe: <CheckCircle2 size={13} />,
  warning: <AlertTriangle size={13} />,
  collision: <ShieldAlert size={13} />,
};

const RISK_COLOR: Record<string, string> = {
  low: "text-green-600",
  moderate: "text-amber-500",
  high: "text-red-500",
};

interface Props { caseId: string }

export default function SurgicalPlanningPanel({ caseId }: Props) {
  const [section, setSection] = useState<Section>("implants");
  const [implants, setImplants] = useState<Implant[]>([]);
  const [placements, setPlacements] = useState<ImplantPlacement[]>([]);
  const [tads, setTads] = useState<TadPlan[]>([]);
  const [guides, setGuides] = useState<SurgicalGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // New placement form
  const [selectedImplantId, setSelectedImplantId] = useState("");
  const [toothNumber, setToothNumber] = useState("16");
  const [pitch, setPitch] = useState(0);
  const [roll, setRoll] = useState(0);
  const [boneDensity, setBoneDensity] = useState<"D1"|"D2"|"D3"|"D4">("D2");

  // New TAD form
  const [tadSite, setTadSite] = useState("upper-buccal-6-7");
  const [tadToothA, setTadToothA] = useState("17");
  const [tadAngle, setTadAngle] = useState(30);
  const [tadDepth, setTadDepth] = useState(6);
  const [tadRisk, setTadRisk] = useState<"low"|"moderate"|"high">("low");
  const [tadPurpose, setTadPurpose] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [impl, plac, tadList, guideList] = await Promise.all([
        listImplants(),
        listPlacements(caseId),
        listTadPlans(caseId),
        listGuides(caseId),
      ]);
      setImplants(impl);
      setPlacements(plac);
      setTads(tadList);
      setGuides(guideList);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Load failed");
    } finally {
      setLoading(false);
    }
  }, [caseId]);

  useEffect(() => { load(); }, [load]);

  const addPlacement = async () => {
    if (!toothNumber.trim()) return;
    await createPlacement(caseId, {
      toothNumber: toothNumber.trim(),
      implantId: selectedImplantId || undefined,
      pitchDeg: pitch,
      rollDeg: roll,
      boneDensity,
    });
    await load();
  };

  const removePlacement = async (id: string) => {
    await deletePlacement(caseId, id);
    setPlacements((p) => p.filter((x) => x.id !== id));
  };

  const addTad = async () => {
    if (!tadSite.trim() || !tadToothA.trim()) return;
    await createTadPlan(caseId, {
      insertionSite: tadSite,
      toothA: tadToothA,
      angulationDeg: tadAngle,
      depthMm: tadDepth,
      rootCollisionRisk: tadRisk,
      purpose: tadPurpose || null,
      toothB: null,
      boneThicknessMm: null,
      safeCorridor: {},
      notes: null,
    });
    await load();
  };

  const removeTad = async (id: string) => {
    await deleteTadPlan(caseId, id);
    setTads((t) => t.filter((x) => x.id !== id));
  };

  const addGuide = async (type: "implant" | "tad") => {
    await createGuide(caseId, { guideType: type, sleeveDiameterMm: 5.0, guideThicknessMm: 2.0, ventHoles: false, offsetMm: 0 });
    await load();
  };

  const exportGuide = async (id: string) => {
    await markGuideExported(caseId, id);
    await load();
  };

  if (loading) return <div className="py-8 text-center text-sm text-muted-foreground">Loading surgical data…</div>;
  if (error) return <div className="py-8 text-center text-sm text-red-500">{error}</div>;

  return (
    <div className="space-y-4">
      {/* Section tabs */}
      <div className="flex gap-1 border-b border-border pb-0">
        {(["implants", "tads", "guides"] as Section[]).map((s) => (
          <button
            key={s}
            onClick={() => setSection(s)}
            className={`px-3 py-1.5 text-xs font-medium rounded-t border-b-2 transition-colors capitalize ${
              section === s ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {s === "implants" ? `Implant Placements (${placements.length})` : s === "tads" ? `TAD Plans (${tads.length})` : `Surgical Guides (${guides.length})`}
          </button>
        ))}
        <button onClick={load} className="ml-auto px-2 py-1 text-muted-foreground hover:text-foreground"><RefreshCw size={13} /></button>
      </div>

      {/* ── Implant Placements ──────────────────────────────────────────── */}
      {section === "implants" && (
        <div className="space-y-4">
          {placements.length === 0 && <p className="text-sm text-muted-foreground">No implant placements yet.</p>}
          {placements.map((p) => (
            <div key={p.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">FDI #{p.toothNumber}</span>
                  <span className={`flex items-center gap-1 text-xs font-medium ${SAFETY_COLOR[p.safetyStatus]}`}>
                    {SAFETY_ICON[p.safetyStatus]} {p.safetyStatus}
                  </span>
                </div>
                {p.implant && (
                  <p className="text-xs text-muted-foreground">{p.implant.manufacturer} — Ø{p.implant.diameterMm}×{p.implant.lengthMm}mm</p>
                )}
                <p className="text-xs text-muted-foreground">
                  Pitch {p.pitchDeg?.toFixed(1) ?? "—"}° · Roll {p.rollDeg?.toFixed(1) ?? "—"}° · Bone {p.boneDensity ?? "—"}
                </p>
              </div>
              <button onClick={() => removePlacement(p.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}

          {/* Add form */}
          <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Implant Placement</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Tooth (FDI)</label>
                <input className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={toothNumber} onChange={(e) => setToothNumber(e.target.value)} placeholder="16" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Bone Density</label>
                <select className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={boneDensity} onChange={(e) => setBoneDensity(e.target.value as "D1"|"D2"|"D3"|"D4")}>
                  {["D1","D2","D3","D4"].map((d) => <option key={d}>{d}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Implant from Library</label>
              <select className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={selectedImplantId} onChange={(e) => setSelectedImplantId(e.target.value)}>
                <option value="">None</option>
                {implants.map((i) => (
                  <option key={i.id} value={i.id}>{i.manufacturer} {i.system} Ø{i.diameterMm}×{i.lengthMm}mm</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Pitch (°) — {pitch}°</label>
                <input type="range" min={-30} max={30} step={0.5} value={pitch} onChange={(e) => setPitch(Number(e.target.value))} className="w-full" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Roll (°) — {roll}°</label>
                <input type="range" min={-30} max={30} step={0.5} value={roll} onChange={(e) => setRoll(Number(e.target.value))} className="w-full" />
              </div>
            </div>
            {(Math.abs(pitch) > 12 || Math.abs(roll) > 12) && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 p-2 rounded">
                <AlertTriangle size={12} /> Angulation exceeds 12° — verify root proximity
              </div>
            )}
            <button onClick={addPlacement} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">
              <Plus size={12} /> Add Placement
            </button>
          </div>
        </div>
      )}

      {/* ── TAD Plans ──────────────────────────────────────────────────── */}
      {section === "tads" && (
        <div className="space-y-4">
          {tads.length === 0 && <p className="text-sm text-muted-foreground">No TAD plans yet.</p>}
          {tads.map((t) => (
            <div key={t.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{t.insertionSite}</span>
                  <span className={`text-xs font-medium ${RISK_COLOR[t.rootCollisionRisk]}`}>
                    {t.rootCollisionRisk} risk
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Root: {t.toothA}{t.toothB ? ` / ${t.toothB}` : ""} · {t.angulationDeg?.toFixed(0) ?? "—"}° · Depth {t.depthMm?.toFixed(1) ?? "—"}mm
                </p>
                {t.purpose && <p className="text-xs text-muted-foreground">{t.purpose}</p>}
              </div>
              <button onClick={() => removeTad(t.id)} className="text-muted-foreground hover:text-red-500"><Trash2 size={13} /></button>
            </div>
          ))}

          <div className="border border-dashed border-border rounded-lg p-4 space-y-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add TAD Plan</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Insertion Site</label>
                <input className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadSite} onChange={(e) => setTadSite(e.target.value)} placeholder="upper-buccal-6-7" />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Root (tooth A)</label>
                <input className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadToothA} onChange={(e) => setTadToothA(e.target.value)} placeholder="17" />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Angle (°)</label>
                <input type="number" className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadAngle} onChange={(e) => setTadAngle(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Depth (mm)</label>
                <input type="number" step={0.5} className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadDepth} onChange={(e) => setTadDepth(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Risk</label>
                <select className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadRisk} onChange={(e) => setTadRisk(e.target.value as "low"|"moderate"|"high")}>
                  <option value="low">Low</option>
                  <option value="moderate">Moderate</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Purpose</label>
              <input className="w-full mt-0.5 px-2 py-1 text-sm border border-border rounded bg-background" value={tadPurpose} onChange={(e) => setTadPurpose(e.target.value)} placeholder="Molar distalization anchor" />
            </div>
            <button onClick={addTad} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">
              <Plus size={12} /> Add TAD Plan
            </button>
          </div>
        </div>
      )}

      {/* ── Surgical Guides ─────────────────────────────────────────────── */}
      {section === "guides" && (
        <div className="space-y-4">
          {guides.length === 0 && <p className="text-sm text-muted-foreground">No surgical guides yet.</p>}
          {guides.map((g) => (
            <div key={g.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
              <div className="flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium capitalize">{g.guideType} guide</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${
                    g.exportStatus === "exported" ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                    : g.exportStatus === "ready" ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    : "bg-muted text-muted-foreground"
                  }`}>{g.exportStatus}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Sleeve Ø{g.sleeveDiameterMm ?? "—"}mm · Thickness {g.guideThicknessMm}mm · Offset {g.offsetMm}mm{g.ventHoles ? " · Vent holes" : ""}
                </p>
              </div>
              {g.exportStatus !== "exported" && (
                <button onClick={() => exportGuide(g.id)} className="flex items-center gap-1 text-xs text-primary hover:underline">
                  <Download size={12} /> Export
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2">
            <button onClick={() => addGuide("implant")} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs rounded hover:bg-primary/90">
              <Plus size={12} /> Implant Guide
            </button>
            <button onClick={() => addGuide("tad")} className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs rounded hover:bg-muted">
              <Plus size={12} /> TAD Guide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
