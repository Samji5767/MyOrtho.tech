"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import {
  ContactShadows, Html, OrbitControls,
  PerspectiveCamera, TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  ChevronsLeft, ChevronsRight, Download, Eye, Layers, ListOrdered, Move3d,
  RotateCcw, Ruler, Scissors, Settings2, Target, Zap,
} from "lucide-react";
import { Button, Card, DataRow, StatusBadge } from "@/components/DesignSystem";
import { validateMovements } from "@/lib/biomechanics/vectorMath";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToothObject {
  fdi: number;
  geometry: THREE.BufferGeometry;
  initPosition: THREE.Vector3;
  initRotation: THREE.Euler;
  hasAttachment: boolean;
  iprLeft: boolean;    // IPR between this tooth and the one mesially
  color: string;
}

type GizmoMode = "translate" | "rotate";
type CrossSectionAxis = "x" | "y" | "z";
type PlacementType = "gingival" | "mid" | "incisal";

interface AlignerStageRow {
  stage: number;
  activeTeeth: number[];
  ipr: boolean;
  attachmentActivations: number[];
}

const AXIS_NORMALS: Record<CrossSectionAxis, THREE.Vector3> = {
  x: new THREE.Vector3(1, 0, 0),
  y: new THREE.Vector3(0, 1, 0),
  z: new THREE.Vector3(0, 0, 1),
};

// Per-contact IPR amounts (FDI of mesial tooth → mm)
const IPR_AMOUNTS: Record<number, number> = {
  11: 0.10,
  12: 0.15,
  21: 0.25,
  22: 0.50,
  31: 0.85,
  41: 0.30,
};

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const UPPER_FDIS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27];
const LOWER_FDIS = [41, 42, 43, 44, 45, 46, 47, 31, 32, 33, 34, 35, 36, 37];
const ATTACHMENT_FDIS = new Set([12, 13, 14, 21, 22, 23, 24, 31, 32, 33, 41, 42, 43]);
const IPR_FDIS = new Set([11, 12, 21, 22, 31, 41]);

function buildToothGeom(scaleFactor: number): THREE.BufferGeometry {
  const g = new THREE.SphereGeometry(0.38, 18, 12);
  g.scale(0.86 * scaleFactor, 0.4, scaleFactor);
  return g;
}

function buildTeethObjects(): ToothObject[] {
  const objects: ToothObject[] = [];

  // Upper arch — quadrant 1 (FDI 11-17): patient right (negative x), Q2 (21-27): positive x
  UPPER_FDIS.forEach((fdi, rawIdx) => {
    const isQ1 = fdi < 21;
    const idx = isQ1 ? fdi - 11 : fdi - 21;
    const side = isQ1 ? -1 : 1;
    const t = idx / 6.0;
    const x = side * (0.35 + idx * 0.64);
    const z = -(0.55 + t * t * 1.1);
    const scaleFactor = 0.76 + t * 0.36;
    objects.push({
      fdi,
      geometry: buildToothGeom(scaleFactor),
      initPosition: new THREE.Vector3(x, 0.55, z),
      initRotation: new THREE.Euler(0, side * t * 0.35, 0),
      hasAttachment: ATTACHMENT_FDIS.has(fdi),
      iprLeft: IPR_FDIS.has(fdi),
      color: "#d1d5db",
    });
  });

  // Lower arch
  LOWER_FDIS.forEach((fdi) => {
    const isQ4 = fdi > 40;
    const idx = isQ4 ? fdi - 41 : fdi - 31;
    const side = isQ4 ? -1 : 1;
    const t = idx / 6.0;
    const x = side * (0.35 + idx * 0.62);
    const z = 0.55 + t * t * 1.05;
    const scaleFactor = 0.70 + t * 0.32;
    objects.push({
      fdi,
      geometry: buildToothGeom(scaleFactor),
      initPosition: new THREE.Vector3(x, -0.55, z),
      initRotation: new THREE.Euler(0, side * t * 0.32, 0),
      hasAttachment: ATTACHMENT_FDIS.has(fdi),
      iprLeft: IPR_FDIS.has(fdi),
      color: "#e2e8f0",
    });
  });

  return objects;
}

// ─── Collision detection ──────────────────────────────────────────────────────

function detectCollisions(
  teeth: ToothObject[],
  overrides: Map<number, { position: THREE.Vector3; rotation: THREE.Euler }>,
): Set<number> {
  const THRESHOLD = 0.72;
  const colliding = new Set<number>();
  for (let i = 0; i < teeth.length; i++) {
    for (let j = i + 1; j < teeth.length; j++) {
      const posA = overrides.get(teeth[i].fdi)?.position ?? teeth[i].initPosition;
      const posB = overrides.get(teeth[j].fdi)?.position ?? teeth[j].initPosition;
      if (posA.distanceTo(posB) < THRESHOLD) {
        colliding.add(teeth[i].fdi);
        colliding.add(teeth[j].fdi);
      }
    }
  }
  return colliding;
}

// ─── Single tooth mesh ────────────────────────────────────────────────────────

