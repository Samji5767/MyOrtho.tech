"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  listSegmentationJobs,
  getSegmentationJob,
  fetchGingivaMeshBuffer,
  fetchToothMeshBuffer,
  type SegmentationJob,
} from "@/lib/api/segmentation";
import { Eye, EyeOff, Loader2, RotateCcw } from "lucide-react";

const MM_TO_SCENE = 0.1;
const MAX_CONCURRENT = 4;

type Arch = "upper" | "lower";
type MeshState = "loading" | "loaded" | "missing" | "error";

interface LoadedTooth {
  fdi: number;
  arch: Arch | null;
  geometry: THREE.BufferGeometry | null;
  state: MeshState;
  confidence: number | null;
  isMissing: boolean;
}

function getArch(fdi: number): Arch {
  return fdi >= 11 && fdi <= 28 ? "upper" : "lower";
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
    release() {
      running--;
      queue.shift()?.();
    },
  };
}

// ─── Scene (inside Canvas) ────────────────────────────────────────────────────

interface SceneProps {
  teeth: (LoadedTooth & { selected: boolean; hovered: boolean })[];
  gingivaGeom: THREE.BufferGeometry | null;
  showGingiva: boolean;
  gingivaOpacity: number;
  showUpper: boolean;
  showLower: boolean;
  onSelect: (fdi: number) => void;
  onHover: (fdi: number | null) => void;
  cameraResetSignal: number;
}

