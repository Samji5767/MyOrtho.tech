"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";
import { Camera, Download, Expand, Eye, FlipHorizontal2, Maximize2, RotateCcw, Ruler, Scissors, UploadCloud } from "lucide-react";
import { Button, Card, DataRow, ProgressBar, StatusBadge } from "@/components/DesignSystem";

type ViewPreset = "occlusal" | "side" | "front" | "top" | "bottom";

type ModelStats = {
  fileName: string;
  triangles: number;
  vertices: number;
  width: number;
  height: number;
  depth: number;
};

type MeasureType = "distance" | "angle" | "overjet" | "overbite";

type MeasurementRecord = {
  id: string;
  name: string;
  type: MeasureType;
  points: THREE.Vector3[];
  distance: number;
  angleDeg?: number;
  createdAt: string;
};

function computeAngleDeg(a: THREE.Vector3, vertex: THREE.Vector3, b: THREE.Vector3): number {
  const va = a.clone().sub(vertex).normalize();
  const vb = b.clone().sub(vertex).normalize();
  return THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, va.dot(vb)))));
}

export interface Viewer3DProps {
  file?: File | null;
  preset?: ViewPreset;
  clipping?: boolean;
  measurementMode?: boolean;
  measurementPoints?: THREE.Vector3[];
  onMeasurementPointsChange?: (points: THREE.Vector3[]) => void;
  onHoverPointChange?: (point: THREE.Vector3 | null) => void;
  onStatsChange?: (stats: ModelStats) => void;
  onPresetChange?: (preset: ViewPreset) => void;
  onClippingChange?: (enabled: boolean) => void;
  onMeasurementModeChange?: (enabled: boolean) => void;
}

const viewPresets: Record<ViewPreset, [number, number, number]> = {
  occlusal: [0, 8, 0.1],
  side: [8, 1.5, 0],
  front: [0, 1.5, 8],
  top: [0, 10, 0.1],
  bottom: [0, -10, 0.1]
};

function createDemoArchGeometry() {
  const geometries: THREE.BufferGeometry[] = [];
  const toothShape = new THREE.SphereGeometry(0.42, 24, 16);

  for (let arch = 0; arch < 2; arch += 1) {
    const y = arch === 0 ? 0.58 : -0.58;
    const zBend = arch === 0 ? -0.1 : 0.1;
    for (let i = 0; i < 14; i += 1) {
      const t = (i - 6.5) / 6.5;
      const tooth = toothShape.clone();
      const matrix = new THREE.Matrix4();
      const x = t * 4.4;
      const z = zBend + Math.abs(t) * 1.35;
      const scale = 0.78 + Math.abs(t) * 0.30;
      matrix.compose(
        new THREE.Vector3(x, y, z),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, -t * 0.45, 0)),
        new THREE.Vector3(scale * 0.86, 0.42, scale)
      );
      tooth.applyMatrix4(matrix);
      geometries.push(tooth);
    }
  }

  const merged = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  geometries.forEach(geometry => {
    const pos = geometry.getAttribute("position");
    const normal = geometry.getAttribute("normal");
    for (let i = 0; i < pos.count; i += 1) {
      positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      normals.push(normal.getX(i), normal.getY(i), normal.getZ(i));
    }
    geometry.dispose();
  });
  merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
  merged.computeBoundingBox();
  merged.computeBoundingSphere();
  return merged;
}

function centerGeometry(geometry: THREE.BufferGeometry) {
  const centered = geometry.clone();
  centered.computeBoundingBox();
  const box = centered.boundingBox;
  if (box) {
    const center = new THREE.Vector3();
    box.getCenter(center);
    centered.translate(-center.x, -center.y, -center.z);
  }
  centered.computeVertexNormals();
  centered.computeBoundingBox();
  centered.computeBoundingSphere();
  return centered;
}

function getStats(geometry: THREE.BufferGeometry, fileName: string): ModelStats {
  geometry.computeBoundingBox();
  const position = geometry.getAttribute("position");
  const size = new THREE.Vector3();
  geometry.boundingBox?.getSize(size);
  return {
    fileName,
    triangles: Math.floor(position.count / 3),
    vertices: position.count,
    width: size.x,
    height: size.y,
    depth: size.z
  };
}

