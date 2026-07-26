"use client";

import { useEffect, useRef, useState } from "react";
import { Canvas, ThreeEvent } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import {
  listSegmentationJobs,
  getSegmentationJob,
  fetchGingivaMeshBuffer,
  fetchToothMeshBuffer,
} from "@/lib/api/segmentation";
import { MM_TO_SCENE } from "@/lib/meshAnalysis";
import { Eye, EyeOff, Loader2 } from "lucide-react";

const MAX_CONCURRENT = 4;

interface ToothMesh {
  fdi: number;
  geometry: THREE.BufferGeometry;
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

interface SceneProps {
  teeth: ToothMesh[];
  gingivaGeom: THREE.BufferGeometry | null;
  showGingiva: boolean;
  showTeeth: boolean;
  selectedFdi: number | null;
  onSelect: (fdi: number) => void;
}

function Scene({ teeth, gingivaGeom, showGingiva, showTeeth, selectedFdi, onSelect }: SceneProps) {
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
        <mesh
          key={tooth.fdi}
          geometry={tooth.geometry}
          onClick={(e: ThreeEvent<MouseEvent>) => { e.stopPropagation(); onSelect(tooth.fdi); }}
        >
          <meshStandardMaterial
            color={selectedFdi === tooth.fdi ? "#4a9eff" : "#f5efe7"}
            roughness={0.3}
            metalness={0.04}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </>
  );
}

export default function DentalAnatomyViewer({ caseId }: { caseId: string }) {
  const [status, setStatus] = useState<"loading" | "loading-meshes" | "ready" | "no-data" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [teeth, setTeeth] = useState<ToothMesh[]>([]);
  const [gingivaGeom, setGingivaGeom] = useState<THREE.BufferGeometry | null>(null);
  const [showGingiva, setShowGingiva] = useState(true);
  const [showTeeth, setShowTeeth] = useState(true);
  const [selectedFdi, setSelectedFdi] = useState<number | null>(null);

  const geometriesRef = useRef<THREE.BufferGeometry[]>([]);

  useEffect(() => {
    if (!caseId) return;

    const controller = new AbortController();
    const { signal } = controller;

    setTeeth([]);
    setGingivaGeom(null);
    setSelectedFdi(null);
    setStatus("loading");
    setErrorMsg(null);

    (async () => {
      try {
        const jobs = await listSegmentationJobs(caseId);
        if (signal.aborted) return;

        const completed = jobs
          .filter(j => j.status === "completed")
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        if (completed.length === 0) {
          if (!signal.aborted) setStatus("no-data");
          return;
        }

        const jobDetail = await getSegmentationJob(caseId, completed[0].id);
        if (signal.aborted) return;

        const nonMissing = (jobDetail.segments ?? []).filter(s => !s.isMissing);
        if (nonMissing.length === 0) {
          setStatus("no-data");
          return;
        }

        setStatus("loading-meshes");

        // Load gingiva first to derive the shared centering offset
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
        } catch {
          // Gingiva unavailable — centering defaults to origin
        }

        // Load tooth meshes with bounded concurrency
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
            } finally {
              sem.release();
            }
          }),
        );

        if (!signal.aborted) setStatus("ready");
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
          <button
            type="button"
            onClick={() => setShowGingiva(v => !v)}
            className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {showGingiva ? <Eye size={11} /> : <EyeOff size={11} />} Gingiva
          </button>
          <button
            type="button"
            onClick={() => setShowTeeth(v => !v)}
            className="flex items-center gap-1 rounded-md border border-[color:var(--border)] px-2 py-1 text-xs text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"
          >
            {showTeeth ? <Eye size={11} /> : <EyeOff size={11} />} Teeth
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-xl bg-[#0f0f1a]" style={{ height: 520 }}>
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

        <Canvas
          camera={{ position: [0, 2, 6], fov: 45, near: 0.01, far: 100 }}
          gl={{ antialias: true }}
          style={{ background: "#0f0f1a" }}
        >
          <Scene
            teeth={teeth}
            gingivaGeom={gingivaGeom}
            showGingiva={showGingiva}
            showTeeth={showTeeth}
            selectedFdi={selectedFdi}
            onSelect={fdi => setSelectedFdi(prev => prev === fdi ? null : fdi)}
          />
        </Canvas>
      </div>
    </div>
  );
}
