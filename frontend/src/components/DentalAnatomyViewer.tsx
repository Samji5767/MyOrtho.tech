"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  listSegmentationJobs,
  getSegmentationJob,
  fetchGingivaMeshBuffer,
  fetchToothMeshBuffer,
  type ToothSegment,
} from "@/lib/api/segmentation";
import { listPlans, listStages, type AlignStage } from "@/lib/api/treatmentPlans";
import {
  upsertToothMovement,
  deleteToothMovement,
  type ToothMovementValues,
} from "@/lib/api/toothMovements";
import { MM_TO_SCENE } from "@/lib/meshAnalysis";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Pencil,
} from "lucide-react";

const MAX_CONCURRENT = 4;

const FDI_NAMES: Record<number, string> = {
  11: "Central Incisor", 12: "Lateral Incisor", 13: "Canine",
  14: "1st Premolar", 15: "2nd Premolar", 16: "1st Molar", 17: "2nd Molar", 18: "3rd Molar",
  21: "Central Incisor", 22: "Lateral Incisor", 23: "Canine",
  24: "1st Premolar", 25: "2nd Premolar", 26: "1st Molar", 27: "2nd Molar", 28: "3rd Molar",
  31: "Central Incisor", 32: "Lateral Incisor", 33: "Canine",
  34: "1st Premolar", 35: "2nd Premolar", 36: "1st Molar", 37: "2nd Molar", 38: "3rd Molar",
  41: "Central Incisor", 42: "Lateral Incisor", 43: "Canine",
  44: "1st Premolar", 45: "2nd Premolar", 46: "1st Molar", 47: "2nd Molar", 48: "3rd Molar",
};

function fdiArch(fdi: number): string { return fdi < 30 ? "Upper" : "Lower"; }

function fdiQuadrant(fdi: number): string {
  if (fdi >= 11 && fdi <= 18) return "UR";
  if (fdi >= 21 && fdi <= 28) return "UL";
  if (fdi >= 31 && fdi <= 38) return "LL";
  return "LR";
}

function createSemaphore(limit: number) {
  let running = 0;
  const queue: Array<() => void> = [];
  return {
    async acquire() {
      if (running < limit) { running++; return; }
      await new Promise<void>(res => queue.push(res));
      running++;
    },
    release() { running--; queue.shift()?.(); },
  };
}

type StageMvtMap = Record<string, Record<string, number>>;

/**
 * Read a per-tooth movement record supporting both shapes stored in
 * aligner_stages.movement_data:
 *  - canonical signed components (mesiodistalMm, …) written by the editor
 *  - legacy unsigned directional pairs (mesialMm/distalMm, …) written by the
 *    stage scaffold
 */
function readMovement(m: Record<string, number> | undefined): ToothMovementValues {
  if (!m) {
    return { mesiodistalMm: 0, buccolingualMm: 0, occlusogingivalMm: 0, rotationDeg: 0, tipDeg: 0, torqueDeg: 0 };
  }
  return {
    mesiodistalMm: m.mesiodistalMm ?? ((m.mesialMm ?? 0) - (m.distalMm ?? 0)),
    buccolingualMm: m.buccolingualMm ?? ((m.buccalMm ?? 0) - (m.lingualMm ?? 0)),
    occlusogingivalMm: m.occlusogingivalMm ?? ((m.extrusionMm ?? 0) - (m.intrusionMm ?? 0)),
    rotationDeg: m.rotationDeg ?? 0,
    tipDeg: m.tipDeg ?? 0,
    torqueDeg: m.torqueDeg ?? 0,
  };
}

const DEG = Math.PI / 180;

/**
 * Map anatomical movement components onto scene axes.
 *
 * Arch-frame approximation (same convention as the AI engine's stage builder):
 * scene X ≈ mesiodistal axis, scene Y ≈ occlusal axis, scene Z ≈ buccolingual
 * axis, with quadrant/arch sign flips. A future per-tooth local frame derived
 * from segmentation geometry will replace this mapping.
 */