function CameraFrame({ geometry, preset, resetSignal }: { geometry: THREE.BufferGeometry; preset: ViewPreset; resetSignal: number }) {
  const { camera, controls } = useThree();

  useEffect(() => {
    const sphere = geometry.boundingSphere ?? new THREE.Sphere(new THREE.Vector3(), 4);
    const radius = Math.max(sphere.radius, 1);
    const direction = new THREE.Vector3(...viewPresets[preset]).normalize();
    camera.position.copy(direction.multiplyScalar(radius * 2.8));
    camera.near = Math.max(radius / 100, 0.01);
    camera.far = radius * 120;
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void };
    orbit.target?.set(0, 0, 0);
    orbit.update?.();
  }, [camera, controls, geometry, preset, resetSignal]);

  return null;
}

function LineSeg({ from, to }: { from: THREE.Vector3; to: THREE.Vector3 }) {
  const mid = from.clone().add(to).multiplyScalar(0.5);
  const dir = to.clone().sub(from);
  const len = dir.length();
  if (len < 0.0001) return null;
  const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return (
    <mesh position={mid} quaternion={quat}>
      <cylinderGeometry args={[0.018, 0.018, len, 12]} />
      <meshBasicMaterial color="#2dd4bf" />
    </mesh>
  );
}

const ANGLE_POINT_LABELS = ["A", "Vertex", "B"];

function MeasurementOverlay({
  points,
  hoverPoint,
  measureType,
}: {
  points: THREE.Vector3[];
  hoverPoint: THREE.Vector3 | null;
  measureType: MeasureType;
}) {
  const isAngle = measureType === "angle";
  const pointsNeeded = isAngle ? 3 : 2;
  const previewStart = points.length > 0 && points.length < pointsNeeded ? points[points.length - 1] : null;
  const previewEnd = previewStart ? hoverPoint : null;

  return (
    <>
      {/* Completed segments */}
      {!isAngle && points.length === 2 && <LineSeg from={points[0]} to={points[1]} />}
      {isAngle && points.length >= 2 && <LineSeg from={points[0]} to={points[1]} />}
      {isAngle && points.length === 3 && <LineSeg from={points[1]} to={points[2]} />}

      {/* Placed point markers */}
      {points.map((point, index) => (
        <group key={index}>
          <mesh position={point}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#2dd4bf" />
          </mesh>
          <Html position={point.clone().add(new THREE.Vector3(0.04, 0.04, 0.04))} center>
            <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">
              {isAngle ? (ANGLE_POINT_LABELS[index] ?? String.fromCharCode(65 + index)) : String.fromCharCode(65 + index)}
            </span>
          </Html>
        </group>
      ))}

      {/* Hover preview */}
      {previewStart && previewEnd && (
        <group>
          <LineSeg from={previewStart} to={previewEnd} />
          <mesh position={previewEnd}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.75} />
          </mesh>
          <Html position={previewEnd.clone().add(new THREE.Vector3(0.04, 0.04, 0.04))} center>
            <span className="rounded-md border border-amber-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-amber-100 shadow-lg">
              {isAngle ? ANGLE_POINT_LABELS[points.length] ?? "Next" : "Next"}
            </span>
          </Html>
        </group>
      )}

      {/* Distance label */}
      {!isAngle && points.length === 2 && (() => {
        const mid = points[0].clone().add(points[1]).multiplyScalar(0.5);
        const displayVal = measureType === "overjet"
          ? Math.abs(points[0].x - points[1].x)
          : measureType === "overbite"
          ? Math.abs(points[0].y - points[1].y)
          : points[0].distanceTo(points[1]);
        const suffix = measureType === "overjet" ? " ↔" : measureType === "overbite" ? " ↕" : "";
        return (
          <Html position={mid} center>
            <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">
              {displayVal.toFixed(2)} mm{suffix}
            </span>
          </Html>
        );
      })()}

      {/* Angle label */}
      {isAngle && points.length === 3 && (() => {
        const deg = computeAngleDeg(points[0], points[1], points[2]);
        const labelPos = points[1].clone().add(new THREE.Vector3(0, 0.18, 0));
        return (
          <Html position={labelPos} center>
            <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">
              {deg.toFixed(1)}°
            </span>
          </Html>
        );
      })()}
    </>
  );
}

