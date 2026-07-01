"use client";

import { useEffect, useMemo, useState } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import * as THREE from "three";
import { AlertTriangle, Loader2, X, Maximize2, ZoomIn } from "lucide-react";

// ABO / Blue Sky Bio standard 6-view layout
// Row 1: Right Buccal | Anterior | Left Buccal
// Row 2: Upper Occlusal | Posterior | Lower Occlusal
const VIEWS = [
  { label: "Right Buccal",   pos: [ 1,  0.15, 0.1] as [number, number, number] },
  { label: "Anterior",       pos: [ 0,  0.15, 1  ] as [number, number, number] },
  { label: "Left Buccal",    pos: [-1,  0.15, 0.1] as [number, number, number] },
  { label: "Upper Occlusal", pos: [ 0,  1,    0.02] as [number, number, number] },
  { label: "Posterior",      pos: [ 0,  0.15,-1  ] as [number, number, number] },
  { label: "Lower Occlusal", pos: [ 0, -1,    0.02] as [number, number, number] },
] as const;

function ViewScene({
  geometry,
  position,
}: {
  geometry: THREE.BufferGeometry;
  position: [number, number, number];
}) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    geometry.computeBoundingBox();
    const box = geometry.boundingBox!;
    const sphere = new THREE.Sphere();
    box.getBoundingSphere(sphere);
    const r = sphere.radius;

    const dir = new THREE.Vector3(...position).normalize();
    camera.position.copy(dir.multiplyScalar(r * 2.8));
    camera.near = Math.max(r / 100, 0.001);
    camera.far = r * 120;
    (camera as THREE.PerspectiveCamera).fov = 40;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    invalidate();
  }, [geometry, position, camera, invalidate]);

  return (
    <>
      <ambientLight intensity={0.55} />
      <directionalLight position={[5, 10, 5]} intensity={0.9} castShadow={false} />
      <directionalLight position={[-4, -4, -3]} intensity={0.2} />
      <mesh geometry={geometry}>
        <meshStandardMaterial
          color="#e8d5b7"
          roughness={0.55}
          metalness={0.05}
          side={THREE.DoubleSide}
        />
      </mesh>
    </>
  );
}

interface Props {
  caseId: string;
  scanId: string;
  filename: string;
  jawType: string;
  onClose: () => void;
}

export default function ScanMultiView({ caseId, scanId, filename, jawType, onClose }: Props) {
  const [buffer, setBuffer] = useState<ArrayBuffer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [focusIdx, setFocusIdx] = useState<number | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    setBuffer(null);

    const ctrl = new AbortController();

    fetch(`/api/cases/${caseId}/scans/${scanId}/file`, { credentials: "include", signal: ctrl.signal })
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status} — scan file unavailable`);
        return r.arrayBuffer();
      })
      .then(setBuffer)
      .catch((e: Error) => { if (e.name !== 'AbortError') setError(e.message); })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [caseId, scanId]);

  // Parse once, clone 6 times — each Canvas gets its own geometry object
  const geometries = useMemo<THREE.BufferGeometry[] | null>(() => {
    if (!buffer) return null;
    try {
      const loader = new STLLoader();
      const base = loader.parse(buffer);
      // Centre at origin so all cameras look at (0,0,0)
      base.computeBoundingBox();
      const centre = new THREE.Vector3();
      base.boundingBox!.getCenter(centre);
      base.translate(-centre.x, -centre.y, -centre.z);
      base.computeVertexNormals();
      return VIEWS.map(() => base.clone());
    } catch {
      return null;
    }
  }, [buffer]);

  // Dispose cloned geometries when buffer changes or component unmounts
  useEffect(() => {
    return () => { geometries?.forEach((g) => g.dispose()); };
  }, [geometries]);

  const activeViews = focusIdx !== null ? [VIEWS[focusIdx]] : VIEWS;
  const activeGeoms = focusIdx !== null ? [geometries?.[focusIdx] ?? null] : geometries;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-3">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20">
            <Maximize2 size={13} className="text-blue-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-white">{filename}</p>
            <p className="text-[11px] text-white/40">
              {jawType} &middot; 6-view orthodontic layout
              {focusIdx !== null && ` · ${VIEWS[focusIdx].label} (focused)`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {focusIdx !== null && (
            <button
              onClick={() => setFocusIdx(null)}
              className="rounded-lg border border-white/10 px-2.5 py-1 text-[11px] text-white/60 hover:text-white"
            >
              All views
            </button>
          )}
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-white/50 hover:bg-white/10 hover:text-white"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Body */}
      {loading ? (
        <div className="flex flex-1 items-center justify-center gap-3">
          <Loader2 size={22} className="animate-spin text-blue-400" />
          <span className="text-sm text-white/50">Loading 3D model…</span>
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2">
          <AlertTriangle size={24} className="text-red-400" />
          <p className="text-sm text-red-400">{error}</p>
          <p className="text-xs text-white/30">The scan file may not be on this server yet.</p>
        </div>
      ) : geometries ? (
        <div
          className={[
            "grid flex-1 gap-px bg-gray-800",
            focusIdx !== null ? "grid-cols-1 grid-rows-1" : "grid-cols-3 grid-rows-2",
          ].join(" ")}
        >
          {activeViews.map((view, i) => {
            const geo = activeGeoms?.[i];
            if (!geo) return null;
            const realIdx = focusIdx !== null ? focusIdx : i;
            return (
              <div key={view.label} className="group relative bg-gray-950">
                {/* Label */}
                <span className="absolute left-2 top-2 z-10 select-none rounded bg-black/50 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                  {view.label}
                </span>
                {/* Focus toggle */}
                {focusIdx === null && (
                  <button
                    onClick={() => setFocusIdx(realIdx)}
                    className="absolute right-2 top-2 z-10 hidden rounded bg-black/50 p-1 text-white/50 hover:text-white group-hover:flex"
                    title="Focus view"
                  >
                    <ZoomIn size={11} />
                  </button>
                )}
                <Canvas
                  camera={{ fov: 40 }}
                  frameloop="demand"
                  gl={{ antialias: true, alpha: false, powerPreference: "high-performance" }}
                  style={{ width: "100%", height: "100%" }}
                >
                  <ViewScene geometry={geo} position={view.pos} />
                </Canvas>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* Footer note */}
      {geometries && (
        <div className="flex items-center gap-2 border-t border-white/5 px-4 py-2 text-[10px] text-white/30">
          <AlertTriangle size={9} className="shrink-0" />
          For clinical reference only — not a diagnostic tool. Review all outputs with a licensed clinician.
        </div>
      )}
    </div>
  );
}