function Scene({
  teeth,
  gingivaGeom,
  showGingiva,
  gingivaOpacity,
  showUpper,
  showLower,
  onSelect,
  onHover,
  cameraResetSignal,
}: SceneProps) {
  const controlsRef = useRef<any>(null); // drei OrbitControls ref — no stable type export

  useEffect(() => {
    if (cameraResetSignal > 0) {
      controlsRef.current?.reset();
    }
  }, [cameraResetSignal]);

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 10, 5]} intensity={1.1} />
      <directionalLight position={[-4, 3, -4]} intensity={0.3} />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={0.3}
        maxDistance={25}
      />

      {gingivaGeom && showGingiva && (
        <mesh geometry={gingivaGeom}>
          <meshStandardMaterial
            color="#e09090"
            roughness={0.65}
            transparent={gingivaOpacity < 1}
            opacity={gingivaOpacity}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {teeth.map(tooth => {
        if (tooth.state !== "loaded" || !tooth.geometry) return null;
        if (tooth.arch === "upper" && !showUpper) return null;
        if (tooth.arch === "lower" && !showLower) return null;

        const base = tooth.arch === "upper" ? "#f5efe7" : "#edf5ed";
        const color = tooth.selected ? "#4a9eff"
          : tooth.hovered ? "#ffd966"
          : base;

        return (
          <mesh
            key={tooth.fdi}
            geometry={tooth.geometry}
            onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(tooth.fdi); }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => { e.stopPropagation(); onHover(tooth.fdi); }}
            onPointerOut={() => onHover(null)}
          >
            <meshStandardMaterial
              color={color}
              roughness={0.3}
              metalness={0.04}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function DentalAnatomyViewer({ caseId }: { caseId: string }) {
  const [phase, setPhase] = useState<
    "idle" | "loading-job" | "loading-meshes" | "ready" | "no-data" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [job, setJob] = useState<SegmentationJob | null>(null);
  const [teeth, setTeeth] = useState<LoadedTooth[]>([]);
  const [gingivaGeom, setGingivaGeom] = useState<THREE.BufferGeometry | null>(null);
  const [loadedCount, setLoadedCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  const [showGingiva, setShowGingiva] = useState(true);
  const [gingivaOpacity, setGingivaOpacity] = useState(0.55);
  const [showUpper, setShowUpper] = useState(true);
  const [showLower, setShowLower] = useState(true);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);
  const [hoveredFdi, setHoveredFdi] = useState<number | null>(null);
  const [cameraResetSignal, setCameraResetSignal] = useState(0);

  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);

  const handleSelect = useCallback((fdi: number) => {
    setSelectedFdi(prev => (prev === fdi ? null : fdi));
  }, []);

  const handleHover = useCallback((fdi: number | null) => {
    setHoveredFdi(fdi);
  }, []);

  useEffect(() => {
    if (!caseId) return;

    const controller = new AbortController();
    const { signal } = controller;
    let alive = true;

    // Dispose geometries from any previous caseId
    geometriesRef.current.forEach(g => g.dispose());
    geometriesRef.current = [];

    setTeeth([]);
    setJob(null);
    setGingivaGeom(null);
    setLoadedCount(0);
    setTotalCount(0);
    setSelectedFdi(null);
    setPhase("loading-job");
    setErrorMsg(null);

    (async () => {
      try {
        // 1. Find latest completed segmentation job
        const jobs = await listSegmentationJobs(caseId);
        if (!alive || signal.aborted) return;

        const completed = jobs
          .filter(j => j.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (completed.length === 0) {
          if (alive) setPhase("no-data");
          return;
        }

        const latestJob = completed[0];

        // 2. Fetch job detail including per-tooth segments
        const jobDetail = await getSegmentationJob(caseId, latestJob.id);
        if (!alive || signal.aborted) return;

        setJob(jobDetail);
        const segments = jobDetail.segments ?? [];

        if (segments.length === 0) {
          if (alive) setPhase("no-data");
          return;
        }

        // 3. Initialise teeth table — all in "loading" state
        setTeeth(
          segments.map(seg => ({
            fdi: seg.toothNumber,
            arch: seg.arch ?? getArch(seg.toothNumber),
            geometry: null,
            state: "loading" as MeshState,
            confidence: seg.confidence,
            isMissing: seg.isMissing,
          })),
        );
        const nonMissing = segments.filter(s => !s.isMissing);
        setTotalCount(nonMissing.length);
        setPhase("loading-meshes");

        // 4. Load gingiva first to derive the shared centering offset
        const centerOffset = new THREE.Vector3();
        try {
          const gingivaBuf = await fetchGingivaMeshBuffer(caseId, latestJob.id, signal);
          if (!alive || signal.aborted) return;

          if (gingivaBuf) {
            const loader = new STLLoader();
            const geom = loader.parse(gingivaBuf);
            geom.computeVertexNormals();
            geom.scale(MM_TO_SCENE, MM_TO_SCENE, MM_TO_SCENE);
            // Compute center before translating so all teeth share the same offset
            geom.computeBoundingBox();
            geom.boundingBox!.getCenter(centerOffset);
            geom.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);
            geometriesRef.current.push(geom);
            if (alive && !signal.aborted) setGingivaGeom(geom);
          }
        } catch (err) {
          if (err instanceof Error && err.name === "AbortError") return;
          // Gingiva unavailable — continue without centering from it
        }

        // 5. Load per-tooth STL meshes with bounded concurrency
        const sem = createSemaphore(MAX_CONCURRENT);

        await Promise.all(
          nonMissing.map(async seg => {
            await sem.acquire();
            try {
              if (!alive || signal.aborted) return;

              let buffer: ArrayBuffer | null = null;
              try {
                buffer = await fetchToothMeshBuffer(caseId, latestJob.id, seg.toothNumber, signal);
              } catch (err) {
                if (err instanceof Error && err.name === "AbortError") return;
                throw err;
              }
              if (!alive || signal.aborted) return;

              if (!buffer) {
                setTeeth(prev =>
                  prev.map(t => t.fdi === seg.toothNumber ? { ...t, state: "missing" as MeshState } : t),
                );
              } else {
                const loader = new STLLoader();
                const geom = loader.parse(buffer);
                geom.computeVertexNormals();
                geom.scale(MM_TO_SCENE, MM_TO_SCENE, MM_TO_SCENE);
                // Apply the same centering offset derived from the gingiva
                geom.translate(-centerOffset.x, -centerOffset.y, -centerOffset.z);

                if (!alive || signal.aborted) { geom.dispose(); return; }

                geometriesRef.current.push(geom);
                setTeeth(prev =>
                  prev.map(t =>
                    t.fdi === seg.toothNumber
                      ? { ...t, state: "loaded" as MeshState, geometry: geom }
                      : t,
                  ),
                );
              }
              setLoadedCount(c => c + 1);
            } catch {
              setTeeth(prev =>
                prev.map(t => t.fdi === seg.toothNumber ? { ...t, state: "error" as MeshState } : t),
              );
              setLoadedCount(c => c + 1);
            } finally {
              sem.release();
            }
          }),
        );

        if (alive && !signal.aborted) setPhase("ready");
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") return;
        if (alive) {
          setErrorMsg(err instanceof Error ? err.message : "Unknown error");
          setPhase("error");
        }
      }
    })();

    return () => {
      alive = false;
      controller.abort();
    };
  }, [caseId]);

  // Dispose all geometries on unmount
  useEffect(() => {
    return () => {
      geometriesRef.current.forEach(g => g.dispose());
    };
  }, []);

  const teethForRender = teeth.map(t => ({
    ...t,
    selected: t.fdi === selectedFdi,
    hovered: t.fdi === hoveredFdi,
  }));

  const loadedTeeth = teeth.filter(t => t.state === "loaded").length;
  const missingTeeth = teeth.filter(t => t.state === "missing").length;
  const errorTeeth = teeth.filter(t => t.state === "error").length;
  const selectedSegment = job?.segments?.find(s => s.toothNumber === selectedFdi);

  const isInitialLoad = phase === "idle" || phase === "loading-job"
    || (phase === "loading-meshes" && loadedCount === 0 && !gingivaGeom);

  return (
    <div className="flex flex-col gap-3">
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[color:var(--foreground)]">3D Dental Anatomy</span>
          {phase === "loading-meshes" && (
            <span className="flex items-center gap-1 text-xs text-[color:var(--muted-foreground)]">
              <Loader2 size={10} className="animate-spin" />
              {loadedCount} / {totalCount} teeth
            </span>
          )}
          {phase === "ready" && (
            <span className="text-xs text-[color:var(--muted-foreground)]">
              {loadedTeeth} loaded
              {missingTeeth > 0 && ` · ${missingTeeth} missing`}
              {errorTeeth > 0 && ` · ${errorTeeth} error`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setShowGingiva(v => !v)}
            className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {showGingiva ? <Eye size={11} /> : <EyeOff size={11} />}
            Gingiva
          </button>
          <button
            type="button"
            onClick={() => setShowUpper(v => !v)}
            className={[
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              showUpper
                ? "border-sky-400/40 bg-sky-500/10 text-sky-600 dark:text-sky-400"
                : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
            ].join(" ")}
          >
            Upper
          </button>
          <button
            type="button"
            onClick={() => setShowLower(v => !v)}
            className={[
              "rounded-md border px-2 py-1 text-xs font-medium transition-colors",
              showLower
                ? "border-emerald-400/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                : "border-[color:var(--border)] text-[color:var(--muted-foreground)]",
            ].join(" ")}
          >
            Lower
          </button>
          <button
            type="button"
            onClick={() => setCameraResetSignal(s => s + 1)}
            title="Reset camera"
            className="rounded-md border border-[color:var(--border)] p-1 text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            <RotateCcw size={12} />
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div className="relative overflow-hidden rounded-xl bg-[#0f0f1a]" style={{ height: 520 }}>
        {isInitialLoad && (
          <div className="absolute inset-0 z-10 flex items-center justify-center">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={28} className="animate-spin text-[color:var(--primary)]" />
              <p className="text-sm text-slate-400">
                {phase === "loading-meshes" ? "Loading gingiva mesh…" : "Loading segmentation data…"}
              </p>
            </div>
          </div>
        )}

        {phase === "no-data" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-slate-300">No completed segmentation</p>
              <p className="mt-1 text-xs text-slate-500">
                Run AI segmentation from the AI Segment tab to populate 3D anatomy.
              </p>
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center">
            <div>
              <p className="text-sm font-medium text-rose-400">Load failed</p>
              <p className="mt-1 text-xs text-slate-500">{errorMsg}</p>
            </div>
          </div>
        )}

        <Canvas
          camera={{ position: [0, 2, 6], fov: 45, near: 0.01, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: "#0f0f1a" }}
        >
          <Scene
            teeth={teethForRender}
            gingivaGeom={gingivaGeom}
            showGingiva={showGingiva}
            gingivaOpacity={gingivaOpacity}
            showUpper={showUpper}
            showLower={showLower}
            onSelect={handleSelect}
            onHover={handleHover}
            cameraResetSignal={cameraResetSignal}
          />
        </Canvas>

        {/* Incremental loading progress */}
        {phase === "loading-meshes" && loadedCount > 0 && (
          <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-black/60 px-2.5 py-1.5 text-xs text-white backdrop-blur-sm">
            {loadedCount} / {totalCount} teeth loaded
          </div>
        )}

        {/* Selected tooth info panel */}
        {selectedFdi !== null && (
          <div className="absolute bottom-3 right-3 z-10 min-w-[130px] rounded-lg bg-black/70 px-3 py-2 text-xs text-white backdrop-blur-sm">
            <div className="font-semibold">FDI {selectedFdi}</div>
            {selectedSegment?.label && (
              <div className="mt-0.5 text-white/70">{selectedSegment.label}</div>
            )}
            {selectedSegment?.confidence != null && (
              <div className="mt-0.5 text-white/60">
                {(selectedSegment.confidence * 100).toFixed(0)}% confidence
              </div>
            )}
            {selectedSegment?.isImpacted && (
              <div className="mt-0.5 text-amber-400">Impacted</div>
            )}
            <div className="mt-1 text-white/40 text-[10px]">Click again to deselect</div>
          </div>
        )}
      </div>

      {/* Gingiva opacity slider */}
      {showGingiva && (
        <div className="flex items-center gap-3 rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] px-3 py-2">
          <label className="shrink-0 text-xs text-[color:var(--muted-foreground)]">
            Gingiva opacity
          </label>
          <input
            type="range"
            min={0.1}
            max={1}
            step={0.05}
            value={gingivaOpacity}
            onChange={e => setGingivaOpacity(parseFloat(e.target.value))}
            className="flex-1"
          />
          <span className="w-8 shrink-0 text-right text-xs tabular-nums text-[color:var(--muted-foreground)]">
            {Math.round(gingivaOpacity * 100)}%
          </span>
        </div>
      )}

      {/* Tooth list — shows after loading */}
      {(phase === "ready" || phase === "loading-meshes") && teeth.length > 0 && (
        <div className="rounded-xl border border-[color:var(--border)] bg-[color:var(--card)] p-3">
          <p className="mb-2 text-xs font-semibold text-[color:var(--muted-foreground)] uppercase tracking-wide">
            Detected Teeth
          </p>
          <div className="flex flex-wrap gap-1">
            {teeth.map(t => {
              const stateColor =
                t.state === "loaded" ? (t.isMissing ? "text-slate-400" : "text-[color:var(--foreground)]")
                : t.state === "missing" ? "text-slate-500"
                : t.state === "error" ? "text-rose-400"
                : "text-slate-600";

              const bgColor =
                t.fdi === selectedFdi
                  ? "bg-sky-500/20 border-sky-400/40"
                  : t.state === "loaded"
                  ? "border-[color:var(--border)] bg-[color:var(--background)]"
                  : "border-[color:var(--border)] bg-transparent opacity-50";

              return (
                <button
                  key={t.fdi}
                  type="button"
                  disabled={t.state !== "loaded"}
                  onClick={() => handleSelect(t.fdi)}
                  className={[
                    "rounded border px-1.5 py-0.5 text-xs tabular-nums transition-colors",
                    bgColor,
                    stateColor,
                  ].join(" ")}
                  title={
                    t.state === "missing" ? `FDI ${t.fdi} — mesh not available`
                    : t.state === "error" ? `FDI ${t.fdi} — load error`
                    : t.state === "loading" ? `FDI ${t.fdi} — loading…`
                    : `FDI ${t.fdi}${t.confidence != null ? ` (${(t.confidence * 100).toFixed(0)}%)` : ""}`
                  }
                >
                  {t.fdi}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