function DentalModel({
  geometry,
  clipping,
  measurementMode,
  onPick,
  onHover,
}: {
  geometry: THREE.BufferGeometry;
  clipping: boolean;
  measurementMode: boolean;
  onPick: (point: THREE.Vector3) => void;
  onHover: (point: THREE.Vector3 | null) => void;
}) {
  const clippingPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onPointerMove={(event: ThreeEvent<PointerEvent>) => {
        if (!measurementMode) return;
        event.stopPropagation();
        onHover(event.point.clone());
      }}
      onPointerOut={() => onHover(null)}
      onPointerDown={(event: ThreeEvent<PointerEvent>) => {
        if (!measurementMode) return;
        event.stopPropagation();
        onPick(event.point.clone());
      }}
    >
      <meshPhysicalMaterial
        color="#f8fafc"
        roughness={0.38}
        metalness={0.02}
        clearcoat={0.35}
        clearcoatRoughness={0.4}
        transmission={0.04}
        thickness={0.22}
        clippingPlanes={clipping ? [clippingPlane] : []}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function Scene({ geometry, preset, resetSignal, clipping, measurementMode, measureType, measurePoints, setMeasurePoints, hoverPoint, setHoverPoint, onMeasurementComplete }: {
  geometry: THREE.BufferGeometry;
  preset: ViewPreset;
  resetSignal: number;
  clipping: boolean;
  measurementMode: boolean;
  measureType: MeasureType;
  measurePoints: THREE.Vector3[];
  setMeasurePoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
  hoverPoint: THREE.Vector3 | null;
  setHoverPoint: React.Dispatch<React.SetStateAction<THREE.Vector3 | null>>;
  onMeasurementComplete: (points: THREE.Vector3[], type: MeasureType) => void;
}) {
  const pointsNeeded = measureType === "angle" ? 3 : 2;

  return (
    <>
      <PerspectiveCamera makeDefault fov={35} position={[0, 7, 7]} />
      <CameraFrame geometry={geometry} preset={preset} resetSignal={resetSignal} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 6]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} />
      <DentalModel
        geometry={geometry}
        clipping={clipping}
        measurementMode={measurementMode}
        onPick={(point) =>
          setMeasurePoints((prev) => {
            const next = prev.length >= pointsNeeded ? [point] : [...prev, point];
            if (next.length === pointsNeeded) {
              onMeasurementComplete(next, measureType);
            }
            return next;
          })
        }
        onHover={setHoverPoint}
      />
      <MeasurementOverlay points={measurePoints} hoverPoint={hoverPoint} measureType={measureType} />
      <ContactShadows opacity={0.34} scale={10} blur={2.4} far={4} position={[0, -1.25, 0]} />
      <OrbitControls
        makeDefault
        enabled={!measurementMode}
        enableDamping
        dampingFactor={0.08}
        enablePan
        enableZoom
        enableRotate
        screenSpacePanning={false}
        minDistance={1.5}
        maxDistance={80}
        minPolarAngle={0.3}
        maxPolarAngle={Math.PI - 0.3}
      />
      <gridHelper args={[12, 24, "#486072", "#253342"]} position={[0, -1.24, 0]} />
    </>
  );
}