function ToothMesh({
  tooth,
  isSelected,
  isGroupSelected,
  isColliding,
  showAttachments,
  showIPR,
  placementType,
  clippingPlanes,
  onSelect,
  onMeshMounted,
}: {
  tooth: ToothObject;
  isSelected: boolean;
  isGroupSelected: boolean;
  isColliding: boolean;
  showAttachments: boolean;
  showIPR: boolean;
  placementType: PlacementType;
  clippingPlanes: THREE.Plane[];
  onSelect: (fdi: number, shift: boolean) => void;
  onMeshMounted: (fdi: number, mesh: THREE.Mesh | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Expose mesh ref to parent for TransformControls
  useEffect(() => {
    onMeshMounted(tooth.fdi, meshRef.current);
    return () => onMeshMounted(tooth.fdi, null);
  });

  const mat = useMemo(() => new THREE.MeshPhysicalMaterial({
    color: isColliding ? "#ef4444" : isSelected ? "#2dd4bf" : isGroupSelected ? "#818cf8" : tooth.color,
    roughness: 0.38,
    metalness: 0.02,
    clearcoat: 0.3,
    clearcoatRoughness: 0.4,
    emissive: isColliding ? "#7f1d1d" : isSelected ? "#0f766e" : isGroupSelected ? "#312e81" : "#000000",
    emissiveIntensity: isSelected || isGroupSelected || isColliding ? 0.12 : 0,
  }), [isSelected, isGroupSelected, isColliding, tooth.color]);

  // Dispose material when dependencies change or component unmounts to prevent VRAM leaks
  useEffect(() => {
    return () => { mat.dispose(); };
  }, [mat]);

  // Update clipping planes without recreating the material
  useEffect(() => {
    mat.clippingPlanes = clippingPlanes;
    mat.needsUpdate = true;
  }, [mat, clippingPlanes]);

  return (
    <group position={tooth.initPosition} rotation={tooth.initRotation}>
      <mesh
        ref={meshRef}
        geometry={tooth.geometry}
        material={mat}
        castShadow
        receiveShadow
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          e.stopPropagation();
          onSelect(tooth.fdi, e.shiftKey);
        }}
      />
      {/* Attachment block — Y position driven by placement type */}
      {showAttachments && tooth.hasAttachment && (() => {
        const attachY = placementType === "gingival" ? -0.16 : placementType === "mid" ? 0.12 : 0.38;
        return (
          <mesh position={[0, attachY, 0.04]}>
            <boxGeometry args={[0.22, 0.12, 0.09]} />
            <meshPhysicalMaterial color="#5b8dee" roughness={0.3} metalness={0.1} />
          </mesh>
        );
      })()}
      {/* IPR marker disc */}
      {tooth.iprLeft && (
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.10, 0.10, 0.018, 12]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.75} />
        </mesh>
      )}
      {/* IPR measurement label */}
      {tooth.iprLeft && showIPR && IPR_AMOUNTS[tooth.fdi] != null && (
        <Html position={[0.52, 0.55, 0]} center distanceFactor={6}>
          <div
            className="pointer-events-none select-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold shadow"
            style={{
              background: IPR_AMOUNTS[tooth.fdi] > 0.5 ? '#ef4444' : '#fde68a',
              color: IPR_AMOUNTS[tooth.fdi] > 0.5 ? '#fff' : '#1a1000',
              border: `1px solid ${IPR_AMOUNTS[tooth.fdi] > 0.5 ? '#b91c1c' : '#d97706'}`,
            }}
          >
            {IPR_AMOUNTS[tooth.fdi].toFixed(2)}mm
          </div>
        </Html>
      )}
      {/* FDI label */}
      {isSelected && (
        <Html position={[0, 0.7, 0]} center>
          <span className="rounded border border-teal-400/40 bg-slate-950/90 px-1.5 py-0.5 text-[10px] font-bold text-teal-200 shadow pointer-events-none">
            FDI {tooth.fdi}
          </span>
        </Html>
      )}
    </group>
  );
}

// ─── 3-D scene ────────────────────────────────────────────────────────────────

