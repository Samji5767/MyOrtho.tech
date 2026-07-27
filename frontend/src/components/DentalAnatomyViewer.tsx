"use client";

import { Fragment, useEffect, useRef, useState } from "react";
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
import { MM_TO_SCENE } from "@/lib/meshAnalysis";
import { ChevronLeft, ChevronRight, Eye, EyeOff, Loader2 } from "lucide-react";

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

function toothPosition(mvts: StageMvtMap | null, fdi: number): [number, number, number] {
  if (!mvts) return [0, 0, 0];
  const m = mvts[String(fdi)];
  if (!m) return [0, 0, 0];
  const isRight = (fdi >= 11 && fdi <= 18) || (fdi >= 41 && fdi <= 48);
  const mesialSign = isRight ? 1 : -1;
  const isUpper = fdi < 30;
  const dx = ((m.mesialMm ?? 0) - (m.distalMm ?? 0)) * mesialSign * MM_TO_SCENE;
  const dy = -((m.extrusionMm ?? 0) - (m.intrusionMm ?? 0)) * (isUpper ? 1 : -1) * MM_TO_SCENE;
  const dz = ((m.buccalMm ?? 0) - (m.lingualMm ?? 0)) * MM_TO_SCENE;
  return [dx, dy, dz];
}

interface ToothMesh { fdi: number; geometry: THREE.BufferGeometry; }

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
      {showTeeth && teeth.map(tooth => (
        <group key={tooth.fdi} position={toothPosition(stageMvts, tooth.fdi)}>
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
      ))}
    </>
  );
}

function ToothInfoCard({ fdi, segment, stageMvts }: {
  fdi: number; segment: ToothSegment | null; stageMvts: StageMvtMap | null;
}) {
  const name = FDI_NAMES[fdi] ?? `FDI ${fdi}`;
  const m = stageMvts?.[String(fdi)] ?? null;
  const mvtEntries = m
    ? Object.entries(m).filter(([k, v]) => k !== "_is_simulated" && typeof v === "number" && (v as number) !== 0)
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

function StageSelector({ stages, activeIdx, onPrev, onNext }: {
  stages: AlignStage[]; activeIdx: number; onPrev: () => void; onNext: () => void;
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
  const [stages, setStages] = useState<AlignStage[]>([]);
  const [stageIdx, setStageIdx] = useState(0);
  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);

  const stageMvts: StageMvtMap | null = stages.length > 0
    ? (stages[stageIdx]?.movements as StageMvtMap ?? null)
    : null;

  const selectedSegment = selectedFdi !== null
    ? segments.find(s => s.toothNumber === selectedFdi) ?? null
    : null;

  useEffect(() => {
    if (!caseId) return;
    const controller = new AbortController();
    const { signal } = controller;

    setTeeth([]);
    setSegments([]);
    setGingivaGeom(null);
    setSelectedFdi(null);
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
              geom.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
              if (signal.aborted) { geom.dispose(); return; }
              geometriesRef.current.push(geom);
              setTeeth(prev => [...prev, { fdi: seg.toothNumber, geometry: geom }]);
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
          if (!signal.aborted && loaded.length > 0) { setStages(loaded); setStageIdx(0); }
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
          onNext={() => setStageIdx(i => Math.min(stages.length - 1, i + 1))} />
      )}

      {selectedFdi !== null && (
        <ToothInfoCard fdi={selectedFdi} segment={selectedSegment} stageMvts={stageMvts} />
      )}
    </div>
  );
}