export default function Viewer3D() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry>(() => centerGeometry(createDemoArchGeometry()));
  const [stats, setStats] = useState<ModelStats>(() => getStats(centerGeometry(createDemoArchGeometry()), "Clinical demo arch"));
  const [preset, setPreset] = useState<ViewPreset>("occlusal");
  const [clipping, setClipping] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [measureType, setMeasureType] = useState<MeasureType>("distance");
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementRecord[]>([]);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [viewerNode, setViewerNode] = useState<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const addMeasurement = (points: THREE.Vector3[], type: MeasureType) => {
    let distance = 0;
    let angleDeg: number | undefined;
    if (type === "angle" && points.length === 3) {
      angleDeg = computeAngleDeg(points[0], points[1], points[2]);
    } else if (type === "overjet" && points.length === 2) {
      distance = Math.abs(points[0].x - points[1].x);
    } else if (type === "overbite" && points.length === 2) {
      distance = Math.abs(points[0].y - points[1].y);
    } else if (points.length >= 2) {
      distance = points[0].distanceTo(points[1]);
    }
    const label = type === "distance" ? "Distance" : type === "angle" ? "Angle" : type === "overjet" ? "Overjet" : "Overbite";
    setMeasurementHistory((previous) => [
      {
        id: `${Date.now()}-${previous.length}`,
        name: `${label} ${previous.length + 1}`,
        type,
        points,
        distance,
        angleDeg,
        createdAt: new Date().toLocaleTimeString([], { hour12: false }),
      },
      ...previous,
    ]);
  };

  const renameMeasurement = (id: string) => {
    const nextName = window.prompt("Rename measurement");
    if (!nextName) return;
    setMeasurementHistory((previous) => previous.map((entry) => (entry.id === id ? { ...entry, name: nextName } : entry)));
  };

  const deleteMeasurement = (id: string) => {
    setMeasurementHistory((previous) => previous.filter((entry) => entry.id !== id));
  };

  const clearMeasurementHistory = () => {
    setMeasurementHistory([]);
    setMeasurePoints([]);
    setHoverPoint(null);
  };

  const exportMeasurementSummary = () => {
    if (measurementHistory.length === 0) return;
    const rows = measurementHistory.map((entry) => {
      const val = entry.type === "angle"
        ? `${entry.angleDeg?.toFixed(1) ?? "0"}°`
        : `${entry.distance.toFixed(2)} mm`;
      return `${entry.createdAt},${entry.name},${entry.type},${val}`;
    }).join("\n");
    const blob = new Blob([`time,name,type,value\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "myortho-measurement-summary.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const loadStl = async (file: File) => {
    setLoadingProgress(10);
    const buffer = await file.arrayBuffer();
    setLoadingProgress(55);
    const loader = new STLLoader();
    const parsed = loader.parse(buffer);
    const centered = centerGeometry(parsed);
    setLoadingProgress(80);
    setGeometry(previous => { previous.dispose(); return centered; });
    setStats(getStats(centered, file.name));
    setMeasurePoints([]);
    setHoverPoint(null);
    setMeasurementHistory([]);
    setPreset("occlusal");
    setResetSignal(signal => signal + 1);
    setLoadingProgress(100);
    window.setTimeout(() => setLoadingProgress(null), 450);
  };

  const loadPly = async (file: File) => {
    setLoadingProgress(10);
    const buffer = await file.arrayBuffer();
    setLoadingProgress(55);
    const loader = new PLYLoader();
    const parsed = loader.parse(buffer);
    const centered = centerGeometry(parsed);
    setLoadingProgress(80);
    setGeometry(previous => { previous.dispose(); return centered; });
    setStats(getStats(centered, file.name));
    setMeasurePoints([]);
    setHoverPoint(null);
    setMeasurementHistory([]);
    setPreset("occlusal");
    setResetSignal(signal => signal + 1);
    setLoadingProgress(100);
    window.setTimeout(() => setLoadingProgress(null), 450);
  };

  const loadObj = async (file: File) => {
    setLoadingProgress(10);
    const text = await file.text();
    setLoadingProgress(45);
    const loader = new OBJLoader();
    const group = loader.parse(text);
    setLoadingProgress(65);

    // Merge all child mesh geometries into one BufferGeometry
    const positions: number[] = [];
    const normals: number[] = [];
    group.traverse(child => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;
      const geo = mesh.geometry as THREE.BufferGeometry;
      const pos = geo.getAttribute("position");
      const norm = geo.getAttribute("normal");
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
        if (norm) normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    });

    const merged = new THREE.BufferGeometry();
    merged.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    if (normals.length === positions.length) {
      merged.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    }
    merged.computeVertexNormals();
    const centered = centerGeometry(merged);
    setLoadingProgress(88);
    setGeometry(previous => { previous.dispose(); return centered; });
    setStats(getStats(centered, file.name));
    setMeasurePoints([]);
    setHoverPoint(null);
    setMeasurementHistory([]);
    setPreset("occlusal");
    setResetSignal(signal => signal + 1);
    setLoadingProgress(100);
    window.setTimeout(() => setLoadingProgress(null), 450);
  };

  const loadFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ply") return void loadPly(file);
    if (ext === "obj") return void loadObj(file);
    return void loadStl(file);
  };

  const exportScreenshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const anchor = document.createElement("a");
    anchor.download = `${stats.fileName.replace(/\W+/g, "-").toLowerCase()}-viewer.png`;
    anchor.href = canvas.toDataURL("image/png");
    anchor.click();
  };

  const toggleFullscreen = async () => {
    if (!viewerNode) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await viewerNode.requestFullscreen();
    }
  };

  const isDemoModel = stats.fileName === "Clinical demo arch";

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="primary">PBR STL viewer</StatusBadge>
              <StatusBadge tone={measurementMode ? "success" : "neutral"}>Measurements {measurementMode ? "on" : "off"}</StatusBadge>
              <StatusBadge tone={clipping ? "warning" : "neutral"}>Section {clipping ? "on" : "off"}</StatusBadge>
              <StatusBadge tone={loadingProgress !== null ? "info" : "neutral"}>{loadingProgress !== null ? "Parsing" : "Ready"}</StatusBadge>
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Treatment model workspace</h3>
            <p className="mt-1 text-xs text-secondary">
              Measurement is based on imported mesh geometry and should be professionally verified.
            </p>
            {isDemoModel && <p className="mt-1 text-xs text-secondary">No STL selected. Clinical demo geometry is shown until a scan is uploaded.</p>}
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".stl,.ply,.obj" className="hidden" onChange={event => event.target.files?.[0] && loadFile(event.target.files[0])} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><UploadCloud size={15} /> STL · PLY · OBJ</Button>
            <Button variant={measurementMode ? "primary" : "secondary"} size="sm" onClick={() => { setMeasurementMode(v => !v); setMeasurePoints([]); setHoverPoint(null); }}><Ruler size={15} /> Measure</Button>
            <Button variant={clipping ? "primary" : "secondary"} size="sm" onClick={() => setClipping(value => !value)}><Scissors size={15} /> Section</Button>
            <Button variant="secondary" size="icon" aria-label="Reset camera" onClick={() => setResetSignal(signal => signal + 1)}><RotateCcw size={17} /></Button>
            <Button variant="secondary" size="icon" aria-label="Export screenshot" onClick={exportScreenshot}><Camera size={17} /></Button>
            <Button variant="secondary" size="icon" aria-label="Fullscreen" onClick={() => void toggleFullscreen()}><Expand size={17} /></Button>
          </div>
        </div>

        {measurementMode && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-4 py-2">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-secondary">Mode:</span>
            {(["distance", "angle", "overjet", "overbite"] as MeasureType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => { setMeasureType(t); setMeasurePoints([]); setHoverPoint(null); }}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus-ring",
                  measureType === t
                    ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
                    : "border-border bg-card/60 text-secondary hover:text-foreground",
                ].join(" ")}
              >
                {t === "distance" ? "Distance (mm)" : t === "angle" ? "Angle (°)" : t === "overjet" ? "Overjet H (mm)" : "Overbite V (mm)"}
              </button>
            ))}
          </div>
        )}

        <div className="border-b border-border/60 bg-card p-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Button variant={measurementMode ? "primary" : "secondary"} size="sm" onClick={() => setMeasurementMode(value => !value)}>
              <Ruler size={15} /> Measure
            </Button>
            <Button variant={clipping ? "primary" : "secondary"} size="sm" onClick={() => setClipping(value => !value)}>
              <Scissors size={15} /> Section
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setResetSignal(signal => signal + 1)}>
              <RotateCcw size={15} /> Reset
            </Button>
            <Button variant="secondary" size="sm" onClick={() => void toggleFullscreen()}>
              <Expand size={15} /> Fullscreen
            </Button>
          </div>
        </div>

        <div
          ref={setViewerNode}
          className="relative touch-none select-none h-[420px] min-h-[360px] bg-[#0b111a] clinical-grid md:h-[680px]"
          onDoubleClick={() => setResetSignal((signal) => signal + 1)}
        >
          {loadingProgress !== null && (
            <div className="absolute left-4 right-4 top-4 z-20 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-foreground"><span>Optimizing STL geometry</span><span>{loadingProgress}%</span></div>
              <ProgressBar value={loadingProgress} />
            </div>
          )}
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true, localClippingEnabled: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.05 }}
            onCreated={({ gl }) => {
              canvasRef.current = gl.domElement;
              gl.setClearColor("#0b111a", 0);
            }}
          >
            <Suspense fallback={<Html center><span className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">Loading renderer...</span></Html>}>
              <Scene
                geometry={geometry}
                preset={preset}
                resetSignal={resetSignal}
                clipping={clipping}
                measurementMode={measurementMode}
                measureType={measureType}
                measurePoints={measurePoints}
                setMeasurePoints={setMeasurePoints}
                hoverPoint={hoverPoint}
                setHoverPoint={setHoverPoint}
                onMeasurementComplete={addMeasurement}
              />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur lg:right-auto">
            {measurementMode
              ? measureType === "angle"
                ? "Tap point A (first arm), then Vertex (apex), then point B (second arm) to compute the angle."
                : measureType === "overjet"
                ? "Tap upper incisor tip (A) then lower incisor tip (B). Horizontal distance is reported as overjet."
                : measureType === "overbite"
                ? "Tap upper incisor edge (A) then lower incisor edge (B). Vertical distance is reported as overbite."
                : "Tap point A then point B on the surface. Hover to preview. Result appears in the history panel."
              : "Tap and drag to rotate · Pinch to zoom · Enable Measure for clinical distance and angle tools."}
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Clinical views</h3>
            <Eye className="text-primary" size={18} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([
              ["occlusal", Maximize2],
              ["side", FlipHorizontal2],
              ["front", Eye],
              ["top", Download],
              ["bottom", UploadCloud]
            ] as [ViewPreset, React.ComponentType<{ size?: number }>][]).map(([view, Icon]) => (
              <Button key={view} variant={preset === view ? "primary" : "secondary"} size="sm" onClick={() => setPreset(view)}>
                <Icon size={14} /> {view}
              </Button>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">Model diagnostics</h3>
          <div className="mt-4">
            <DataRow label="File" value={<span className="break-all">{stats.fileName}</span>} />
            <DataRow label="Triangles" value={stats.triangles.toLocaleString()} />
            <DataRow label="Vertices" value={stats.vertices.toLocaleString()} />
            <DataRow label="Width" value={`${stats.width.toFixed(1)} mm`} />
            <DataRow label="Height" value={`${stats.height.toFixed(1)} mm`} />
            <DataRow label="Depth" value={`${stats.depth.toFixed(1)} mm`} />
            <DataRow label="Material" value="Dental enamel PBR" />
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Measurement history</h3>
            <StatusBadge tone="neutral">{measurementHistory.length}</StatusBadge>
          </div>
          <div className="mt-4 space-y-2">
            <DataRow
              label="Last measurement"
              value={measurementHistory[0]
                ? measurementHistory[0].type === "angle"
                  ? `${measurementHistory[0].angleDeg?.toFixed(1) ?? "—"}°`
                  : `${measurementHistory[0].distance.toFixed(2)} mm`
                : "—"}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" onClick={clearMeasurementHistory} disabled={measurementHistory.length === 0}>
                Clear all
              </Button>
              <Button variant="secondary" size="sm" onClick={exportMeasurementSummary} disabled={measurementHistory.length === 0}>
                Export
              </Button>
            </div>
            {measurementHistory.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-4 text-sm text-secondary">
                Place two measurement points to create a history entry.
              </p>
            ) : (
              measurementHistory.slice(0, 4).map((entry) => (
                <div key={entry.id} className="rounded-lg border border-border p-3">
                  <div className="flex items-center justify-between gap-3">
                    <button type="button" className="text-left text-sm font-semibold text-foreground" onClick={() => renameMeasurement(entry.id)}>
                      {entry.name}
                    </button>
                    <span className="text-xs text-secondary">{entry.createdAt}</span>
                  </div>
                  <p className="mt-1 text-xs text-secondary">
                    {entry.type === "angle"
                      ? `${entry.angleDeg?.toFixed(1) ?? "—"}°`
                      : `${entry.distance.toFixed(2)} mm`}
                    {entry.type === "overjet" && " — overjet"}
                    {entry.type === "overbite" && " — overbite"}
                  </p>
                  <div className="mt-3 flex gap-2">
                    <Button variant="ghost" size="sm" onClick={() => renameMeasurement(entry.id)}>Rename</Button>
                    <Button variant="ghost" size="sm" onClick={() => deleteMeasurement(entry.id)}>Delete</Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">Performance strategy</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-secondary">
            <p>Viewer loads client-side only, disposes replaced geometries, uses demand-sized camera framing, and keeps controls GPU-bound for smooth orbit, pan, and zoom.</p>
            <p>Large-file parsing is isolated from the app shell and ready for the existing worker pipeline when server-side scan processing is connected.</p>
          </div>
        </Card>
      </div>
    </div>
  );
}