function toothTransform(
  mvts: StageMvtMap | null,
  fdi: number,
): { position: [number, number, number]; rotation: [number, number, number] } {
  const zero: { position: [number, number, number]; rotation: [number, number, number] } =
    { position: [0, 0, 0], rotation: [0, 0, 0] };
  if (!mvts) return zero;
  const m = mvts[String(fdi)];
  if (!m || typeof m !== "object") return zero;
  const v = readMovement(m);
  const isRight = (fdi >= 11 && fdi <= 18) || (fdi >= 41 && fdi <= 48);
  const mesialSign = isRight ? 1 : -1;
  const isUpper = fdi < 30;
  const dx = v.mesiodistalMm * mesialSign * MM_TO_SCENE;
  const dy = -v.occlusogingivalMm * (isUpper ? 1 : -1) * MM_TO_SCENE;
  const dz = v.buccolingualMm * MM_TO_SCENE;
  const rx = v.torqueDeg * (isUpper ? 1 : -1) * DEG; // torque about mesiodistal axis
  const ry = v.rotationDeg * mesialSign * DEG;       // rotation about long (occlusal) axis
  const rz = v.tipDeg * mesialSign * DEG;            // tip about buccolingual axis
  return { position: [dx, dy, dz], rotation: [rx, ry, rz] };
}

interface ToothMesh {
  fdi: number;
  /** Geometry re-centred on the tooth centroid so rotations pivot correctly. */
  geometry: THREE.BufferGeometry;
  /** Tooth centroid in scene units, relative to the arch centre. */
  centroid: [number, number, number];
}

interface SceneProps {
  teeth: ToothMesh[];
  gingivaGeom: THREE.BufferGeometry | null;
  showGingiva: boolean;
  showTeeth: boolean;
  selectedFdi: number | null;
  stageMvts: StageMvtMap | null;
  onSelect: (fdi: number) => void;
}

function Scene({ teeth, gingivaGeom, showGingiva, showTeeth, selectedFdi, stageMvts, onSelect }: SceneProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} />
      <directionalLight position={[-4, 3, -4]} intensity={0.3} />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={0.3} maxDistance={25} />
      {gingivaGeom && showGingiva && (
        <mesh geometry={gingivaGeom}>
          <meshStandardMaterial color="#e09090" roughness={0.65} side={THREE.DoubleSide} />
        </mesh>
      )}
      {showTeeth && teeth.map(tooth => {
        const t = toothTransform(stageMvts, tooth.fdi);
        return (
          <group
            key={tooth.fdi}
            position={[
              tooth.centroid[0] + t.position[0],
              tooth.centroid[1] + t.position[1],
              tooth.centroid[2] + t.position[2],
            ]}
            rotation={t.rotation}
          >
            <mesh
              geometry={tooth.geometry}
              onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(tooth.fdi); }}
            >
              <meshStandardMaterial
                color={selectedFdi === tooth.fdi ? "#4a9eff" : "#f5efe7"}
                roughness={0.3} metalness={0.04} side={THREE.DoubleSide}
              />
            </mesh>
          </group>
        );
      })}
    </>
  );
}