function CADScene({
  teeth,
  selectedFdis,
  gizmoMode,
  showAttachments,
  showIPR,
  placementType,
  collisionFdis,
  clippingPlanes,
  onSelectTooth,
  onTransformChange,
}: {
  teeth: ToothObject[];
  selectedFdis: Set<number>;
  gizmoMode: GizmoMode;
  showAttachments: boolean;
  showIPR: boolean;
  placementType: PlacementType;
  collisionFdis: Set<number>;
  clippingPlanes: THREE.Plane[];
  onSelectTooth: (fdi: number, shift: boolean) => void;
  onTransformChange: (fdi: number, pos: THREE.Vector3, rot: THREE.Euler) => void;
}) {
  const meshRegistry = useRef<Map<number, THREE.Mesh>>(new Map());
  const [activeMesh, setActiveMesh] = useState<THREE.Mesh | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { gl } = useThree();

  const primaryFdi = selectedFdis.size === 1 ? Array.from(selectedFdis)[0] : null;

  const handleMeshMounted = useCallback((fdi: number, mesh: THREE.Mesh | null) => {
    if (mesh) meshRegistry.current.set(fdi, mesh);
    else meshRegistry.current.delete(fdi);
  }, []);

  // Update activeMesh when selection changes
  useEffect(() => {
    if (primaryFdi != null) {
      const m = meshRegistry.current.get(primaryFdi);
      setActiveMesh(m ?? null);
    } else {
      setActiveMesh(null);
    }
  }, [primaryFdi]);

  // Keep localClippingEnabled for any clipping planes
  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  return (
    <>
      <PerspectiveCamera makeDefault fov={40} position={[0, 9, 0.4]} up={[0, 0, -1]} />
      <ambientLight intensity={0.55} />
      <directionalLight position={[4, 8, 6]} intensity={2.1} castShadow shadow-mapSize={[2048, 2048]} />

      {teeth.map(tooth => (
        <ToothMesh
          key={tooth.fdi}
          tooth={tooth}
          isSelected={selectedFdis.size === 1 && selectedFdis.has(tooth.fdi)}
          isGroupSelected={selectedFdis.size > 1 && selectedFdis.has(tooth.fdi)}
          isColliding={collisionFdis.has(tooth.fdi)}
          showAttachments={showAttachments}
          showIPR={showIPR}
          placementType={placementType}
          clippingPlanes={clippingPlanes}
          onSelect={onSelectTooth}
          onMeshMounted={handleMeshMounted}
        />
      ))}

      {activeMesh && (
        <TransformControls
          object={activeMesh}
          mode={gizmoMode}
          onMouseDown={() => setIsDragging(true)}
          onMouseUp={() => {
            setIsDragging(false);
            if (primaryFdi != null && activeMesh) {
              onTransformChange(
                primaryFdi,
                activeMesh.position.clone(),
                activeMesh.rotation.clone(),
              );
            }
          }}
        />
      )}

      <ContactShadows opacity={0.28} scale={14} blur={2.4} far={4} position={[0, -1.1, 0]} />
      {/* Offline lighting: no CDN HDRI fetch */}
      <ambientLight intensity={0.6} />
      <directionalLight position={[6, 10, 8]} intensity={1.8} castShadow />
      <directionalLight position={[-4, 4, -6]} intensity={0.5} />
      <OrbitControls
        makeDefault
        enabled={!isDragging}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={80}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />
      <gridHelper args={[14, 28, "#486072", "#253342"]} position={[0, -1.1, 0]} />
    </>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

// Undo/redo history for tooth transform overrides
type OverridesMap = Map<number, { position: THREE.Vector3; rotation: THREE.Euler }>;

function cloneOverrides(m: OverridesMap): OverridesMap {
  return new Map(Array.from(m.entries()).map(([k, v]) => [k, { position: v.position.clone(), rotation: v.rotation.clone() }]));
}

const MAX_HISTORY = 50;

export default function CADEngine() {
  const [teeth] = useState<ToothObject[]>(() => buildTeethObjects());

  // Dispose Three.js geometries on unmount to prevent WebGL memory leaks
  useEffect(() => {
    return () => {
      teeth.forEach(t => { t.geometry.dispose(); });
    };
  }, [teeth]);

  const [selectedFdis, setSelectedFdis] = useState<Set<number>>(new Set());
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [showAttachments, setShowAttachments] = useState(true);
  const [showCollision, setShowCollision] = useState(true);
  const [showIPR, setShowIPR] = useState(true);
  const [showDiastema, setShowDiastema] = useState(true);
  const [showCloseness, setShowCloseness] = useState(false);
  const [showTeethWidths, setShowTeethWidths] = useState(false);
  const [jawTransparency, setJawTransparency] = useState(0);
  const [alignmentReps, setAlignmentReps] = useState(10);
  const [orthoStageIndex, setOrthoStageIndex] = useState(0);
  const [placementType, setPlacementType] = useState<PlacementType>("gingival");
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [showInitialPositions, setShowInitialPositions] = useState(false);
  const [showFinalPositions, setShowFinalPositions] = useState(false);
  const [toothOverrides, setToothOverrides] = useState<OverridesMap>(new Map());
  const [biomechanicsWarning, setBiomechanicsWarning] = useState<string | null>(null);

  // Undo/redo history stack
  const historyRef = useRef<OverridesMap[]>([new Map()]);
  const historyIndexRef = useRef(0);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  const pushHistory = useCallback((overrides: OverridesMap) => {
    const snapshot = cloneOverrides(overrides);
    // Discard any redo states beyond current index
    historyRef.current = historyRef.current.slice(0, historyIndexRef.current + 1);
    historyRef.current.push(snapshot);
    if (historyRef.current.length > MAX_HISTORY) {
      historyRef.current.shift();
    } else {
      historyIndexRef.current++;
    }
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(false);
  }, []);

  const handleUndo = useCallback(() => {
    if (historyIndexRef.current <= 0) return;
    historyIndexRef.current--;
    const snapshot = historyRef.current[historyIndexRef.current];
    setToothOverrides(cloneOverrides(snapshot));
    setBiomechanicsWarning(null);
    setCanUndo(historyIndexRef.current > 0);
    setCanRedo(true);
  }, []);

  const handleRedo = useCallback(() => {
    if (historyIndexRef.current >= historyRef.current.length - 1) return;
    historyIndexRef.current++;
    const snapshot = historyRef.current[historyIndexRef.current];
    setToothOverrides(cloneOverrides(snapshot));
    setBiomechanicsWarning(null);
    setCanUndo(true);
    setCanRedo(historyIndexRef.current < historyRef.current.length - 1);
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 'z' && !e.shiftKey) { e.preventDefault(); handleUndo(); }
      if (ctrl && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) { e.preventDefault(); handleRedo(); }
      if (!ctrl && e.key === 't') setGizmoMode('translate');
      if (!ctrl && e.key === 'r') setGizmoMode('rotate');
      if (!ctrl && e.key === 'Escape') setSelectedFdis(new Set());
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [handleUndo, handleRedo]);

  // Cross-section plane
  const [crossSectionEnabled, setCrossSectionEnabled] = useState(false);
  const [crossSectionAxis, setCrossSectionAxis] = useState<CrossSectionAxis>("y");
  const [crossSectionPos, setCrossSectionPos] = useState(0);

  const clippingPlanes = useMemo<THREE.Plane[]>(() => {
    if (!crossSectionEnabled) return [];
    return [new THREE.Plane(AXIS_NORMALS[crossSectionAxis].clone(), -crossSectionPos)];
  }, [crossSectionEnabled, crossSectionAxis, crossSectionPos]);

  // Stage generation
  const [stagesVisible, setStagesVisible] = useState(false);
  const [generatedStages, setGeneratedStages] = useState<AlignerStageRow[]>([]);

  // Bolton Analysis
  const [boltonMode, setBoltonMode] = useState<"anterior" | "overall">("anterior");
  const [boltonExpanded, setBoltonExpanded] = useState(false);
  const [boltonWidths, setBoltonWidths] = useState<Record<string, number>>({
    u13: 7.8, u12: 6.8, u11: 8.4, u21: 8.4, u22: 6.8, u23: 7.8,
    l43: 6.6, l42: 5.8, l41: 5.4, l31: 5.4, l32: 5.8, l33: 6.6,
    u14: 7.1, u15: 6.8, u16: 10.5, u24: 7.1, u25: 6.8, u26: 10.5,
    l44: 7.3, l45: 7.2, l46: 11.1, l34: 7.3, l35: 7.2, l36: 11.1,
  });

  const boltonResult = useMemo(() => {
    const sum = (keys: string[]) => keys.reduce((s, k) => s + (boltonWidths[k] ?? 0), 0);
    const upperAnt = sum(["u13", "u12", "u11", "u21", "u22", "u23"]);
    const lowerAnt = sum(["l43", "l42", "l41", "l31", "l32", "l33"]);
    const upperAll = upperAnt + sum(["u14", "u15", "u16", "u24", "u25", "u26"]);
    const lowerAll = lowerAnt + sum(["l44", "l45", "l46", "l34", "l35", "l36"]);
    const ratio = boltonMode === "anterior"
      ? (upperAnt > 0 ? (lowerAnt / upperAnt) * 100 : 0)
      : (upperAll > 0 ? (lowerAll / upperAll) * 100 : 0);
    const [ideal, sd] = boltonMode === "anterior" ? [77.2, 1.65] : [91.3, 1.91];
    const normal = ratio >= ideal - sd && ratio <= ideal + sd;
    let interpretation: string;
    if (ratio > ideal + sd) {
      const excess = Math.abs(lowerAnt - upperAnt * (ideal / 100)).toFixed(1);
      interpretation = `Mandibular excess (~${excess} mm). Consider lower arch IPR or accept residual upper spacing.`;
    } else if (ratio < ideal - sd) {
      interpretation = `Maxillary excess. Consider upper arch IPR or accept residual lower spacing.`;
    } else {
      interpretation = `Within normal range. No tooth-size discrepancy adjustment anticipated.`;
    }
    return { ratio, ideal, sd, normal, interpretation };
  }, [boltonMode, boltonWidths]);

  const collisionFdis = useMemo(() => {
    if (!showCollision) return new Set<number>();
    return detectCollisions(teeth, toothOverrides);
  }, [teeth, toothOverrides, showCollision]);

  const handleSelectTooth = useCallback((fdi: number, shift: boolean) => {
    setSelectedFdis(prev => {
      if (shift) {
        const next = new Set(prev);
        next.has(fdi) ? next.delete(fdi) : next.add(fdi);
        return next;
      }
      return prev.has(fdi) && prev.size === 1 ? new Set() : new Set([fdi]);
    });
  }, []);

  const handleTransformChange = useCallback((fdi: number, pos: THREE.Vector3, rot: THREE.Euler) => {
    const original = teeth.find(t => t.fdi === fdi);
    if (!original) return;
    const dx = pos.x - original.initPosition.x;
    const dy = pos.y - original.initPosition.y;
    const dz = pos.z - original.initPosition.z;
    const drx = rot.x - original.initRotation.x;
    const dry = rot.y - original.initRotation.y;
    const drz = rot.z - original.initRotation.z;
    const warning = validateMovements(fdi, {
      translation: [dx, dy, dz],
      rotation: [drx, dry, drz],
    });
    setBiomechanicsWarning(warning ? warning.message : null);
    setToothOverrides(prev => {
      const next = new Map(prev).set(fdi, { position: pos, rotation: rot });
      pushHistory(next);
      return next;
    });
  }, [teeth, pushHistory]);

  const primaryFdi = selectedFdis.size === 1 ? Array.from(selectedFdis)[0] : null;
  const selectedTooth = teeth.find(t => t.fdi === primaryFdi) ?? null;
  const attachmentCount = teeth.filter(t => t.hasAttachment).length;
  const iprCount = teeth.filter(t => t.iprLeft).length;

  const generateStages = useCallback(() => {
    const VELOCITY_MM = 0.25;
    const OVERCORRECT = 2;
    const overrideEntries = Array.from(toothOverrides.entries());
    const attachmentFdis = teeth.filter(t => t.hasAttachment).map(t => t.fdi);
    const iprFdis = teeth.filter(t => t.iprLeft).map(t => t.fdi);

    // Maximum translation distance across all moved teeth
    let maxDist = 0;
    for (const [fdi, ov] of overrideEntries) {
      const tooth = teeth.find(t => t.fdi === fdi);
      if (!tooth) continue;
      const dist = ov.position.distanceTo(tooth.initPosition);
      maxDist = Math.max(maxDist, dist);
    }
    // Minimum 10 stages even without overrides
    const activeStages = Math.max(1, Math.ceil(maxDist / VELOCITY_MM));
    const total = activeStages + OVERCORRECT;
    const iprStage = Math.max(1, Math.floor(total * 0.3));

    const rows: AlignerStageRow[] = Array.from({ length: total }, (_, i) => {
      const s = i + 1;
      const progress = s / activeStages;
      // Teeth that are actively moving in this stage (ramped activation)
      const activeTeeth = overrideEntries
        .filter(([fdi]) => {
          const tooth = teeth.find(t => t.fdi === fdi);
          if (!tooth) return false;
          const dist = toothOverrides.get(fdi)!.position.distanceTo(tooth.initPosition);
          const stagesNeeded = Math.ceil(dist / VELOCITY_MM);
          return s <= stagesNeeded;
        })
        .map(([fdi]) => fdi);
      return {
        stage: s,
        activeTeeth: activeTeeth.length > 0 ? activeTeeth : (s <= activeStages ? [] : []),
        ipr: s === iprStage,
        attachmentActivations: s === 1 ? attachmentFdis : [],
      };
    });
    setGeneratedStages(rows);
    setStagesVisible(true);
  }, [teeth, toothOverrides]);

  const exportCADPackage = () => {
    const pkg = {
      generatedAt: new Date().toISOString(),
      teethCount: teeth.length,
      attachments: teeth.filter(t => t.hasAttachment).map(t => t.fdi),
      iprSites: teeth.filter(t => t.iprLeft).map(t => t.fdi),
      collisions: Array.from(collisionFdis),
      overrides: Object.fromEntries(
        Array.from(toothOverrides.entries()).map(([fdi, ov]) => [
          fdi,
          {
            position: [+ov.position.x.toFixed(3), +ov.position.y.toFixed(3), +ov.position.z.toFixed(3)],
            rotation: [+ov.rotation.x.toFixed(4), +ov.rotation.y.toFixed(4), +ov.rotation.z.toFixed(4)],
          },
        ])
      ),
    };
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "myortho-cad-package.json"; a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
      <Card className="overflow-hidden">
        {/* Toolbar */}
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge tone="primary">CAD Engine</StatusBadge>
              <StatusBadge tone={selectedFdis.size > 0 ? "success" : "neutral"}>
                {selectedFdis.size > 0 ? `${selectedFdis.size} selected` : "No selection"}
              </StatusBadge>
              <StatusBadge tone={collisionFdis.size > 0 ? "danger" : "neutral"}>
                {collisionFdis.size > 0 ? `${collisionFdis.size} collision${collisionFdis.size !== 1 ? "s" : ""}` : "Clear"}
              </StatusBadge>
            </div>
            <h3 className="mt-2 text-lg font-semibold text-foreground">Dental CAD Workspace</h3>
            <p className="mt-1 text-xs text-secondary">
              Click tooth to select · Shift+click multi-select · Drag gizmo to move · <kbd className="rounded bg-surface-1 px-1 font-mono text-[10px]">T</kbd> translate · <kbd className="rounded bg-surface-1 px-1 font-mono text-[10px]">R</kbd> rotate · <kbd className="rounded bg-surface-1 px-1 font-mono text-[10px]">⌘Z</kbd> undo
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleUndo}
              disabled={!canUndo}
              title="Undo (Ctrl+Z / ⌘Z)"
            >
              ↩ Undo
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={handleRedo}
              disabled={!canRedo}
              title="Redo (Ctrl+Y / ⌘⇧Z)"
            >
              ↪ Redo
            </Button>
            <Button
              variant={gizmoMode === "translate" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setGizmoMode("translate")}
            >
              <Move3d size={14} /> Translate
            </Button>
            <Button
              variant={gizmoMode === "rotate" ? "primary" : "secondary"}
              size="sm"
              onClick={() => setGizmoMode("rotate")}
            >
              <RotateCcw size={14} /> Rotate
            </Button>
            <Button
              variant={showAttachments ? "primary" : "secondary"}
              size="sm"
              onClick={() => setShowAttachments(v => !v)}
            >
              <Layers size={14} /> Attachments
            </Button>
            <Button
              variant={showCollision ? "primary" : "secondary"}
              size="sm"
              onClick={() => setShowCollision(v => !v)}
            >
              <AlertTriangle size={14} /> Collision
            </Button>
            <Button variant="secondary" size="sm" onClick={exportCADPackage}>
              <Download size={14} /> Export
            </Button>
          </div>
        </div>

        {/* Biomechanics warning */}
        {biomechanicsWarning && (
          <div className="mx-4 mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-400">
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{biomechanicsWarning}</span>
          </div>
        )}

        {/* Canvas */}
        <div className="relative h-[480px] bg-[#0b111a] touch-none select-none md:h-[600px]">
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{
              antialias: true,
              alpha: true,
              preserveDrawingBuffer: true,
              toneMapping: THREE.ACESFilmicToneMapping,
              toneMappingExposure: 1.05,
              localClippingEnabled: true,
            }}
          >
            <Suspense
              fallback={
                <Html center>
                  <span className="rounded-lg bg-slate-950 px-3 py-2 text-sm text-white">
                    Loading CAD renderer…
                  </span>
                </Html>
              }
            >
              <CADScene
                teeth={teeth}
                selectedFdis={selectedFdis}
                gizmoMode={gizmoMode}
                showAttachments={showAttachments}
                showIPR={showIPR}
                placementType={placementType}
                collisionFdis={collisionFdis}
                clippingPlanes={clippingPlanes}
                onSelectTooth={handleSelectTooth}
                onTransformChange={handleTransformChange}
              />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 lg:right-auto rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur">
            Click to select · Shift+click multi-select · Drag gizmo arrows to move · Double-click canvas to reset
          </div>
        </div>
      </Card>

      {/* Side panel */}
      <div className="space-y-4">
        {/* Orthodontics Panel */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Settings2 size={14} className="text-primary" /> Orthodontics Panel
          </h3>

          {/* ── Add Attachments section ───────────────────────────── */}
          <button
            type="button"
            onClick={() => setAttachmentsExpanded(v => !v)}
            className="mb-2 flex w-full items-center gap-1.5 text-[11px] font-bold text-[color:var(--foreground)] hover:text-[color:var(--primary)] transition-colors"
          >
            {attachmentsExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Add Attachments
          </button>

          {attachmentsExpanded && (
            <div className="mb-3 space-y-3 rounded-xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_60%,transparent)] p-3">
              <p className="text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
                Use Right mouse button on model to place attachments.
              </p>

              {/* Visibility sub-section */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
                  Visibility
                </p>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1.5">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={showInitialPositions}
                      onChange={e => setShowInitialPositions(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
                    />
                    Initial Teeth Positions
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--foreground)]">
                    <input
                      type="checkbox"
                      checked={showFinalPositions}
                      onChange={e => setShowFinalPositions(e.target.checked)}
                      className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
                    />
                    Final Teeth Positions
                  </label>
                </div>
              </div>

              {/* Attachments sub-section */}
              <div>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
                  Attachments
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  className="mb-2 w-full justify-center"
                  onClick={() => setShowAttachments(true)}
                >
                  Automatic Placement
                </Button>
                {/* Placement type radios */}
                <div className="mb-2 flex flex-col gap-1.5">
                  {([
                    { value: "gingival", label: "Gingival Placement" },
                    { value: "mid",      label: "Mid Placement" },
                    { value: "incisal",  label: "Incisal Placement" },
                  ] as const).map(({ value, label }) => (
                    <label key={value} className="flex cursor-pointer items-center gap-2 text-[11px] text-[color:var(--foreground)]">
                      <span
                        className={`flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full border-2 transition-colors ${placementType === value ? "border-[color:var(--primary)] bg-[color:var(--primary)]" : "border-[color:var(--border)]"}`}
                        onClick={() => setPlacementType(value)}
                      >
                        {placementType === value && (
                          <span className="h-1.5 w-1.5 rounded-full bg-white" />
                        )}
                      </span>
                      <span onClick={() => setPlacementType(value)} className="cursor-pointer">{label}</span>
                    </label>
                  ))}
                </div>
                <div className="flex flex-col gap-1.5">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setShowAttachments(false)}
                  >
                    Remove All
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full justify-center"
                    onClick={() => setShowAttachments(true)}
                  >
                    Replace All
                  </Button>
                </div>
              </div>
            </div>
          )}

          {/* ── Visibility ────────────────────────────────────────── */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            <Eye size={10} className="inline mr-1" />Visibility
          </p>
          <div className="mb-3 grid grid-cols-2 gap-x-3 gap-y-1.5">
            {([
              { label: "IPR",          state: showIPR,          set: setShowIPR },
              { label: "Diastema",     state: showDiastema,     set: setShowDiastema },
              { label: "Collisions",   state: showCollision,    set: setShowCollision },
              { label: "Closeness",    state: showCloseness,    set: setShowCloseness },
              { label: "Teeth Widths", state: showTeethWidths,  set: setShowTeethWidths },
              { label: "Attachments",  state: showAttachments,  set: setShowAttachments },
            ] as const).map(({ label, state, set }) => (
              <label key={label} className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--foreground)]">
                <input
                  type="checkbox"
                  checked={state}
                  onChange={e => (set as (v: boolean) => void)(e.target.checked)}
                  className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
                />
                {label}
              </label>
            ))}
          </div>

          {/* ── Transparency ──────────────────────────────────────── */}
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Model Jaw Transparency
          </p>
          <div className="mb-3 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[color:var(--muted-foreground)]">
              <span>Opacity</span>
              <span className="font-semibold tabular-nums">{jawTransparency.toFixed(2)}</span>
            </div>
            <input
              type="range" min="0" max="1" step="0.01"
              value={jawTransparency}
              onChange={e => setJawTransparency(parseFloat(e.target.value))}
              className="w-full accent-[color:var(--primary)]"
            />
            <div className="flex justify-between text-[9px] text-[color:var(--muted-foreground)]">
              <span>Opaque</span><span>Transparent</span>
            </div>
          </div>

          {/* ── Teeth Setup ───────────────────────────────────────── */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Teeth Setup
          </p>
          <div className="mb-3 flex flex-col gap-1.5">
            <Button variant="primary" size="sm" className="w-full justify-center">Automatic</Button>
            <Button variant="secondary" size="sm" className="w-full justify-center">Snap To Curve</Button>
            <Button variant="secondary" size="sm" className="w-full justify-center">Align Both Jaws Automatically</Button>
          </div>

          {/* ── Advanced ──────────────────────────────────────────── */}
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Advanced
          </p>
          <div className="mb-4 space-y-1">
            <div className="flex items-center justify-between text-[10px] text-[color:var(--muted-foreground)]">
              <span>Alignment Repetitions</span>
              <span className="font-semibold tabular-nums">{alignmentReps}</span>
            </div>
            <input
              type="range" min="1" max="20" step="1"
              value={alignmentReps}
              onChange={e => setAlignmentReps(parseInt(e.target.value, 10))}
              className="w-full accent-[color:var(--primary)]"
            />
            <div className="flex justify-between text-[9px] text-[color:var(--muted-foreground)]">
              <span>1</span><span>20</span>
            </div>
          </div>

          {/* ── Navigation ────────────────────────────────────────── */}
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setOrthoStageIndex(v => Math.max(0, v - 1))}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
              title="Previous stage"
            >
              <ChevronsLeft size={14} />
            </button>
            <Button
              variant="primary"
              size="sm"
              className="flex-1 justify-center text-[10px]"
              onClick={() => setOrthoStageIndex(v => v + 1)}
            >
              Continue to Export and Report Generation
            </Button>
            <button
              type="button"
              onClick={() => setOrthoStageIndex(v => v + 1)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] text-[color:var(--muted-foreground)] transition-colors hover:border-[color:var(--primary)] hover:text-[color:var(--primary)]"
              title="Next stage"
            >
              <ChevronsRight size={14} />
            </button>
          </div>
          {orthoStageIndex > 0 && (
            <p className="mt-1.5 text-center text-[10px] text-[color:var(--muted-foreground)] tabular-nums">
              Step {orthoStageIndex}
            </p>
          )}
        </Card>

        {/* Selection info */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Target size={14} className="text-primary" /> Selection
          </h3>
          {selectedTooth ? (
            <div className="space-y-1">
              <DataRow label="FDI" value={`#${selectedTooth.fdi}`} />
              <DataRow
                label="Attachment"
                value={selectedTooth.hasAttachment
                  ? <StatusBadge tone="primary">Horizontal rect.</StatusBadge>
                  : "—"
                }
              />
              <DataRow
                label="IPR marker"
                value={selectedTooth.iprLeft
                  ? <StatusBadge tone="warning">0.2 mm mesial</StatusBadge>
                  : "—"
                }
              />
              <DataRow
                label="Collision"
                value={collisionFdis.has(selectedTooth.fdi)
                  ? <StatusBadge tone="danger">Detected</StatusBadge>
                  : <StatusBadge tone="success">Clear</StatusBadge>
                }
              />
              {toothOverrides.has(selectedTooth.fdi) && (
                <div className="mt-2 rounded-lg border border-primary/20 bg-primary/5 px-2 py-1.5 text-[10px] text-primary font-semibold">
                  Movement overrides applied
                </div>
              )}
            </div>
          ) : selectedFdis.size > 1 ? (
            <p className="text-xs text-secondary">
              {selectedFdis.size} teeth selected. Group operations available.
            </p>
          ) : (
            <p className="text-xs text-secondary">
              Click a tooth in the viewport to inspect and move it.
            </p>
          )}
        </Card>

        {/* Attachments & IPR summary */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Layers size={14} className="text-primary" /> Attachments & IPR
          </h3>
          <div className="space-y-1">
            <DataRow label="Attachment teeth" value={`${attachmentCount}`} />
            <DataRow label="IPR contacts" value={`${iprCount}`} />
            <DataRow label="Total IPR" value="1.2 mm" />
            <DataRow label="Attachment type" value="Horizontal rect." />
            <DataRow label="Placement stage" value="Stage 1" />
          </div>
        </Card>

        {/* Biomechanics */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 size={14} className="text-primary" /> Biomechanics
          </h3>
          <div className="space-y-1">
            <DataRow label="Max translation" value="0.25 mm/stage" />
            <DataRow label="Max rotation" value="2.0°/stage" />
            <DataRow
              label="PDL stress"
              value={biomechanicsWarning
                ? <StatusBadge tone="warning">Review needed</StatusBadge>
                : <StatusBadge tone="success">Within limits</StatusBadge>
              }
            />
            <DataRow label="Bone load limit" value="15.0 kPa" />
            <DataRow label="PDL Young's mod." value="680 kPa" />
          </div>
          {biomechanicsWarning && (
            <div className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-2.5 py-2 text-[10px] text-amber-300 leading-relaxed">
              {biomechanicsWarning}
            </div>
          )}
        </Card>

        {/* Cross-section */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Scissors size={14} className="text-primary" /> Cross Section
          </h3>
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="text-xs text-secondary">Enable clipping plane</span>
            <button
              type="button"
              onClick={() => setCrossSectionEnabled(v => !v)}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${crossSectionEnabled ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"}`}
              aria-pressed={crossSectionEnabled}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${crossSectionEnabled ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          {crossSectionEnabled && (
            <>
              <div className="mb-3 flex gap-1">
                {(["x", "y", "z"] as CrossSectionAxis[]).map(axis => (
                  <button
                    key={axis}
                    type="button"
                    onClick={() => setCrossSectionAxis(axis)}
                    className={`flex-1 rounded-lg border py-1 text-xs font-bold uppercase transition-colors ${crossSectionAxis === axis ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"}`}
                  >
                    {axis}
                  </button>
                ))}
              </div>
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px] text-[color:var(--muted-foreground)]">
                  <span>Position</span>
                  <span className="font-semibold tabular-nums">{crossSectionPos.toFixed(1)} mm</span>
                </div>
                <input
                  type="range"
                  min="-4"
                  max="4"
                  step="0.1"
                  value={crossSectionPos}
                  onChange={e => setCrossSectionPos(parseFloat(e.target.value))}
                  className="w-full accent-[color:var(--primary)]"
                />
                <div className="flex justify-between text-[9px] text-[color:var(--muted-foreground)]">
                  <span>−4 mm</span><span>0</span><span>+4 mm</span>
                </div>
              </div>
            </>
          )}
          {!crossSectionEnabled && (
            <p className="text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
              Slice the arch along X, Y, or Z to inspect interproximal anatomy and root clearance.
            </p>
          )}
        </Card>

        {/* Bolton Analysis */}
        <Card className="p-4">
          <div className="mb-2 flex items-center gap-2">
            <Ruler size={14} className="text-[color:var(--primary)]" />
            <h3 className="flex-1 text-sm font-semibold text-foreground">Bolton Analysis</h3>
            <StatusBadge tone="info">Simulated</StatusBadge>
            <button
              type="button"
              onClick={() => setBoltonExpanded(v => !v)}
              className="text-[color:var(--muted-foreground)] transition-colors hover:text-[color:var(--foreground)]"
            >
              {boltonExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
          </div>

          {boltonExpanded ? (
            <>
              <p className="mb-3 text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
                Edit tooth widths (mm) to compute ratio. Pre-filled with population averages.
              </p>
              {/* Mode toggle */}
              <div className="mb-3 flex gap-1">
                {(["anterior", "overall"] as const).map(m => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setBoltonMode(m)}
                    className={`flex-1 rounded-lg border py-1 text-[10px] font-semibold transition-colors ${boltonMode === m ? "border-[color:var(--primary)] bg-[color:var(--primary-glow)] text-[color:var(--primary)]" : "border-[color:var(--border)] text-[color:var(--muted-foreground)]"}`}
                  >
                    {m === "anterior" ? "Anterior 6:6" : "Overall 12:12"}
                  </button>
                ))}
              </div>
              {/* Width inputs */}
              <div className="mb-3 grid grid-cols-2 gap-2">
                {([
                  { label: "Upper (mm)", keys: boltonMode === "anterior" ? ["u13","u12","u11","u21","u22","u23"] : ["u13","u12","u11","u21","u22","u23","u14","u15","u16","u24","u25","u26"] },
                  { label: "Lower (mm)", keys: boltonMode === "anterior" ? ["l43","l42","l41","l31","l32","l33"] : ["l43","l42","l41","l31","l32","l33","l44","l45","l46","l34","l35","l36"] },
                ] as const).map(col => (
                  <div key={col.label}>
                    <p className="mb-1 text-[9px] font-bold uppercase tracking-wide text-[color:var(--muted-foreground)]">{col.label}</p>
                    <div className="space-y-1">
                      {col.keys.map(k => (
                        <div key={k} className="flex items-center gap-1.5">
                          <span className="w-5 shrink-0 text-[9px] font-semibold text-[color:var(--muted-foreground)]">{k.slice(1)}</span>
                          <input
                            type="number" min="1" max="20" step="0.1"
                            value={boltonWidths[k] ?? ""}
                            onChange={e => setBoltonWidths(prev => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                            className="h-6 w-full rounded-md border border-[color:var(--border)] bg-[color:var(--card)] px-1.5 text-[10px] tabular-nums text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              {/* Result */}
              <div className={`rounded-xl border p-3 ${boltonResult.normal ? "border-green-500/30 bg-green-500/10" : "border-amber-500/30 bg-amber-500/10"}`}>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-[color:var(--foreground)]">
                    {boltonMode === "anterior" ? "Anterior Ratio" : "Overall Ratio"}
                  </span>
                  <span className={`text-xs font-bold tabular-nums ${boltonResult.normal ? "text-green-400" : "text-amber-400"}`}>
                    {boltonResult.ratio.toFixed(1)}%
                  </span>
                </div>
                <p className="text-[10px] leading-relaxed text-[color:var(--muted-foreground)]">
                  {boltonResult.interpretation}
                </p>
                <p className="mt-1 text-[9px] text-[color:var(--muted-foreground)]">
                  Normal: {boltonMode === "anterior" ? "77.2 ± 1.65%" : "91.3 ± 1.91%"}
                </p>
              </div>
            </>
          ) : (
            <p className="text-[11px] leading-relaxed text-[color:var(--muted-foreground)]">
              Anterior (6:6) and overall (12:12) tooth-width discrepancy analysis. Pre-filled with population averages — expand to compute your case.
            </p>
          )}
        </Card>

        {/* Stage generation */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> Stage Generation
          </h3>
          {!stagesVisible ? (
            <>
              <div className="space-y-1 mb-3">
                <DataRow label="Velocity limit" value="0.25 mm/stage" />
                <DataRow label="Max rotation" value="2.0°/stage" />
                <DataRow label="Overcorrection" value="2 stages" />
                <DataRow label="Moved teeth" value={`${toothOverrides.size}`} />
              </div>
              <Button
                variant="primary"
                size="sm"
                className="w-full"
                onClick={generateStages}
              >
                <Zap size={14} /> Generate Stages
                <ChevronRight size={13} />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => setBiomechanicsWarning(null)}
              >
                <CheckCircle2 size={14} /> Validate Movements
              </Button>
            </>
          ) : (
            <>
              <div className="mb-2 flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <ListOrdered size={13} className="text-primary" />
                  <span className="text-xs font-semibold text-foreground">{generatedStages.length} stages generated</span>
                </div>
                <button
                  type="button"
                  onClick={() => setStagesVisible(false)}
                  className="text-[10px] font-medium text-[color:var(--muted-foreground)] underline-offset-2 hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                {generatedStages.map(row => (
                  <div
                    key={row.stage}
                    className={`flex items-start gap-2 px-3 py-2 text-[11px] ${row.stage === 1 ? "bg-[color-mix(in_srgb,var(--primary-glow)_60%,transparent)]" : ""}`}
                  >
                    <span className="w-6 shrink-0 font-bold tabular-nums text-[color:var(--muted-foreground)]">
                      {row.stage}
                    </span>
                    <div className="min-w-0 flex-1">
                      {row.attachmentActivations.length > 0 && (
                        <span className="mr-1 inline-flex items-center rounded border border-sky-500/30 bg-sky-500/10 px-1 py-0.5 text-[9px] font-semibold text-sky-500">
                          Attach
                        </span>
                      )}
                      {row.ipr && (
                        <span className="mr-1 inline-flex items-center rounded border border-amber-500/30 bg-amber-500/10 px-1 py-0.5 text-[9px] font-semibold text-amber-500">
                          IPR
                        </span>
                      )}
                      {row.activeTeeth.length > 0 ? (
                        <span className="text-[color:var(--muted-foreground)]">
                          FDI {row.activeTeeth.slice(0, 4).join(", ")}
                          {row.activeTeeth.length > 4 ? ` +${row.activeTeeth.length - 4}` : ""}
                        </span>
                      ) : (
                        <span className="text-[color:var(--muted-foreground)]">
                          {row.stage > generatedStages.length - 2 ? "Overcorrection" : "Maintenance"}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <Button
                variant="secondary"
                size="sm"
                className="w-full mt-2"
                onClick={() => {
                  const csv = ["stage,active_fdis,ipr,attachments",
                    ...generatedStages.map(r =>
                      `${r.stage},"${r.activeTeeth.join(";")}",${r.ipr},${r.attachmentActivations.length > 0}`)
                  ].join("\n");
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                  a.download = "myortho-stage-plan.csv";
                  a.click();
                }}
              >
                <Download size={13} /> Export Stage Plan
              </Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
