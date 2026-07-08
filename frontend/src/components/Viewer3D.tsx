"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { PLYLoader } from "three/examples/jsm/loaders/PLYLoader.js";
import { OBJLoader } from "three/examples/jsm/loaders/OBJLoader.js";
import * as THREE from "three";
import {
  ArrowDown, ArrowUp, Bookmark, BookmarkPlus, Camera, Expand, Eye,
  FlipHorizontal2, Grid3x3, HelpCircle, LayoutGrid, Maximize2,
  Redo2, RotateCcw, Ruler, Scissors, Sun, Tag, Undo2, UploadCloud, X,
} from "lucide-react";
import { Button, Card, DataRow, ProgressBar, Spinner, StatusBadge } from "@/components/DesignSystem";

// ── Types ────────────────────────────────────────────────────────────────────

type ViewPreset = "occlusal" | "side" | "right" | "front" | "top" | "bottom" | "perspective";
type MeasureType = "distance" | "angle" | "overjet" | "overbite";
type LightingPreset = "studio" | "clinical" | "dark" | "bright";

interface CameraBookmark {
  id: string;
  name: string;
  position: [number, number, number];
  target: [number, number, number];
}

type ModelStats = {
  fileName: string;
  triangles: number;
  vertices: number;
  width: number;
  height: number;
  depth: number;
};

type MeasurementRecord = {
  id: string;
  name: string;
  type: MeasureType;
  points: THREE.Vector3[];
  distance: number;
  angleDeg?: number;
  createdAt: string;
};

type CameraState = { position: THREE.Vector3; target: THREE.Vector3 };

// ── Constants ────────────────────────────────────────────────────────────────

const viewPresets: Record<ViewPreset, [number, number, number]> = {
  occlusal:    [0,  8,   0.1],
  side:        [8,  1.5, 0],
  right:       [-8, 1.5, 0],
  front:       [0,  1.5, 8],
  top:         [0,  10,  0.1],
  bottom:      [0, -10,  0.1],
  perspective: [4,  5,   8],
};

const LIGHTING_CONFIGS: Record<LightingPreset, { ambient: number; directional: number; exposure: number }> = {
  studio:   { ambient: 0.55, directional: 2.10, exposure: 1.05 },
  clinical: { ambient: 0.72, directional: 1.50, exposure: 1.00 },
  dark:     { ambient: 0.28, directional: 1.85, exposure: 0.90 },
  bright:   { ambient: 0.90, directional: 2.75, exposure: 1.20 },
};

// ── Helper functions ─────────────────────────────────────────────────────────

function computeAngleDeg(a: THREE.Vector3, vertex: THREE.Vector3, b: THREE.Vector3): number {
  const va = a.clone().sub(vertex).normalize();
  const vb = b.clone().sub(vertex).normalize();
  return THREE.MathUtils.radToDeg(Math.acos(Math.max(-1, Math.min(1, va.dot(vb)))));
}

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
    depth: size.z,
  };
}

// FDI tooth positions computed from the demo arch geometry, pre-centered.
// Computed once at module load — no WebGL context needed.
const DEMO_TOOTH_DATA: { fdi: number; pos: [number, number, number] }[] = (() => {
  const rawGeo = createDemoArchGeometry();
  rawGeo.computeBoundingBox();
  const c = new THREE.Vector3();
  rawGeo.boundingBox!.getCenter(c);
  rawGeo.dispose();

  const upperFdi = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
  const lowerFdi = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];
  const out: { fdi: number; pos: [number, number, number] }[] = [];

  for (let arch = 0; arch < 2; arch += 1) {
    const y0 = arch === 0 ? 0.58 : -0.58;
    const zb = arch === 0 ? -0.1 : 0.1;
    const labels = arch === 0 ? upperFdi : lowerFdi;
    for (let i = 0; i < 14; i += 1) {
      const t = (i - 6.5) / 6.5;
      out.push({
        fdi: labels[i],
        pos: [t * 4.4 - c.x, y0 - c.y, zb + Math.abs(t) * 1.35 - c.z],
      });
    }
  }
  return out;
})();

// ── Inner R3F components ─────────────────────────────────────────────────────

// Runs inside the main Canvas: streams camera state out via ref, and lerps
// toward a target position when gotoPositionRef is set.
function CameraTracker({
  cameraStateRef,
  gotoPositionRef,
}: {
  cameraStateRef: React.MutableRefObject<CameraState | null>;
  gotoPositionRef: React.MutableRefObject<CameraState | null>;
}) {
  const { camera, controls } = useThree();

  useFrame(() => {
    const orbit = controls as unknown as { target?: THREE.Vector3; update?: () => void };
    cameraStateRef.current = {
      position: camera.position.clone(),
      target: orbit.target?.clone() ?? new THREE.Vector3(),
    };

    const goto = gotoPositionRef.current;
    if (!goto) return;

    camera.position.lerp(goto.position, 0.10);
    orbit.target?.lerp(goto.target, 0.10);
    orbit.update?.();

    if (camera.position.distanceTo(goto.position) < 0.02) {
      camera.position.copy(goto.position);
      orbit.target?.copy(goto.target);
      orbit.update?.();
      gotoPositionRef.current = null;
    }
  });

  return null;
}