function ToothInfoCard({ fdi, segment, stageMvts }: {
  fdi: number; segment: ToothSegment | null; stageMvts: StageMvtMap | null;
}) {
  const name = FDI_NAMES[fdi] ?? `FDI ${fdi}`;
  const m = stageMvts?.[String(fdi)] ?? null;
  const mvtEntries = m
    ? Object.entries(m).filter(([, v]) => typeof v === "number" && v !== 0)
    : [];
  const fmt = (v: number) => (v > 0 ? "+" : "") + v.toFixed(2);
  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs">
      <div className="flex items-baseline justify-between mb-1">
        <span className="text-sm font-semibold text-[color:var(--foreground)]">Tooth {fdi}</span>
        <span className="text-[color:var(--muted-foreground)]">{fdiArch(fdi)} · {fdiQuadrant(fdi)}</span>
      </div>
      <p className="text-[color:var(--muted-foreground)] mb-2">{name}</p>
      {segment && (
        <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 tabular-nums">
          <span className="text-[color:var(--muted-foreground)]">Status</span>
          <span className="text-[color:var(--foreground)]">
            {segment.isMissing ? "Missing" : segment.isImpacted ? "Impacted" : "Present"}
          </span>
          {segment.confidence !== null && <>
            <span className="text-[color:var(--muted-foreground)]">Confidence</span>
            <span className="text-[color:var(--foreground)]">{Math.round((segment.confidence ?? 0) * 100)}%</span>
          </>}
          {segment.surfaceAreaMm2 !== null && <>
            <span className="text-[color:var(--muted-foreground)]">Surface area</span>
            <span className="text-[color:var(--foreground)]">{segment.surfaceAreaMm2?.toFixed(1)} mm²</span>
          </>}
          {segment.volumeMm3 !== null && <>
            <span className="text-[color:var(--muted-foreground)]">Volume</span>
            <span className="text-[color:var(--foreground)]">{segment.volumeMm3?.toFixed(1)} mm³</span>
          </>}
        </div>
      )}
      {mvtEntries.length > 0 && (
        <div className="mt-2 border-t border-[color:var(--border)] pt-2">
          <p className="mb-1 text-[10px] font-medium text-[color:var(--muted-foreground)] uppercase tracking-wide">Stage movements</p>
          <div className="grid grid-cols-2 gap-x-6 gap-y-0.5 tabular-nums text-[10px]">
            {mvtEntries.map(([key, val]) => (
              <Fragment key={key}>
                <span className="text-[color:var(--muted-foreground)]">{key.replace(/([A-Z])/g, " $1").replace(/^./, s => s.toUpperCase())}</span>
                <span className={Math.abs(val as number) > 0.5 ? "text-amber-500 font-semibold" : "text-[color:var(--foreground)]"}>
                  {fmt(val as number)}
                </span>
              </Fragment>
            ))}
          </div>
        </div>
      )}
      {!segment && mvtEntries.length === 0 && (
        <p className="text-[color:var(--muted-foreground)]">No segmentation data</p>
      )}
    </div>
  );
}

// ─── Movement editor ──────────────────────────────────────────────────────────

const EDITOR_FIELDS: Array<{
  key: keyof ToothMovementValues;
  label: string;
  unit: "mm" | "°";
  max: number;
  hint: string;
}> = [
  { key: "mesiodistalMm",     label: "Mesiodistal",     unit: "mm", max: 20, hint: "mesial + / distal −" },
  { key: "buccolingualMm",    label: "Buccolingual",    unit: "mm", max: 20, hint: "buccal + / lingual −" },
  { key: "occlusogingivalMm", label: "Occlusogingival", unit: "mm", max: 20, hint: "extrusion + / intrusion −" },
  { key: "rotationDeg",       label: "Rotation",        unit: "°",  max: 90, hint: "about long axis" },
  { key: "tipDeg",            label: "Tip",             unit: "°",  max: 90, hint: "mesial + / distal −" },
  { key: "torqueDeg",         label: "Torque",          unit: "°",  max: 90, hint: "buccal + / lingual −" },
];

function MovementEditor({ fdi, current, locked, onSave, onReset, saving, error }: {
  fdi: number;
  current: ToothMovementValues;
  locked: boolean;
  onSave: (values: ToothMovementValues) => void;
  onReset: () => void;
  saving: boolean;
  error: string | null;
}) {
  const [draft, setDraft] = useState<Record<string, string>>({});

  // Re-seed the draft when the tooth or the persisted values change
  useEffect(() => {
    setDraft(Object.fromEntries(
      EDITOR_FIELDS.map(f => [f.key, current[f.key] === 0 ? "" : String(current[f.key])]),
    ));
  }, [fdi, current]);

  const parsed: ToothMovementValues = {
    mesiodistalMm: 0, buccolingualMm: 0, occlusogingivalMm: 0,
    rotationDeg: 0, tipDeg: 0, torqueDeg: 0,
  };
  let invalid = false;
  for (const f of EDITOR_FIELDS) {
    const raw = (draft[f.key] ?? "").trim();
    if (raw === "") continue;
    const v = Number(raw);
    if (!Number.isFinite(v) || Math.abs(v) > f.max) { invalid = true; continue; }
    parsed[f.key] = v;
  }

  const dirty = EDITOR_FIELDS.some(f => parsed[f.key] !== current[f.key]);

  return (
    <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2.5 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm font-semibold text-[color:var(--foreground)]">
          <Pencil size={12} /> Movement — Tooth {fdi}
        </span>
        {locked && (
          <span className="flex items-center gap-1 text-[10px] text-[color:var(--muted-foreground)]">
            <Lock size={10} /> Plan approved — locked
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 sm:grid-cols-3">
        {EDITOR_FIELDS.map(f => (
          <label key={f.key} className="block">
            <span className="mb-0.5 block text-[10px] text-[color:var(--muted-foreground)]">
              {f.label} ({f.unit}) <span className="opacity-70">· {f.hint}</span>
            </span>
            <input
              type="number"
              step={f.unit === "mm" ? 0.1 : 1}
              min={-f.max}
              max={f.max}
              value={draft[f.key] ?? ""}
              placeholder="0"
              disabled={locked || saving}
              onChange={e => setDraft(d => ({ ...d, [f.key]: e.target.value }))}
              className="w-full rounded-md border border-[color:var(--border)] bg-[color:var(--background)] px-2 py-1 text-xs tabular-nums text-[color:var(--foreground)] focus:outline-none focus:ring-1 focus:ring-[color:var(--primary)] disabled:opacity-50"
            />
          </label>
        ))}
      </div>
      {error && <p className="mt-2 text-[11px] text-rose-500">{error}</p>}
      <div className="mt-2.5 flex items-center gap-2">
        <button
          type="button"
          disabled={locked || saving || invalid || !dirty}
          onClick={() => onSave(parsed)}
          className="rounded-md bg-[color:var(--primary)] px-3 py-1 text-xs font-medium text-[color:var(--primary-foreground)] disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save movement"}
        </button>
        <button
          type="button"
          disabled={locked || saving}
          onClick={onReset}
          className="rounded-md border border-[color:var(--border)] px-3 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-40"
        >
          Reset tooth
        </button>
        <span className="ml-auto text-[10px] text-[color:var(--muted-foreground)]">
          Cumulative at this stage
        </span>
      </div>
    </div>
  );
}

function StageSelector({ stages, activeIdx, onPrev, onNext, simulated }: {
  stages: AlignStage[]; activeIdx: number; onPrev: () => void; onNext: () => void;
  simulated: boolean;
}) {
  if (stages.length === 0) return null;
  const stage = stages[activeIdx];
  return (
    <div className="flex items-center gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-1.5">
      <button type="button" onClick={onPrev} disabled={activeIdx === 0}
        className="rounded-md border border-[color:var(--border)] p-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-30"
        aria-label="Previous stage"><ChevronLeft size={12} /></button>
      <span className="flex-1 text-center text-xs text-[color:var(--foreground)] tabular-nums">
        Stage {stage?.stageNumber ?? "—"} of {stages.length}
      </span>
      <button type="button" onClick={onNext} disabled={activeIdx >= stages.length - 1}
        className="rounded-md border border-[color:var(--border)] p-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)] disabled:opacity-30"
        aria-label="Next stage"><ChevronRight size={12} /></button>
      {simulated && (
        <span className="flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-medium text-amber-600 dark:text-amber-400">
          <AlertTriangle size={10} /> Scaffold preview — not clinical data
        </span>
      )}
      <div className="ml-2 h-1 w-24 overflow-hidden rounded-full bg-[color:var(--border)]">
        <div className="h-full rounded-full bg-[color:var(--primary)] transition-all duration-200"
          style={{ width: `${stages.length > 1 ? (activeIdx / (stages.length - 1)) * 100 : 100}%` }} />
      </div>
    </div>
  );
}

export default function DentalAnatomyViewer({ caseId }: { caseId: string }) {
  const [status, setStatus] = useState<"loading" | "loading-meshes" | "ready" | "no-data" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [teeth, setTeeth] = useState<ToothMesh[]>([]);
  const [segments, setSegments] = useState<ToothSegment[]>([]);
  const [gingivaGeom, setGingivaGeom] = useState<THREE.BufferGeometry | null>(null);
  const [showGingiva, setShowGingiva] = useState(true);
  const [showTeeth, setShowTeeth] = useState(true);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [planId, setPlanId] = useState<string | null>(null);
  const [planApproved, setPlanApproved] = useState(false);
  const [stages, setStages] = useState<AlignStage[]>([]);
  const [stageIdx, setStageIdx] = useState(0);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);

  const activeStage = stages[stageIdx] ?? null;
  const stageMvts: StageMvtMap | null = activeStage
    ? (activeStage.movements as StageMvtMap ?? null)
    : null;
  const stageSimulated =
    (activeStage?.movements as Record<string, unknown> | undefined)?.["_is_simulated"] === true;

  const selectedSegment = selectedFdi !== null
    ? segments.find(s => s.toothNumber === selectedFdi) ?? null
    : null;

  const selectedMovement = useMemo(
    () => readMovement(selectedFdi !== null ? stageMvts?.[String(selectedFdi)] : undefined),
    [selectedFdi, stageMvts],
  );

  useEffect(() => {
    if (!caseId) return;
    const controller = new AbortController();
    const { signal } = controller;

    setTeeth([]);
    setSegments([]);
    setGingivaGeom(null);
    setSelectedFdi(null);
    setPlanId(null);
    setPlanApproved(false);
    setStages([]);
    setStageIdx(0);
    setStatus("loading");
    setErrorMsg(null);

    (async () => {
      try {
        const jobs = await listSegmentationJobs(caseId);
        if (signal.aborted) return;

        const completed = jobs
          .filter(j => j.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (completed.length === 0) { if (!signal.aborted) setStatus("no-data"); return; }

        const jobDetail = await getSegmentationJob(caseId, completed[0].id);
        if (signal.aborted) return;

        const nonMissing = (jobDetail.segments ?? []).filter(s => !s.isMissing);
        if (nonMissing.length === 0) { setStatus("no-data"); return; }

        setSegments(jobDetail.segments ?? []);
        setStatus("loading-meshes");

        const centerOffset = new THREE.Vector3();
        try {
          const buf = await fetchGingivaMeshBuffer(caseId, completed[0].id, signal);
          if (signal.aborted) return;
          if (buf) {
            const geom = new STLLoader().parse(buf);
            geom.computeVertexNormals();
            geom.scale(MM_TO_SCENE, MM_TO_SCENE, MM_TO_SCENE);
            geom.computeBoundingBox();
            geom.boundingBox!.getCenter(centerOffset);
            geom.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
            geometriesRef.current.push(geom);
            if (!signal.aborted) setGingivaGeom(geom);
          }
        } catch { /* Gingiva unavailable */ }

        const sem = createSemaphore(MAX_CONCURRENT);
        await Promise.all(
          nonMissing.map(async seg => {
            await sem.acquire();
            try {
              if (signal.aborted) return;
              const buf = await fetchToothMeshBuffer(caseId, completed[0].id, seg.toothNumber, signal);
              if (signal.aborted || !buf) return;
              const geom = new STLLoader().parse(buf);
              geom.computeVertexNormals();
              geom.scale(MM_TO_SCENE, MM_TO_SCENE, MM_TO_SCENE);
              // Re-centre the geometry on the tooth centroid so stage
              // rotations pivot around the tooth, not the arch origin.
              geom.computeBoundingBox();
              const c = new THREE.Vector3();
              geom.boundingBox!.getCenter(c);
              geom.translate(-c.x, -c.y, -c.z);
              const centroid: [number, number, number] = [
                c.x - centerOffset.x,
                c.y - centerOffset.y,
                c.z - centerOffset.z,
              ];
              if (signal.aborted) { geom.dispose(); return; }
              geometriesRef.current.push(geom);
              setTeeth(prev => [...prev, { fdi: seg.toothNumber, geometry: geom, centroid }]);
            } catch (err) {
              if (err instanceof Error && err.name === "AbortError") return;
            } finally { sem.release(); }
          }),
        );

        if (signal.aborted) return;
        setStatus("ready");

        try {
          const plans = await listPlans(caseId);
          if (signal.aborted || plans.length === 0) return;
          const latest = plans.find(p => !p.doctorApproval) ?? plans[0];
          const loaded = await listStages(caseId, latest.id);
          if (!signal.aborted && loaded.length > 0) {
            setPlanId(latest.id);
            setPlanApproved(latest.doctorApproval);
            setStages(loaded);
            setStageIdx(0);
          }
        } catch { /* Treatment plans unavailable */ }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (!signal.aborted) {
          setErrorMsg(err instanceof Error ? err.message : "Load failed");
          setStatus("error");
        }
      }
    })();

    return () => {
      controller.abort();
      geometriesRef.current.forEach(g => g.dispose());
      geometriesRef.current = [];
    };
  }, [caseId]);

  // Patch one tooth's movement in the locally-held stage list so the 3D scene
  // reflects a save/reset immediately without a refetch.
  function patchLocalStage(fdi: number, values: ToothMovementValues | null) {
    setStages(prev => prev.map((s, i) => {
      if (i !== stageIdx) return s;
      const movements = { ...(s.movements as Record<string, unknown>) };
      if (values === null) delete movements[String(fdi)];
      else movements[String(fdi)] = values;
      return { ...s, movements };
    }));
  }

  async function handleSave(values: ToothMovementValues) {
    if (!planId || !activeStage || selectedFdi === null) return;
    setSaving(true);
    setEditError(null);
    try {
      await upsertToothMovement(caseId, planId, activeStage.id, {
        fdiNumber: selectedFdi,
        ...values,
      });
      patchLocalStage(selectedFdi, values);
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    if (!planId || !activeStage || selectedFdi === null) return;
    setSaving(true);
    setEditError(null);
    try {
      await deleteToothMovement(caseId, planId, activeStage.id, selectedFdi);
      patchLocalStage(selectedFdi, null);
    } catch (err) {
      const notFound = err instanceof Error && /not found/i.test(err.message);
      if (notFound) patchLocalStage(selectedFdi, null);
      else setEditError(err instanceof Error ? err.message : "Reset failed");
    } finally {
      setSaving(false);
    }
  }

  const isLoading = status === "loading"
    || (status === "loading-meshes" && teeth.length === 0 && !gingivaGeom);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">3D Anatomy</span>
          {selectedFdi !== null && (
            <span className="text-xs text-[color:var(--muted-foreground)]">· Tooth {selectedFdi}</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" onClick={() => setShowGingiva(v => !v)}
            className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            {showGingiva ? <Eye size={11} /> : <EyeOff size={11} />} Gingiva
          </button>
          <button type="button" onClick={() => setShowTeeth(v => !v)}
            className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]">
            {showTeeth ? <Eye size={11} /> : <EyeOff size={11} />} Teeth
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-[#0f0f1a]" style={{ height: 480 }}>
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <Loader2 size={28} className="animate-spin text-[color:var(--primary)]" />
          </div>
        )}
        {status === "no-data" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-slate-300">No completed segmentation</p>
              <p className="mt-1 text-xs text-slate-500">Run AI segmentation to populate 3D anatomy.</p>
            </div>
          </div>
        )}
        {status === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <p className="text-sm font-medium text-rose-400">{errorMsg}</p>
          </div>
        )}
        <Canvas camera={{ position: [0, 2, 6], fov: 45, near: 0.01, far: 100 }}
          gl={{ antialias: true }} style={{ background: "#0f0f1a" }}>
          <Scene teeth={teeth} gingivaGeom={gingivaGeom} showGingiva={showGingiva}
            showTeeth={showTeeth} selectedFdi={selectedFdi} stageMvts={stageMvts}
            onSelect={fdi => setSelectedFdi(prev => prev === fdi ? null : fdi)} />
        </Canvas>
      </div>

      {stages.length > 0 && (
        <StageSelector stages={stages} activeIdx={stageIdx}
          onPrev={() => setStageIdx(i => Math.max(0, i - 1))}
          onNext={() => setStageIdx(i => Math.min(stages.length - 1, i + 1))}
          simulated={stageSimulated} />
      )}

      {selectedFdi !== null && planId && activeStage && (
        <MovementEditor
          fdi={selectedFdi}
          current={selectedMovement}
          locked={planApproved}
          onSave={handleSave}
          onReset={handleReset}
          saving={saving}
          error={editError}
        />
      )}

      {selectedFdi !== null && (
        <ToothInfoCard fdi={selectedFdi} segment={selectedSegment} stageMvts={stageMvts} />
      )}
    </div>
  );
}