// Html labels placed at each demo-arch tooth centroid.
function FDILabels() {
  return (
    <>
      {DEMO_TOOTH_DATA.map(({ fdi, pos }) => (
        <Html key={fdi} position={pos} center distanceFactor={14}>
          <span
            className="pointer-events-none select-none rounded bg-black/65 px-1 py-0.5 font-mono text-[9px] text-white"
            style={{ whiteSpace: "nowrap" }}
          >
            {fdi}
          </span>
        </Html>
      ))}
    </>
  );
}

// Positions the R3F default camera at `position` looking at origin (used
// inside StaticViewCanvas where there are no OrbitControls).
function StaticCamera({ position }: { position: [number, number, number] }) {
  const { camera } = useThree();
  const [px, py, pz] = position;
  useEffect(() => {
    camera.position.set(px, py, pz);
    camera.lookAt(0, 0, 0);
    camera.updateProjectionMatrix();
  }, [camera, px, py, pz]);
  return null;
}

// A compact read-only viewport used in multi-view mode. Clones the geometry
// to avoid cross-renderer WebGL state conflicts.
function StaticViewCanvas({
  geometry,
  direction,
  label,
  lighting,
}: {
  geometry: THREE.BufferGeometry;
  direction: [number, number, number];
  label: string;
  lighting: LightingPreset;
}) {
  const ownGeo = useMemo(() => geometry.clone(), [geometry]);
  useEffect(() => () => { ownGeo.dispose(); }, [ownGeo]);

  const camPos = useMemo<[number, number, number]>(() => {
    const radius = Math.max(ownGeo.boundingSphere?.radius ?? 4, 1);
    const dir = new THREE.Vector3(...direction).normalize().multiplyScalar(radius * 3.2);
    return [dir.x, dir.y, dir.z];
  }, [ownGeo, direction]);

  const lc = LIGHTING_CONFIGS[lighting];

  return (
    <div className="relative h-full w-full">
      <Canvas
        dpr={[1, 1.5]}
        gl={{
          antialias: true,
          alpha: false,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: lc.exposure,
        }}
        onCreated={({ gl }) => { gl.setClearColor(new THREE.Color("#0b111a"), 1); }}
      >
        <StaticCamera position={camPos} />
        <ambientLight intensity={lc.ambient} />
        <directionalLight position={[4, 8, 6]} intensity={lc.directional} />
        <mesh geometry={ownGeo}>
          <meshPhysicalMaterial
            color="#f8fafc"
            roughness={0.38}
            metalness={0.02}
            clearcoat={0.35}
            clearcoatRoughness={0.4}
            side={THREE.DoubleSide}
          />
        </mesh>
        <gridHelper args={[12, 24, "#486072", "#253342"]} position={[0, -1.24, 0]} />
      </Canvas>
      <div className="pointer-events-none absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 bg-black/60">
        {label}
      </div>
    </div>
  );
}

function CameraFrame({
  geometry,
  preset,
  resetSignal,
}: {
  geometry: THREE.BufferGeometry;
  preset: ViewPreset;
  resetSignal: number;
}) {
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
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    dir.clone().normalize()
  );
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
      {!isAngle && points.length === 2 && <LineSeg from={points[0]} to={points[1]} />}
      {isAngle && points.length >= 2 && <LineSeg from={points[0]} to={points[1]} />}
      {isAngle && points.length === 3 && <LineSeg from={points[1]} to={points[2]} />}

      {points.map((point, index) => (
        <group key={index}>
          <mesh position={point}>
            <sphereGeometry args={[0.06, 16, 16]} />
            <meshBasicMaterial color="#2dd4bf" />
          </mesh>
          <Html position={point.clone().add(new THREE.Vector3(0.04, 0.04, 0.04))} center>
            <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">
              {isAngle
                ? (ANGLE_POINT_LABELS[index] ?? String.fromCharCode(65 + index))
                : String.fromCharCode(65 + index)}
            </span>
          </Html>
        </group>
      ))}

      {previewStart && previewEnd && (
        <group>
          <LineSeg from={previewStart} to={previewEnd} />
          <mesh position={previewEnd}>
            <sphereGeometry args={[0.05, 16, 16]} />
            <meshBasicMaterial color="#f59e0b" transparent opacity={0.75} />
          </mesh>
          <Html position={previewEnd.clone().add(new THREE.Vector3(0.04, 0.04, 0.04))} center>
            <span className="rounded-md border border-amber-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-amber-100 shadow-lg">
              {isAngle ? (ANGLE_POINT_LABELS[points.length] ?? "Next") : "Next"}
            </span>
          </Html>
        </group>
      )}

      {!isAngle && points.length === 2 && (() => {
        const mid = points[0].clone().add(points[1]).multiplyScalar(0.5);
        const displayVal =
          measureType === "overjet" ? Math.abs(points[0].x - points[1].x)
          : measureType === "overbite" ? Math.abs(points[0].y - points[1].y)
          : points[0].distanceTo(points[1]);
        const suffix =
          measureType === "overjet" ? " ↔"
          : measureType === "overbite" ? " ↕"
          : "";
        return (
          <Html position={mid} center>
            <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">
              {displayVal.toFixed(2)} mm{suffix}
            </span>
          </Html>
        );
      })()}

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
  opacity,
  wireframe,
  onPick,
  onHover,
}: {
  geometry: THREE.BufferGeometry;
  clipping: boolean;
  measurementMode: boolean;
  opacity: number;
  wireframe: boolean;
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
        clearcoat={wireframe ? 0 : 0.35}
        clearcoatRoughness={0.4}
        transmission={wireframe ? 0 : 0.04}
        thickness={0.22}
        transparent={opacity < 1}
        opacity={opacity}
        wireframe={wireframe}
        clippingPlanes={clipping ? [clippingPlane] : []}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function RendererConfig({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => { gl.toneMappingExposure = exposure; }, [gl, exposure]);
  return null;
}

function Scene({
  geometry,
  preset,
  resetSignal,
  clipping,
  measurementMode,
  measureType,
  measurePoints,
  setMeasurePoints,
  hoverPoint,
  setHoverPoint,
  onMeasurementComplete,
  opacity,
  wireframe,
  lighting,
  showAxes,
  showToothLabels,
  cameraStateRef,
  gotoPositionRef,
}: {
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
  opacity: number;
  wireframe: boolean;
  lighting: LightingPreset;
  showAxes: boolean;
  showToothLabels: boolean;
  cameraStateRef: React.MutableRefObject<CameraState | null>;
  gotoPositionRef: React.MutableRefObject<CameraState | null>;
}) {
  const pointsNeeded = measureType === "angle" ? 3 : 2;
  const lc = LIGHTING_CONFIGS[lighting];

  return (
    <>
      <RendererConfig exposure={lc.exposure} />
      <PerspectiveCamera makeDefault fov={35} position={[0, 7, 7]} />
      <CameraFrame geometry={geometry} preset={preset} resetSignal={resetSignal} />
      <CameraTracker cameraStateRef={cameraStateRef} gotoPositionRef={gotoPositionRef} />
      <ambientLight intensity={lc.ambient} />
      <directionalLight
        position={[4, 8, 6]}
        intensity={lc.directional}
        castShadow
        shadow-mapSize={[2048, 2048]}
      />
      <DentalModel
        geometry={geometry}
        clipping={clipping}
        measurementMode={measurementMode}
        opacity={opacity}
        wireframe={wireframe}
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
      {showToothLabels && <FDILabels />}
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
      {showAxes && <axesHelper args={[3]} />}
    </>
  );
}

// ── Public interface ─────────────────────────────────────────────────────────

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

// ── Keyboard shortcuts reference ─────────────────────────────────────────────

const SHORTCUT_ROWS: [string, string][] = [
  ["R", "Reset camera"],
  ["W", "Wireframe toggle"],
  ["F", "Fullscreen"],
  ["C", "Screenshot"],
  ["M", "Toggle measure mode"],
  ["1", "Occlusal view"],
  ["2", "Right view"],
  ["3", "Left view"],
  ["4", "Front view"],
  ["5", "Top view"],
  ["6", "Bottom view"],
  ["7", "Perspective view"],
  ["Ctrl + Z", "Undo measurement"],
  ["Ctrl + Y  /  Ctrl + Shift + Z", "Redo measurement"],
  ["?", "Toggle shortcuts panel"],
  ["Esc", "Close shortcuts panel"],
];

// ── Main component ───────────────────────────────────────────────────────────

export default function Viewer3D() {
  const [geometry, setGeometry] = useState<THREE.BufferGeometry>(() =>
    centerGeometry(createDemoArchGeometry())
  );
  const [stats, setStats] = useState<ModelStats>(() =>
    getStats(centerGeometry(createDemoArchGeometry()), "Clinical demo arch")
  );
  const [preset, setPreset] = useState<ViewPreset>("occlusal");
  const [clipping, setClipping] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [measurePoints, setMeasurePoints] = useState<THREE.Vector3[]>([]);
  const [hoverPoint, setHoverPoint] = useState<THREE.Vector3 | null>(null);
  const [measureType, setMeasureType] = useState<MeasureType>("distance");
  const [measurementHistory, setMeasurementHistory] = useState<MeasurementRecord[]>([]);
  const [measurementUndoStack, setMeasurementUndoStack] = useState<MeasurementRecord[][]>([]);
  const [measurementRedoStack, setMeasurementRedoStack] = useState<MeasurementRecord[][]>([]);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [lighting, setLighting] = useState<LightingPreset>("clinical");
  const [wireframe, setWireframe] = useState(false);
  const [modelOpacity, setModelOpacity] = useState(1.0);
  const [showAxes, setShowAxes] = useState(false);
  const [viewerNode, setViewerNode] = useState<HTMLDivElement | null>(null);
  const [multiView, setMultiView] = useState(false);
  const [showToothLabels, setShowToothLabels] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [bookmarks, setBookmarks] = useState<CameraBookmark[]>([]);
  const [editingBookmarkId, setEditingBookmarkId] = useState<string | null>(null);
  const [editingBookmarkName, setEditingBookmarkName] = useState("");

  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraStateRef = useRef<CameraState | null>(null);
  const gotoPositionRef = useRef<CameraState | null>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const isDemoModel = stats.fileName === "Clinical demo arch";

  // ── Measurement undo/redo ──────────────────────────────────────────────────

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
    const label =
      type === "distance" ? "Distance"
      : type === "angle" ? "Angle"
      : type === "overjet" ? "Overjet"
      : "Overbite";

    const snapshot = [...measurementHistory];
    setMeasurementUndoStack((us) => [...us, snapshot]);
    setMeasurementRedoStack([]);
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

  const undoMeasurement = useCallback(() => {
    if (measurementUndoStack.length === 0) return;
    const prev = measurementUndoStack[measurementUndoStack.length - 1];
    setMeasurementUndoStack((us) => us.slice(0, -1));
    setMeasurementRedoStack((rs) => [...rs, measurementHistory]);
    setMeasurementHistory(prev);
  }, [measurementUndoStack, measurementHistory]);

  const redoMeasurement = useCallback(() => {
    if (measurementRedoStack.length === 0) return;
    const next = measurementRedoStack[measurementRedoStack.length - 1];
    setMeasurementRedoStack((rs) => rs.slice(0, -1));
    setMeasurementUndoStack((us) => [...us, measurementHistory]);
    setMeasurementHistory(next);
  }, [measurementRedoStack, measurementHistory]);

  // ── Measurement list actions ───────────────────────────────────────────────

  const startRename = (id: string, currentName: string) => {
    setRenamingId(id);
    setRenameValue(currentName);
  };

  const commitRename = () => {
    if (renamingId && renameValue.trim()) {
      setMeasurementHistory((prev) =>
        prev.map((e) => (e.id === renamingId ? { ...e, name: renameValue.trim() } : e))
      );
    }
    setRenamingId(null);
    setRenameValue("");
  };

  const deleteMeasurement = (id: string) => {
    const snapshot = [...measurementHistory];
    setMeasurementUndoStack((us) => [...us, snapshot]);
    setMeasurementRedoStack([]);
    setMeasurementHistory((previous) => previous.filter((entry) => entry.id !== id));
  };

  const clearMeasurementHistory = () => {
    if (measurementHistory.length === 0) return;
    const snapshot = [...measurementHistory];
    setMeasurementUndoStack((us) => [...us, snapshot]);
    setMeasurementRedoStack([]);
    setMeasurementHistory([]);
    setMeasurePoints([]);
    setHoverPoint(null);
  };

  const exportMeasurementSummary = () => {
    if (measurementHistory.length === 0) return;
    const rows = measurementHistory
      .map((entry) => {
        const val =
          entry.type === "angle"
            ? `${entry.angleDeg?.toFixed(1) ?? "0"}°`
            : `${entry.distance.toFixed(2)} mm`;
        return `${entry.createdAt},${entry.name},${entry.type},${val}`;
      })
      .join("\n");
    const blob = new Blob([`time,name,type,value\n${rows}`], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "myortho-measurement-summary.csv";
    anchor.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  // ── Camera bookmarks ───────────────────────────────────────────────────────

  const saveBookmark = () => {
    if (bookmarks.length >= 8 || !cameraStateRef.current) return;
    const { position, target } = cameraStateRef.current;
    setBookmarks((prev) => [
      ...prev,
      {
        id: `bm-${Date.now()}`,
        name: `View ${prev.length + 1}`,
        position: [position.x, position.y, position.z],
        target: [target.x, target.y, target.z],
      },
    ]);
  };

  const gotoBookmark = (bm: CameraBookmark) => {
    gotoPositionRef.current = {
      position: new THREE.Vector3(...bm.position),
      target: new THREE.Vector3(...bm.target),
    };
  };

  const deleteBookmark = (id: string) => {
    setBookmarks((prev) => prev.filter((b) => b.id !== id));
  };

  const commitBookmarkRename = () => {
    if (editingBookmarkId && editingBookmarkName.trim()) {
      setBookmarks((prev) =>
        prev.map((b) =>
          b.id === editingBookmarkId ? { ...b, name: editingBookmarkName.trim() } : b
        )
      );
    }
    setEditingBookmarkId(null);
    setEditingBookmarkName("");
  };

  // ── File loading with FileReader progress ─────────────────────────────────

  const loadStl = (file: File) => {
    setLoadingProgress(2);
    gotoPositionRef.current = null;
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setLoadingProgress(Math.round((evt.loaded / evt.total) * 58) + 2);
      }
    };
    reader.onload = () => {
      setLoadingProgress(65);
      const parsed = new STLLoader().parse(reader.result as ArrayBuffer);
      setLoadingProgress(80);
      const centered = centerGeometry(parsed);
      setLoadingProgress(92);
      setGeometry((previous) => { previous.dispose(); return centered; });
      setStats(getStats(centered, file.name));
      setMeasurePoints([]);
      setHoverPoint(null);
      setMeasurementHistory([]);
      setMeasurementUndoStack([]);
      setMeasurementRedoStack([]);
      setShowToothLabels(false);
      setPreset("occlusal");
      setResetSignal((s) => s + 1);
      setLoadingProgress(100);
      window.setTimeout(() => setLoadingProgress(null), 450);
    };
    reader.onerror = () => setLoadingProgress(null);
    reader.readAsArrayBuffer(file);
  };

  const loadPly = (file: File) => {
    setLoadingProgress(2);
    gotoPositionRef.current = null;
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setLoadingProgress(Math.round((evt.loaded / evt.total) * 58) + 2);
      }
    };
    reader.onload = () => {
      setLoadingProgress(65);
      const parsed = new PLYLoader().parse(reader.result as ArrayBuffer);
      setLoadingProgress(80);
      const centered = centerGeometry(parsed);
      setLoadingProgress(92);
      setGeometry((previous) => { previous.dispose(); return centered; });
      setStats(getStats(centered, file.name));
      setMeasurePoints([]);
      setHoverPoint(null);
      setMeasurementHistory([]);
      setMeasurementUndoStack([]);
      setMeasurementRedoStack([]);
      setShowToothLabels(false);
      setPreset("occlusal");
      setResetSignal((s) => s + 1);
      setLoadingProgress(100);
      window.setTimeout(() => setLoadingProgress(null), 450);
    };
    reader.onerror = () => setLoadingProgress(null);
    reader.readAsArrayBuffer(file);
  };

  const loadObj = (file: File) => {
    setLoadingProgress(2);
    gotoPositionRef.current = null;
    const reader = new FileReader();
    reader.onprogress = (evt) => {
      if (evt.lengthComputable) {
        setLoadingProgress(Math.round((evt.loaded / evt.total) * 50) + 2);
      }
    };
    reader.onload = () => {
      setLoadingProgress(58);
      const group = new OBJLoader().parse(reader.result as string);
      setLoadingProgress(68);

      const positions: number[] = [];
      const normals: number[] = [];
      group.traverse((child) => {
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
      setGeometry((previous) => { previous.dispose(); return centered; });
      setStats(getStats(centered, file.name));
      setMeasurePoints([]);
      setHoverPoint(null);
      setMeasurementHistory([]);
      setMeasurementUndoStack([]);
      setMeasurementRedoStack([]);
      setShowToothLabels(false);
      setPreset("occlusal");
      setResetSignal((s) => s + 1);
      setLoadingProgress(100);
      window.setTimeout(() => setLoadingProgress(null), 450);
    };
    reader.onerror = () => setLoadingProgress(null);
    reader.readAsText(file);
  };

  const loadFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "ply") return loadPly(file);
    if (ext === "obj") return loadObj(file);
    return loadStl(file);
  };

  // ── Screenshot / fullscreen ───────────────────────────────────────────────

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

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  // Keep a ref to the latest action functions so the effect closure stays stable.
  const kbRef = useRef({
    showShortcuts: false,
    undo: undoMeasurement,
    redo: redoMeasurement,
    fullscreen: toggleFullscreen,
    screenshot: exportScreenshot,
  });
  kbRef.current.showShortcuts = showShortcuts;
  kbRef.current.undo = undoMeasurement;
  kbRef.current.redo = redoMeasurement;
  kbRef.current.fullscreen = toggleFullscreen;
  kbRef.current.screenshot = exportScreenshot;

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const isTyping = tag === "INPUT" || tag === "TEXTAREA";

      if (e.key === "Escape") {
        if (kbRef.current.showShortcuts) setShowShortcuts(false);
        return;
      }
      if (e.key === "?" && !isTyping) {
        setShowShortcuts((v) => !v);
        return;
      }
      if (isTyping) return;

      const isCtrl = e.ctrlKey || e.metaKey;
      if (isCtrl && !e.shiftKey && e.key.toLowerCase() === "z") {
        e.preventDefault();
        kbRef.current.undo();
        return;
      }
      if (isCtrl && (e.key.toLowerCase() === "y" || (e.shiftKey && e.key.toLowerCase() === "z"))) {
        e.preventDefault();
        kbRef.current.redo();
        return;
      }

      switch (e.key.toLowerCase()) {
        case "r": setResetSignal((s) => s + 1); break;
        case "w": setWireframe((v) => !v); break;
        case "f": void kbRef.current.fullscreen(); break;
        case "c": kbRef.current.screenshot(); break;
        case "m":
          setMeasurementMode((v) => !v);
          setMeasurePoints([]);
          setHoverPoint(null);
          break;
        case "1": setPreset("occlusal"); break;
        case "2": setPreset("right"); break;
        case "3": setPreset("side"); break;
        case "4": setPreset("front"); break;
        case "5": setPreset("top"); break;
        case "6": setPreset("bottom"); break;
        case "7": setPreset("perspective"); break;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []); // safe: only stable setters and kbRef (mutated each render) are used

  // ── The shared canvas element ──────────────────────────────────────────────

  const mainCanvas = (
    <Canvas
      shadows
      dpr={[1, 2]}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        localClippingEnabled: true,
        toneMapping: THREE.ACESFilmicToneMapping,
        toneMappingExposure: 1.05,
      }}
      onCreated={({ gl }) => {
        canvasRef.current = gl.domElement;
        gl.setClearColor("#0b111a", 0);
      }}
    >
      <Suspense
        fallback={
          <Html center>
            <span className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">
              Loading renderer…
            </span>
          </Html>
        }
      >
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
          opacity={modelOpacity}
          wireframe={wireframe}
          lighting={lighting}
          showAxes={showAxes}
          showToothLabels={showToothLabels}
          cameraStateRef={cameraStateRef}
          gotoPositionRef={gotoPositionRef}
        />
      </Suspense>
    </Canvas>
  );

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden">
        {/* ── Header toolbar ── */}
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="primary">PBR STL viewer</StatusBadge>
              <StatusBadge tone={measurementMode ? "success" : "neutral"}>
                Measurements {measurementMode ? "on" : "off"}
              </StatusBadge>
              <StatusBadge tone={clipping ? "warning" : "neutral"}>
                Section {clipping ? "on" : "off"}
              </StatusBadge>
              <StatusBadge tone={loadingProgress !== null ? "info" : "neutral"}>
                {loadingProgress !== null ? "Loading" : "Ready"}
              </StatusBadge>
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">
              Treatment model workspace
            </h3>
            <p className="mt-1 text-xs text-secondary">
              Measurement is based on imported mesh geometry and should be professionally verified.
            </p>
            {isDemoModel && (
              <p className="mt-1 text-xs text-secondary">
                No STL selected. Clinical demo geometry is shown until a scan is uploaded.
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              ref={fileRef}
              type="file"
              accept=".stl,.ply,.obj"
              className="hidden"
              onChange={(event) => event.target.files?.[0] && loadFile(event.target.files[0])}
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              <UploadCloud size={15} /> STL · PLY · OBJ
            </Button>
            <Button
              variant={measurementMode ? "primary" : "secondary"}
              size="sm"
              onClick={() => {
                setMeasurementMode((v) => !v);
                setMeasurePoints([]);
                setHoverPoint(null);
              }}
            >
              <Ruler size={15} /> Measure
            </Button>
            <Button
              variant={clipping ? "primary" : "secondary"}
              size="sm"
              onClick={() => setClipping((value) => !value)}
            >
              <Scissors size={15} /> Section
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Reset camera"
              onClick={() => setResetSignal((s) => s + 1)}
            >
              <RotateCcw size={17} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Export screenshot"
              onClick={exportScreenshot}
            >
              <Camera size={17} />
            </Button>
            <Button
              variant="secondary"
              size="icon"
              aria-label="Fullscreen"
              onClick={() => void toggleFullscreen()}
            >
              <Expand size={17} />
            </Button>
            <Button
              variant={multiView ? "primary" : "secondary"}
              size="icon"
              aria-label="Multi-view 2×2 grid"
              title="Multi-view (2×2)"
              onClick={() => setMultiView((v) => !v)}
            >
              <LayoutGrid size={17} />
            </Button>
            <Button
              variant={showToothLabels ? "primary" : "secondary"}
              size="icon"
              aria-label="FDI tooth labels"
              title={isDemoModel ? "Toggle FDI tooth labels" : "FDI labels available in demo mode"}
              disabled={!isDemoModel}
              onClick={() => setShowToothLabels((v) => !v)}
            >
              <Tag size={17} />
            </Button>
            <Button
              variant={showShortcuts ? "primary" : "secondary"}
              size="icon"
              aria-label="Keyboard shortcuts"
              title="Keyboard shortcuts (?)"
              onClick={() => setShowShortcuts((v) => !v)}
            >
              <HelpCircle size={17} />
            </Button>
          </div>
        </div>

        {/* ── Measure mode sub-toolbar ── */}
        {measurementMode && (
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/60 px-4 py-2">
            <span className="mr-1 text-[10px] font-bold uppercase tracking-widest text-secondary">
              Mode:
            </span>
            {(["distance", "angle", "overjet", "overbite"] as MeasureType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setMeasureType(t);
                  setMeasurePoints([]);
                  setHoverPoint(null);
                }}
                className={[
                  "rounded-full border px-2.5 py-1 text-[11px] font-semibold transition focus-ring",
                  measureType === t
                    ? "border-teal-500/40 bg-teal-500/15 text-teal-300"
                    : "border-border bg-card/60 text-secondary hover:text-foreground",
                ].join(" ")}
              >
                {t === "distance"
                  ? "Distance (mm)"
                  : t === "angle"
                  ? "Angle (°)"
                  : t === "overjet"
                  ? "Overjet H (mm)"
                  : "Overbite V (mm)"}
              </button>
            ))}
          </div>
        )}

        {/* ── Mobile quick-controls ── */}
        <div className="border-b border-border/60 bg-card p-3 lg:hidden">
          <div className="grid grid-cols-2 gap-2">
            <Button
              variant={measurementMode ? "primary" : "secondary"}
              size="sm"
              onClick={() => setMeasurementMode((value) => !value)}
            >
              <Ruler size={15} /> Measure
            </Button>
            <Button
              variant={clipping ? "primary" : "secondary"}
              size="sm"
              onClick={() => setClipping((value) => !value)}
            >
              <Scissors size={15} /> Section
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setResetSignal((s) => s + 1)}
            >
              <RotateCcw size={15} /> Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void toggleFullscreen()}
            >
              <Expand size={15} /> Fullscreen
            </Button>
          </div>
        </div>

        {/* ── 3D viewport ── */}
        <div
          ref={setViewerNode}
          className="relative touch-none select-none h-[420px] min-h-[360px] bg-[#0b111a] clinical-grid md:h-[680px]"
          onDoubleClick={() => setResetSignal((s) => s + 1)}
        >
          {/* Loading overlay */}
          {loadingProgress !== null && (
            <div className="absolute left-4 right-4 top-4 z-20 rounded-lg border border-border bg-card/95 p-3 shadow-lg backdrop-blur">
              <div className="mb-2 flex items-center gap-2 text-xs font-semibold text-foreground">
                <Spinner size={14} />
                <span className="flex-1">Loading model…</span>
                <span className="tabular-nums">{loadingProgress}%</span>
              </div>
              <ProgressBar value={loadingProgress} />
            </div>
          )}

          {/* Keyboard shortcuts overlay */}
          {showShortcuts && (
            <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/65 backdrop-blur-sm">
              <div className="relative w-full max-w-sm rounded-xl border border-border bg-card/97 p-5 shadow-2xl mx-4">
                <button
                  type="button"
                  onClick={() => setShowShortcuts(false)}
                  className="absolute right-3 top-3 rounded p-1 text-secondary hover:text-foreground focus-ring"
                  aria-label="Close shortcuts panel"
                >
                  <X size={15} />
                </button>
                <h3 className="mb-4 text-sm font-semibold text-foreground">Keyboard shortcuts</h3>
                <table className="w-full text-xs">
                  <tbody>
                    {SHORTCUT_ROWS.map(([key, desc]) => (
                      <tr key={key} className="border-b border-border/40 last:border-0">
                        <td className="py-1.5 pr-4 align-top">
                          <kbd className="inline-block rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-foreground ring-1 ring-border">
                            {key}
                          </kbd>
                        </td>
                        <td className="py-1.5 text-secondary">{desc}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Viewport content: single or multi-view */}
          {multiView ? (
            <div className="grid grid-cols-2 grid-rows-2 h-full divide-x divide-y divide-white/10">
              <div className="relative">
                <StaticViewCanvas
                  geometry={geometry}
                  direction={[0, 0, 1]}
                  label="Front"
                  lighting={lighting}
                />
              </div>
              <div className="relative">
                <StaticViewCanvas
                  geometry={geometry}
                  direction={[0, 1, 0.01]}
                  label="Occlusal"
                  lighting={lighting}
                />
              </div>
              <div className="relative">
                <StaticViewCanvas
                  geometry={geometry}
                  direction={[-1, 0, 0]}
                  label="Right"
                  lighting={lighting}
                />
              </div>
              <div className="relative">
                {mainCanvas}
                <div className="pointer-events-none absolute left-2 top-2 rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-200 bg-black/60">
                  3D
                </div>
              </div>
            </div>
          ) : (
            <>
              {mainCanvas}
              <div className="pointer-events-none absolute bottom-4 left-4 right-4 rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur lg:right-auto">
                {measurementMode
                  ? measureType === "angle"
                    ? "Tap point A (first arm), then Vertex (apex), then point B (second arm) to compute the angle."
                    : measureType === "overjet"
                    ? "Tap upper incisor tip (A) then lower incisor tip (B). Horizontal distance is reported as overjet."
                    : measureType === "overbite"
                    ? "Tap upper incisor edge (A) then lower incisor edge (B). Vertical distance is reported as overbite."
                    : "Tap point A then point B on the surface. Hover to preview. Result appears in the history panel."
                  : "Tap and drag to rotate · Pinch to zoom · Enable Measure for clinical distance and angle tools · Press ? for shortcuts."}
              </div>
            </>
          )}
        </div>
      </Card>

      {/* ── Right sidebar ── */}
      <div className="space-y-6">

        {/* Clinical views */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Clinical views</h3>
            <Eye className="text-primary" size={18} />
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2">
            {([
              ["occlusal", Maximize2],
              ["side", FlipHorizontal2],
              ["right", FlipHorizontal2],
              ["front", Eye],
              ["top", ArrowDown],
              ["bottom", ArrowUp],
              ["perspective", Camera],
            ] as [ViewPreset, React.ComponentType<{ size?: number }>][]).map(([view, Icon]) => (
              <Button
                key={view}
                variant={preset === view ? "primary" : "secondary"}
                size="sm"
                onClick={() => setPreset(view)}
              >
                <Icon size={14} /> {view}
              </Button>
            ))}
          </div>
        </Card>

        {/* Camera bookmarks */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Camera bookmarks</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs tabular-nums text-secondary">{bookmarks.length}/8</span>
              <Bookmark className="text-primary" size={16} />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={saveBookmark}
              disabled={bookmarks.length >= 8}
            >
              <BookmarkPlus size={14} /> Save current view
            </Button>
            {bookmarks.length === 0 ? (
              <p className="rounded-lg border border-dashed border-border px-3 py-3 text-xs text-secondary">
                No views saved. Orbit to a position and press Save.
              </p>
            ) : (
              bookmarks.map((bm) => (
                <div
                  key={bm.id}
                  className="flex items-center gap-2 rounded-lg border border-border px-2.5 py-2"
                >
                  {editingBookmarkId === bm.id ? (
                    <input
                      autoFocus
                      value={editingBookmarkName}
                      onChange={(e) => setEditingBookmarkName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitBookmarkRename();
                        if (e.key === "Escape") setEditingBookmarkId(null);
                      }}
                      onBlur={commitBookmarkRename}
                      className="flex-1 rounded border border-border bg-card px-1.5 py-0.5 text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                    />
                  ) : (
                    <button
                      type="button"
                      className="flex-1 text-left text-xs font-semibold text-foreground hover:text-primary"
                      title="Click to go to view · Double-click to rename"
                      onClick={() => gotoBookmark(bm)}
                      onDoubleClick={() => {
                        setEditingBookmarkId(bm.id);
                        setEditingBookmarkName(bm.name);
                      }}
                    >
                      {bm.name}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteBookmark(bm.id)}
                    className="shrink-0 rounded p-0.5 text-secondary hover:text-foreground"
                    aria-label={`Delete bookmark ${bm.name}`}
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Display settings */}
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Display</h3>
            <Sun className="text-primary" size={18} />
          </div>
          <div className="mt-4 space-y-4">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-secondary">
                Lighting
              </p>
              <div className="grid grid-cols-2 gap-2">
                {(["studio", "clinical", "dark", "bright"] as LightingPreset[]).map((l) => (
                  <Button
                    key={l}
                    variant={lighting === l ? "primary" : "secondary"}
                    size="sm"
                    onClick={() => setLighting(l)}
                  >
                    {l.charAt(0).toUpperCase() + l.slice(1)}
                  </Button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-secondary">
                Surface mode
              </p>
              <div className="flex gap-2">
                <Button
                  variant={!wireframe ? "primary" : "secondary"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWireframe(false)}
                >
                  Shaded
                </Button>
                <Button
                  variant={wireframe ? "primary" : "secondary"}
                  size="sm"
                  className="flex-1"
                  onClick={() => setWireframe(true)}
                >
                  <Grid3x3 size={14} /> Wire
                </Button>
              </div>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                  Opacity
                </p>
                <span className="text-xs tabular-nums text-secondary">
                  {Math.round(modelOpacity * 100)}%
                </span>
              </div>
              <input
                type="range"
                min={0.15}
                max={1}
                step={0.01}
                value={modelOpacity}
                onChange={(e) => setModelOpacity(parseFloat(e.target.value))}
                className="w-full"
                style={{ accentColor: "var(--primary)" }}
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-widest text-secondary">
                Axes helper
              </p>
              <button
                type="button"
                onClick={() => setShowAxes((v) => !v)}
                className={[
                  "relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus-ring",
                  showAxes ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]",
                ].join(" ")}
                aria-label="Toggle axes helper"
              >
                <span
                  className={[
                    "inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform",
                    showAxes ? "translate-x-4" : "translate-x-0.5",
                  ].join(" ")}
                />
              </button>
            </div>
          </div>
        </Card>

        {/* Model diagnostics */}
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

        {/* Measurement history */}
        <Card className="p-4">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">Measurement history</h3>
            <StatusBadge tone="neutral">{measurementHistory.length}</StatusBadge>
          </div>
          <div className="mt-4 space-y-2">
            <DataRow
              label="Last measurement"
              value={
                measurementHistory[0]
                  ? measurementHistory[0].type === "angle"
                    ? `${measurementHistory[0].angleDeg?.toFixed(1) ?? "—"}°`
                    : `${measurementHistory[0].distance.toFixed(2)} mm`
                  : "—"
              }
            />
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={clearMeasurementHistory}
                disabled={measurementHistory.length === 0}
              >
                Clear all
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={exportMeasurementSummary}
                disabled={measurementHistory.length === 0}
              >
                Export
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Undo measurement"
                title="Undo (Ctrl+Z)"
                disabled={measurementUndoStack.length === 0}
                onClick={undoMeasurement}
              >
                <Undo2 size={15} />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                aria-label="Redo measurement"
                title="Redo (Ctrl+Y)"
                disabled={measurementRedoStack.length === 0}
                onClick={redoMeasurement}
              >
                <Redo2 size={15} />
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
                    {renamingId === entry.id ? (
                      <input
                        autoFocus
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitRename();
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                        onBlur={commitRename}
                        className="flex-1 rounded border border-[color:var(--border)] bg-[color:var(--card)] px-2 py-0.5 text-sm font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-[color:var(--primary)]/30"
                      />
                    ) : (
                      <button
                        type="button"
                        className="text-left text-sm font-semibold text-foreground hover:text-[color:var(--primary)]"
                        onClick={() => startRename(entry.id, entry.name)}
                      >
                        {entry.name}
                      </button>
                    )}
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
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => startRename(entry.id, entry.name)}
                    >
                      Rename
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteMeasurement(entry.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Performance notes */}
        <Card className="p-4">
          <h3 className="text-sm font-semibold text-foreground">Performance strategy</h3>
          <div className="mt-4 space-y-3 text-sm leading-6 text-secondary">
            <p>
              Viewer loads client-side only, disposes replaced geometries, uses demand-sized camera
              framing, and keeps controls GPU-bound for smooth orbit, pan, and zoom.
            </p>
            <p>
              Large-file parsing is isolated from the app shell and ready for the existing worker
              pipeline when server-side scan processing is connected.
            </p>
          </div>
        </Card>

      </div>
    </div>
  );
}
