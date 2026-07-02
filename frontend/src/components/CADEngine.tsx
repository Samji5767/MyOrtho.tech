"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useFrame, useThree } from "@react-three/fiber";
import {
  ContactShadows, Html, OrbitControls,
  PerspectiveCamera, TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
import { listScans, type ScanRecord } from "@/lib/api/scans";
import {
  AlertTriangle, BarChart3, Camera, CheckCircle2, ChevronDown, ChevronRight, ChevronUp,
  ChevronsLeft, ChevronsRight, Download, Eye, EyeOff, Ghost, Layers, ListOrdered,
  Lock, LockOpen, Move3d, Play, RotateCcw, Ruler, Scissors, Settings2,
  Sliders, Square, SunMedium, Target, Zap,
} from "lucide-react";
import { Button, Card, DataRow, StatusBadge } from "@/components/DesignSystem";
import { validateMovements } from "@/lib/biomechanics/vectorMath";
import { useCasePlanning } from "@/components/CasePlanningContext";
import {
  MM_TO_SCENE,
  buildToothPositions,
  computeOcclusionContacts,
  type OcclusionContact,
} from "@/lib/meshAnalysis";

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToothObject {
  fdi: number;
  geometry: THREE.BufferGeometry;
  initPosition: THREE.Vector3;
  initRotation: THREE.Euler;
  hasAttachment: boolean;
  iprLeft: boolean;
  color: string;
  isMaxilla: boolean; // true = upper arch (maxilla), false = lower (mandible)
}

type GizmoMode = "translate" | "rotate";
type CrossSectionAxis = "x" | "y" | "z";
type PlacementType = "gingival" | "mid" | "incisal";
type ViewMode = "buccal" | "occlusal"; // kept for panel toggle compat
type LightingPreset = "clinical" | "studio" | "bright" | "dark" | "lab" | "xray";
type CameraPresetName = "buccal" | "lingual" | "left" | "right" | "anterior" | "posterior" | "upperOcclusal" | "lowerOcclusal" | "45left" | "45right";
type EnamelMode = "standard" | "translucent" | "xray";
type AttachmentShape = "rectangular" | "ellipsoid" | "beveled";

interface LightConfig {
  ambient: number;
  key: { pos: [number,number,number]; intensity: number };
  fill: { pos: [number,number,number]; intensity: number };
  rim: { pos: [number,number,number]; intensity: number };
  exposure: number;
  toneMapping: THREE.ToneMapping;
}
const LIGHTING_PRESETS: Record<LightingPreset, LightConfig> = {
  clinical: { ambient:0.65, key:{pos:[2,10,6],  intensity:2.2}, fill:{pos:[-5,4,4],  intensity:0.8}, rim:{pos:[0,-3,-6],  intensity:0.25}, exposure:1.05, toneMapping:THREE.ACESFilmicToneMapping },
  studio:   { ambient:0.50, key:{pos:[6,10,4],  intensity:2.6}, fill:{pos:[-8,5,2],  intensity:1.0}, rim:{pos:[-2,-2,-8], intensity:0.40}, exposure:1.10, toneMapping:THREE.ACESFilmicToneMapping },
  bright:   { ambient:1.10, key:{pos:[0,14,4],  intensity:3.2}, fill:{pos:[-5,8,4],  intensity:1.4}, rim:{pos:[0,-2,-4],  intensity:0.60}, exposure:1.25, toneMapping:THREE.ReinhardToneMapping },
  dark:     { ambient:0.18, key:{pos:[3,8,4],   intensity:1.6}, fill:{pos:[-3,2,-4], intensity:0.25},rim:{pos:[0,-2,-6],  intensity:0.10}, exposure:0.85, toneMapping:THREE.ACESFilmicToneMapping },
  lab:      { ambient:0.72, key:{pos:[0,14,2],  intensity:2.4}, fill:{pos:[-8,6,0],  intensity:0.75},rim:{pos:[8,3,-4],   intensity:0.50}, exposure:1.00, toneMapping:THREE.LinearToneMapping },
  xray:     { ambient:0.12, key:{pos:[0,8,0],   intensity:0.8}, fill:{pos:[0,-4,0],  intensity:0.40},rim:{pos:[0,0,-8],   intensity:0.25}, exposure:0.90, toneMapping:THREE.ACESFilmicToneMapping },
};

interface CameraConfig { position:[number,number,number]; up:[number,number,number]; fov:number; label:string; shortcut?:string }
const CAMERA_PRESETS: Record<CameraPresetName, CameraConfig> = {
  buccal:        { position:[0, 0.2, 10],    up:[0,1,0],   fov:36, label:"Buccal",      shortcut:"B" },
  lingual:       { position:[0, 0.2,-10],    up:[0,1,0],   fov:36, label:"Lingual",     shortcut:"N" },
  left:          { position:[-10,0.2,0],     up:[0,1,0],   fov:36, label:"Left",        shortcut:"[" },
  right:         { position:[10, 0.2,0],     up:[0,1,0],   fov:36, label:"Right",       shortcut:"]" },
  anterior:      { position:[0, 0, 9],       up:[0,1,0],   fov:36, label:"Anterior" },
  posterior:     { position:[0, 0,-9],       up:[0,1,0],   fov:36, label:"Posterior" },
  upperOcclusal: { position:[0, 10, 0.4],    up:[0,0,-1],  fov:40, label:"Upper Occ.",  shortcut:"U" },
  lowerOcclusal: { position:[0,-10, 0.4],    up:[0,0, 1],  fov:40, label:"Lower Occ.",  shortcut:"I" },
  "45left":      { position:[-6.5,2.5,7.5],  up:[0,1,0],   fov:36, label:"45° Left" },
  "45right":     { position:[6.5, 2.5,7.5],  up:[0,1,0],   fov:36, label:"45° Right" },
};

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
      isMaxilla: true,
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
      isMaxilla: false,
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

// ─── Color-map helpers ────────────────────────────────────────────────────────

function lerpColor(a: string, b: string, t: number): string {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  const r = Math.round(ar + (br - ar) * t);
  const g = Math.round(ag + (bg - ag) * t);
  const bv = Math.round(ab + (bb - ab) * t);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${bv.toString(16).padStart(2, "0")}`;
}

function severityToColor(severity: number): string {
  // 0 → #4ade80 (green), 0.5 → #facc15 (yellow), 1.0 → #ef4444 (red)
  if (severity <= 0.5) return lerpColor("#4ade80", "#facc15", severity * 2);
  return lerpColor("#facc15", "#ef4444", (severity - 0.5) * 2);
}

// ─── Single tooth mesh ────────────────────────────────────────────────────────

function ToothMesh({
  tooth,
  isSelected,
  isGroupSelected,
  isColliding,
  isHidden,
  isLocked,
  showAttachments,
  showIPR,
  placementType,
  attachmentShape,
  enamelMode,
  jawOpacity,
  clippingPlanes,
  hasAttachmentOverride,
  iprAmountOverride,
  colorMapColor,
  onSelect,
  onMeshMounted,
}: {
  tooth: ToothObject;
  isSelected: boolean;
  isGroupSelected: boolean;
  isColliding: boolean;
  isHidden: boolean;
  isLocked: boolean;
  showAttachments: boolean;
  showIPR: boolean;
  placementType: PlacementType;
  attachmentShape: AttachmentShape;
  enamelMode: EnamelMode;
  jawOpacity: number;
  clippingPlanes: THREE.Plane[];
  hasAttachmentOverride?: boolean;
  iprAmountOverride?: number;
  colorMapColor?: string | null;
  onSelect: (fdi: number, shift: boolean) => void;
  onMeshMounted: (fdi: number, mesh: THREE.Mesh | null) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Expose mesh ref to parent for TransformControls
  useEffect(() => {
    onMeshMounted(tooth.fdi, meshRef.current);
    return () => onMeshMounted(tooth.fdi, null);
  });

  const mat = useMemo(() => {
    const baseOpacity = isHidden ? 0.12 : Math.max(0, 1 - jawOpacity);
    const isTransparent = isHidden || jawOpacity > 0 || enamelMode !== "standard";
    if (enamelMode === "xray") {
      return new THREE.MeshPhysicalMaterial({
        color: "#88ccff", emissive: "#002266", emissiveIntensity: 0.7,
        roughness: 0.1, metalness: 0, transparent: true, opacity: 0.28,
        wireframe: false, side: THREE.DoubleSide,
      });
    }
    const color = isHidden ? "#5a7080"
      : isColliding ? "#ef4444"
      : isSelected ? "#2dd4bf"
      : isGroupSelected ? "#818cf8"
      : (colorMapColor ?? tooth.color);
    return new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.32,
      metalness: 0.0,
      clearcoat: enamelMode === "translucent" ? 0.6 : 0.35,
      clearcoatRoughness: 0.25,
      transmission: enamelMode === "translucent" ? 0.18 : 0,
      thickness: enamelMode === "translucent" ? 0.6 : 0,
      ior: 1.52,
      emissive: isColliding ? "#7f1d1d" : isSelected ? "#0f766e" : isGroupSelected ? "#312e81" : "#000000",
      emissiveIntensity: (isSelected || isGroupSelected || isColliding) && !isHidden ? 0.12 : 0,
      transparent: isTransparent,
      opacity: baseOpacity,
    });
  }, [isSelected, isGroupSelected, isColliding, isHidden, enamelMode, tooth.color, jawOpacity, colorMapColor]);

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
        castShadow={!isHidden}
        receiveShadow
        onPointerDown={(e: ThreeEvent<PointerEvent>) => {
          if (isLocked || isHidden) return;
          e.stopPropagation();
          onSelect(tooth.fdi, e.shiftKey);
        }}
      />
      {isLocked && !isHidden && (
        <Html position={[0, 0.65, 0]} center distanceFactor={8}>
          <span className="pointer-events-none rounded bg-amber-500/90 px-1 py-0.5 text-[9px] font-bold text-white shadow">🔒</span>
        </Html>
      )}
      {/* Attachment — shape and position driven by props; context override takes priority */}
      {showAttachments && (tooth.hasAttachment || hasAttachmentOverride) && !isHidden && (() => {
        const attachY = placementType === "gingival" ? -0.16 : placementType === "mid" ? 0.12 : 0.38;
        const color = enamelMode === "xray" ? "#66aaff" : "#5b8dee";
        const opacity = enamelMode === "xray" ? 0.5 : 1;
        return (
          <mesh position={[0, attachY, 0.04]}>
            {attachmentShape === "ellipsoid"
              ? <sphereGeometry args={[0.1, 12, 8]} />
              : attachmentShape === "beveled"
              ? <cylinderGeometry args={[0.09, 0.11, 0.11, 6]} />
              : <boxGeometry args={[0.22, 0.12, 0.09]} />
            }
            <meshPhysicalMaterial
              color={color} roughness={0.28} metalness={0.08}
              transparent={enamelMode === "xray"} opacity={opacity}
            />
          </mesh>
        );
      })()}
      {/* IPR marker disc — show if tooth has IPR entry (built-in or from context) */}
      {(tooth.iprLeft || iprAmountOverride != null) && (
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.10, 0.10, 0.018, 12]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.75} />
        </mesh>
      )}
      {/* IPR measurement label — prefer context amount, fall back to built-in */}
      {(tooth.iprLeft || iprAmountOverride != null) && showIPR && (() => {
        const displayAmt = iprAmountOverride ?? IPR_AMOUNTS[tooth.fdi];
        if (displayAmt == null) return null;
        return (
          <Html position={[0.52, 0.55, 0]} center distanceFactor={6}>
            <div
              className="pointer-events-none select-none whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-bold shadow"
              style={{
                background: displayAmt > 0.5 ? '#ef4444' : '#fde68a',
                color: displayAmt > 0.5 ? '#fff' : '#1a1000',
                border: `1px solid ${displayAmt > 0.5 ? '#b91c1c' : '#d97706'}`,
              }}
            >
              {displayAmt.toFixed(2)}mm
            </div>
          </Html>
        );
      })()}
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

// ─── Planning offset type (scene units) ──────────────────────────────────────

interface PlanningOffset {
  dx: number; dy: number; dz: number;
  drx: number; dry: number; drz: number;
}

// ─── 3-D scene ────────────────────────────────────────────────────────────────

function CADScene({
  teeth,
  selectedFdis,
  gizmoMode,
  showAttachments,
  showIPR,
  placementType,
  attachmentShape,
  enamelMode,
  cameraPreset,
  lightingPreset,
  showMaxilla,
  showMandible,
  maxillaTransparency,
  mandibleTransparency,
  hiddenFdis,
  lockedFdis,
  isolationMode,
  collisionFdis,
  clippingPlanes,
  ghostArchVisible,
  ghostOpacity,
  contextAttachmentFdis,
  contextIPRMap,
  planningOffsets,
  occlusionContacts,
  showOcclusionContacts,
  showIPROverlay,
  showAlignerShell,
  alignerThickness,
  alignerArch,
  onSelectTooth,
  onTransformChange,
  colorMapColors,
  snapshotEnabled,
  onSnapshotDone,
  archGeometries,
}: {
  teeth: ToothObject[];
  selectedFdis: Set<number>;
  gizmoMode: GizmoMode;
  showAttachments: boolean;
  showIPR: boolean;
  placementType: PlacementType;
  attachmentShape: AttachmentShape;
  enamelMode: EnamelMode;
  cameraPreset: CameraPresetName;
  lightingPreset: LightingPreset;
  showMaxilla: boolean;
  showMandible: boolean;
  maxillaTransparency: number;
  mandibleTransparency: number;
  hiddenFdis: Set<number>;
  lockedFdis: Set<number>;
  isolationMode: boolean;
  collisionFdis: Set<number>;
  clippingPlanes: THREE.Plane[];
  ghostArchVisible: boolean;
  ghostOpacity: number;
  contextAttachmentFdis: Set<number>;
  contextIPRMap: Map<number, number>;
  planningOffsets: Map<number, PlanningOffset>;
  occlusionContacts: OcclusionContact[];
  showOcclusionContacts: boolean;
  showIPROverlay: boolean;
  showAlignerShell: boolean;
  alignerThickness: number;
  alignerArch: "upper" | "lower" | "both";
  onSelectTooth: (fdi: number, shift: boolean) => void;
  onTransformChange: (fdi: number, pos: THREE.Vector3, rot: THREE.Euler) => void;
  colorMapColors: Map<number, string>;
  snapshotEnabled: boolean;
  onSnapshotDone: () => void;
  archGeometries: { upper: THREE.BufferGeometry | null; lower: THREE.BufferGeometry | null };
}) {
  const meshRegistry = useRef<Map<number, THREE.Mesh>>(new Map());
  const [activeMesh, setActiveMesh] = useState<THREE.Mesh | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const { gl, camera } = useThree();
  const orbitRef = useRef<any>(null);

  // ── Animated camera transitions ───────────────────────────────────────────
  const prevPreset = useRef<CameraPresetName | null>(null);
  const camAnimating = useRef(false);
  const camTarget = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS[cameraPreset].position), [cameraPreset]);
  const camUpTarget = useMemo(() => new THREE.Vector3(...CAMERA_PRESETS[cameraPreset].up), [cameraPreset]);

  useEffect(() => {
    if (prevPreset.current !== null && prevPreset.current !== cameraPreset) {
      camAnimating.current = true;
    }
    prevPreset.current = cameraPreset;
  }, [cameraPreset]);

  useFrame(() => {
    if (!camAnimating.current) return;
    camera.position.lerp(camTarget, 0.09);
    camera.up.lerp(camUpTarget, 0.09);
    if (orbitRef.current) orbitRef.current.update();
    if (camera.position.distanceTo(camTarget) < 0.05) {
      camera.position.copy(camTarget);
      camera.up.copy(camUpTarget);
      camAnimating.current = false;
    }
  });

  // ── Lighting preset sync ──────────────────────────────────────────────────
  const lc = LIGHTING_PRESETS[lightingPreset];
  useEffect(() => {
    gl.toneMappingExposure = lc.exposure;
  }, [gl, lc]);

  const primaryFdi = selectedFdis.size === 1 ? Array.from(selectedFdis)[0] : null;

  const handleMeshMounted = useCallback((fdi: number, mesh: THREE.Mesh | null) => {
    if (mesh) meshRegistry.current.set(fdi, mesh);
    else meshRegistry.current.delete(fdi);
  }, []);

  useEffect(() => {
    if (primaryFdi != null) {
      const m = meshRegistry.current.get(primaryFdi);
      setActiveMesh(m ?? null);
    } else {
      setActiveMesh(null);
    }
  }, [primaryFdi]);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  // In isolation mode, only selected teeth are fully visible; rest are ghost
  const visibleTeeth = teeth.filter(t => t.isMaxilla ? showMaxilla : showMandible);

  const gingivaColor = lightingPreset === "xray" ? "#112244" : lightingPreset === "dark" ? "#7a2d3a" : "#c8556a";
  const gingivaMandColor = lightingPreset === "xray" ? "#0d1e3a" : lightingPreset === "dark" ? "#6a2030" : "#b84e62";

  // ── Workspace snapshot ────────────────────────────────────────────────────
  useEffect(() => {
    if (!snapshotEnabled) return;
    const id = requestAnimationFrame(() => {
      const dataUrl = gl.domElement.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "myortho-snapshot.png";
      a.click();
      onSnapshotDone();
    });
    return () => cancelAnimationFrame(id);
  }, [snapshotEnabled, gl, onSnapshotDone]);

  return (
    <>
      {/* Initial camera position — animated to by useFrame on preset change */}
      <PerspectiveCamera makeDefault fov={CAMERA_PRESETS[cameraPreset].fov} position={[0, 0.2, 10]} up={[0, 1, 0]} />

      {/* Lighting — driven by preset */}
      <ambientLight intensity={lc.ambient} />
      <directionalLight
        position={lc.key.pos}
        intensity={lc.key.intensity}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-bias={-0.0005}
      />
      <directionalLight position={lc.fill.pos} intensity={lc.fill.intensity} />
      <directionalLight position={lc.rim.pos} intensity={lc.rim.intensity} />

      {/* X-Ray mode: volumetric sphere for backlit effect */}
      {lightingPreset === "xray" && (
        <mesh>
          <sphereGeometry args={[25, 16, 8]} />
          <meshBasicMaterial color="#001133" side={THREE.BackSide} />
        </mesh>
      )}

      {/* Maxilla gingival base */}
      {showMaxilla && (
        <mesh position={[0, 0.18, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.05, 0.52, 10, 28, Math.PI]} />
          <meshPhysicalMaterial
            color={gingivaColor} roughness={0.68} metalness={0}
            transparent={maxillaTransparency > 0 || lightingPreset === "xray"}
            opacity={lightingPreset === "xray" ? 0.15 : Math.max(0, 1 - maxillaTransparency)}
          />
        </mesh>
      )}

      {/* Mandible gingival base */}
      {showMandible && (
        <mesh position={[0, -0.18, 0.7]} rotation={[-Math.PI / 2, Math.PI, 0]}>
          <torusGeometry args={[1.95, 0.50, 10, 28, Math.PI]} />
          <meshPhysicalMaterial
            color={gingivaMandColor} roughness={0.68} metalness={0}
            transparent={mandibleTransparency > 0 || lightingPreset === "xray"}
            opacity={lightingPreset === "xray" ? 0.15 : Math.max(0, 1 - mandibleTransparency)}
          />
        </mesh>
      )}

      {/* Arch scan meshes — real patient geometry when scan data is available.
          Geometry is centered and scaled to MM_TO_SCENE; registration to
          planning coordinates is approximate. Not for clinical measurements. */}
      {archGeometries.upper && showMaxilla && (
        <mesh geometry={archGeometries.upper}>
          <meshPhysicalMaterial
            color={lightingPreset === "xray" ? "#88aacc" : "#e8d0bc"}
            roughness={0.60}
            metalness={0}
            transparent
            opacity={lightingPreset === "xray" ? 0.22 : Math.max(0.08, 1 - maxillaTransparency)}
            clippingPlanes={clippingPlanes}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {archGeometries.lower && showMandible && (
        <mesh geometry={archGeometries.lower}>
          <meshPhysicalMaterial
            color={lightingPreset === "xray" ? "#7799bb" : "#d9c4af"}
            roughness={0.60}
            metalness={0}
            transparent
            opacity={lightingPreset === "xray" ? 0.22 : Math.max(0.08, 1 - mandibleTransparency)}
            clippingPlanes={clippingPlanes}
            side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {/* Ghost arch — original positions rendered transparently */}
      {ghostArchVisible && visibleTeeth.map(tooth => (
        <mesh
          key={`ghost_${tooth.fdi}`}
          geometry={tooth.geometry}
          position={tooth.initPosition}
          rotation={tooth.initRotation}
          renderOrder={-1}
        >
          <meshPhysicalMaterial
            color="#88aacc"
            transparent
            opacity={ghostOpacity}
            depthWrite={false}
            roughness={0.5}
            metalness={0}
          />
        </mesh>
      ))}

      {/* Planning target positions — wireframe overlay when movement is set */}
      {Array.from(planningOffsets.entries()).map(([fdi, off]) => {
        const tooth = visibleTeeth.find(t => t.fdi === fdi);
        if (!tooth) return null;
        return (
          <mesh
            key={`plan_${fdi}`}
            geometry={tooth.geometry}
            position={[
              tooth.initPosition.x + off.dx,
              tooth.initPosition.y + off.dy,
              tooth.initPosition.z + off.dz,
            ]}
            rotation={[
              tooth.initRotation.x + off.drx,
              tooth.initRotation.y + off.dry,
              tooth.initRotation.z + off.drz,
            ]}
          >
            <meshBasicMaterial color="#22d3ee" wireframe transparent opacity={0.55} />
          </mesh>
        );
      })}

      {/* Occlusion contact spheres — color-coded by proximity */}
      {showOcclusionContacts && occlusionContacts
        .filter((c) => c.contactType !== "none")
        .map((c, i) => {
          const color = c.contactType === "heavy" ? "#ef4444"
            : c.contactType === "light" ? "#f97316"
            : "#eab308";
          return (
            <mesh key={`occ_${i}`} position={[c.midpoint.x, c.midpoint.y, c.midpoint.z]}>
              <sphereGeometry args={[0.08, 8, 6]} />
              <meshBasicMaterial color={color} transparent opacity={0.85} />
            </mesh>
          );
        })
      }

      {/* IPR overlay — enlarged colored discs at planned IPR sites */}
      {showIPROverlay && Array.from(contextIPRMap.entries()).map(([fdiA, amount]) => {
        const tooth = visibleTeeth.find((t) => t.fdi === fdiA);
        if (!tooth) return null;
        const color = amount >= 0.5 ? "#ef4444" : amount >= 0.3 ? "#f97316" : "#22c55e";
        const pos = tooth.initPosition;
        return (
          <mesh
            key={`ipr_ovl_${fdiA}`}
            position={[pos.x + 0.42, pos.y, pos.z]}
            rotation={[0, 0, Math.PI / 2]}
          >
            <cylinderGeometry args={[0.18, 0.18, 0.03, 16]} />
            <meshBasicMaterial color={color} transparent opacity={0.78} />
          </mesh>
        );
      })}

      {/* Aligner shell — manufacturing geometry preview (NOT FOR CLINICAL USE) */}
      {showAlignerShell && (alignerArch === "upper" || alignerArch === "both") && showMaxilla && (
        <mesh position={[0, 0.18, -0.7]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[2.05, 0.58 + alignerThickness * MM_TO_SCENE, 10, 28, Math.PI]} />
          <meshPhysicalMaterial
            color="#88bbff" transparent opacity={0.22}
            roughness={0.05} metalness={0} side={THREE.DoubleSide}
          />
        </mesh>
      )}
      {showAlignerShell && (alignerArch === "lower" || alignerArch === "both") && showMandible && (
        <mesh position={[0, -0.18, 0.7]} rotation={[-Math.PI / 2, Math.PI, 0]}>
          <torusGeometry args={[1.95, 0.56 + alignerThickness * MM_TO_SCENE, 10, 28, Math.PI]} />
          <meshPhysicalMaterial
            color="#88bbff" transparent opacity={0.22}
            roughness={0.05} metalness={0} side={THREE.DoubleSide}
          />
        </mesh>
      )}

      {visibleTeeth.map(tooth => {
        const isHidden = hiddenFdis.has(tooth.fdi) ||
          (isolationMode && selectedFdis.size > 0 && !selectedFdis.has(tooth.fdi));
        const isLocked = lockedFdis.has(tooth.fdi);
        const contextHasAttach = contextAttachmentFdis.has(tooth.fdi);
        const contextIPRAmount = contextIPRMap.get(tooth.fdi);
        return (
          <ToothMesh
            key={tooth.fdi}
            tooth={tooth}
            isSelected={selectedFdis.size === 1 && selectedFdis.has(tooth.fdi)}
            isGroupSelected={selectedFdis.size > 1 && selectedFdis.has(tooth.fdi)}
            isColliding={collisionFdis.has(tooth.fdi)}
            isHidden={isHidden}
            isLocked={isLocked}
            showAttachments={showAttachments}
            showIPR={showIPR}
            placementType={placementType}
            attachmentShape={attachmentShape}
            enamelMode={enamelMode}
            jawOpacity={tooth.isMaxilla ? maxillaTransparency : mandibleTransparency}
            clippingPlanes={clippingPlanes}
            hasAttachmentOverride={contextHasAttach}
            iprAmountOverride={contextIPRAmount}
            colorMapColor={colorMapColors.get(tooth.fdi) ?? null}
            onSelect={onSelectTooth}
            onMeshMounted={handleMeshMounted}
          />
        );
      })}

      {activeMesh && !lockedFdis.has(primaryFdi ?? -1) && (
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

      <ContactShadows
        opacity={lightingPreset === "dark" ? 0.45 : lightingPreset === "xray" ? 0 : 0.28}
        scale={14} blur={2.4} far={4} position={[0, -1.1, 0]}
      />
      <OrbitControls
        ref={orbitRef}
        makeDefault
        enabled={!isDragging}
        enableDamping
        dampingFactor={0.08}
        minDistance={1.5}
        maxDistance={80}
        minPolarAngle={0.2}
        maxPolarAngle={Math.PI - 0.2}
      />
      <gridHelper
        args={[14, 28,
          lightingPreset === "xray" ? "#112244" : "#486072",
          lightingPreset === "xray" ? "#08102a" : "#253342"
        ]}
        position={[0, -1.1, 0]}
      />
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
  const { state, dispatch } = useCasePlanning();

  // Dispose Three.js geometries on unmount to prevent WebGL memory leaks
  useEffect(() => {
    return () => {
      teeth.forEach(t => { t.geometry.dispose(); });
    };
  }, [teeth]);

  // ── Context-derived planning data ──────────────────────────────────────────
  const contextAttachmentFdis = useMemo<Set<number>>(() => {
    return new Set(state.attachments.map((a) => a.fdi));
  }, [state.attachments]);

  const contextIPRMap = useMemo<Map<number, number>>(() => {
    const m = new Map<number, number>();
    state.iprEntries.forEach((e) => { m.set(e.toothA, e.amount); });
    return m;
  }, [state.iprEntries]);

  const planningOffsets = useMemo<Map<number, PlanningOffset>>(() => {
    const DEG_TO_RAD = Math.PI / 180;
    const m = new Map<number, PlanningOffset>();
    Object.entries(state.movements).forEach(([fdiStr, mov]) => {
      const fdi = Number(fdiStr);
      if (mov.tx === 0 && mov.ty === 0 && mov.tz === 0 && mov.tip === 0 && mov.torque === 0 && mov.rotation === 0) return;
      m.set(fdi, {
        dx: mov.tx * MM_TO_SCENE,
        dy: mov.tz * MM_TO_SCENE,
        dz: mov.ty * MM_TO_SCENE,
        drx: mov.tip * DEG_TO_RAD,
        dry: mov.rotation * DEG_TO_RAD,
        drz: mov.torque * DEG_TO_RAD,
      });
    });
    return m;
  }, [state.movements]);

  const [selectedFdis, setSelectedFdis] = useState<Set<number>>(new Set());
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [showAttachments, setShowAttachments] = useState(true);
  const [showCollision, setShowCollision] = useState(true);
  const [showIPR, setShowIPR] = useState(true);
  const [showDiastema, setShowDiastema] = useState(true);
  const [showCloseness, setShowCloseness] = useState(false);
  const [showTeethWidths, setShowTeethWidths] = useState(false);
  const [alignmentReps, setAlignmentReps] = useState(10);
  const [orthoStageIndex, setOrthoStageIndex] = useState(0);
  const [placementType, setPlacementType] = useState<PlacementType>("gingival");
  const [attachmentsExpanded, setAttachmentsExpanded] = useState(true);
  const [showInitialPositions, setShowInitialPositions] = useState(false);
  const [showFinalPositions, setShowFinalPositions] = useState(false);
  // Enterprise rendering & camera
  const [cameraPreset, setCameraPreset] = useState<CameraPresetName>("buccal");
  const [lightingPreset, setLightingPreset] = useState<LightingPreset>("clinical");
  const [enamelMode, setEnamelMode] = useState<EnamelMode>("standard");
  const [attachmentShape, setAttachmentShape] = useState<AttachmentShape>("rectangular");
  // Tooth visibility/lock
  const [hiddenFdis, setHiddenFdis] = useState<Set<number>>(new Set());
  const [lockedFdis, setLockedFdis] = useState<Set<number>>(new Set());
  const [isolationMode, setIsolationMode] = useState(false);
  // Jaw controls
  const [showMaxilla, setShowMaxilla] = useState(true);
  const [showMandible, setShowMandible] = useState(true);
  const [maxillaTransparency, setMaxillaTransparency] = useState(0);
  const [mandibleTransparency, setMandibleTransparency] = useState(0);
  const [toothOverrides, setToothOverrides] = useState<OverridesMap>(new Map());
  const [biomechanicsWarning, setBiomechanicsWarning] = useState<string | null>(null);
  // Feature A: Color map
  const [colorMapEnabled, setColorMapEnabled] = useState(false);
  // Feature B: Workspace snapshot
  const [snapshotEnabled, setSnapshotEnabled] = useState(false);
  // Feature C: Stage animation
  const [isAnimating, setIsAnimating] = useState(false);
  const [animStageIndex, setAnimStageIndex] = useState(0);
  const animTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Arch scan meshes — loaded from the backend when a caseId is available.
  // These are real patient STL scans (full arch geometry), not per-tooth meshes.
  const [archGeometries, setArchGeometries] = useState<{
    upper: THREE.BufferGeometry | null;
    lower: THREE.BufferGeometry | null;
  }>({ upper: null, lower: null });

  const occlusionContacts = useMemo<OcclusionContact[]>(() => {
    const positions = buildToothPositions(teeth, toothOverrides);
    return computeOcclusionContacts(positions);
  }, [teeth, toothOverrides]);

  // Feature A: per-tooth movement data for color map legend + summary table
  const colorMapData = useMemo<Map<number, { movementMm: number; rotDeg: number; severity: number; color: string }>>(() => {
    if (!colorMapEnabled) return new Map();
    const m = new Map<number, { movementMm: number; rotDeg: number; severity: number; color: string }>();
    planningOffsets.forEach((off, fdi) => {
      const dist = Math.sqrt(off.dx * off.dx + off.dy * off.dy + off.dz * off.dz);
      const movementMm = dist / MM_TO_SCENE;
      const rotDeg = Math.sqrt(off.drx * off.drx + off.dry * off.dry + off.drz * off.drz) * (180 / Math.PI);
      const severity = Math.min(1, Math.max(0, Math.max(movementMm / 3.0, rotDeg / 20.0)));
      m.set(fdi, { movementMm, rotDeg, severity, color: severityToColor(severity) });
    });
    return m;
  }, [colorMapEnabled, planningOffsets]);

  // Feature A: per-tooth color map (all teeth; unmoved teeth = green severity 0)
  const colorMapColors = useMemo<Map<number, string>>(() => {
    if (!colorMapEnabled) return new Map();
    const m = new Map<number, string>();
    teeth.forEach(tooth => {
      const data = colorMapData.get(tooth.fdi);
      m.set(tooth.fdi, data ? data.color : severityToColor(0));
    });
    return m;
  }, [colorMapEnabled, teeth, colorMapData]);

  // Load arch scan meshes when a caseId is available.
  // Each scan STL is fetched as a binary ArrayBuffer and parsed with STLLoader.
  // The geometry is centered and scaled to scene units (MM_TO_SCENE = 0.1).
  // Registration to the planning coordinate system is approximate.
  useEffect(() => {
    const caseId = state.caseId;
    if (!caseId) return;
    let cancelled = false;

    async function loadArchScan(scan: ScanRecord): Promise<THREE.BufferGeometry | null> {
      if (!['stl'].includes(scan.fileFormat.toLowerCase())) return null;
      try {
        const res = await fetch(`/api/cases/${caseId}/scans/${scan.id}/file`, { credentials: 'include' });
        if (!res.ok) return null;
        const buffer = await res.arrayBuffer();
        const geom = new STLLoader().parse(buffer);
        geom.computeVertexNormals();
        geom.center();
        geom.scale(MM_TO_SCENE, MM_TO_SCENE, MM_TO_SCENE);
        return geom;
      } catch {
        return null;
      }
    }

    (async () => {
      try {
        const scans = await listScans(caseId);
        const upperScan = scans.find(s => s.jawType === 'maxillary');
        const lowerScan = scans.find(s => s.jawType === 'mandibular');
        const [upper, lower] = await Promise.all([
          upperScan ? loadArchScan(upperScan) : Promise.resolve(null),
          lowerScan ? loadArchScan(lowerScan) : Promise.resolve(null),
        ]);
        if (!cancelled) setArchGeometries({ upper, lower });
      } catch {
        // Scan list unavailable — leave placeholder geometry active
      }
    })();

    return () => { cancelled = true; };
  }, [state.caseId]);

  // Dispose arch geometries when they change or the component unmounts
  useEffect(() => {
    return () => {
      archGeometries.upper?.dispose();
      archGeometries.lower?.dispose();
    };
  }, [archGeometries]);

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
      // Camera preset shortcuts
      if (!ctrl && e.key === 'b') setCameraPreset('buccal');
      if (!ctrl && e.key === 'n') setCameraPreset('lingual');
      if (!ctrl && e.key === '[') setCameraPreset('left');
      if (!ctrl && e.key === ']') setCameraPreset('right');
      if (!ctrl && e.key === 'u') setCameraPreset('upperOcclusal');
      if (!ctrl && e.key === 'i') setCameraPreset('lowerOcclusal');
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

  const handleHideSelected = useCallback(() => {
    if (selectedFdis.size === 0) return;
    setHiddenFdis(prev => {
      const next = new Set(prev);
      selectedFdis.forEach(fdi => next.has(fdi) ? next.delete(fdi) : next.add(fdi));
      return next;
    });
  }, [selectedFdis]);

  const handleLockSelected = useCallback(() => {
    if (selectedFdis.size === 0) return;
    setLockedFdis(prev => {
      const next = new Set(prev);
      selectedFdis.forEach(fdi => next.has(fdi) ? next.delete(fdi) : next.add(fdi));
      return next;
    });
  }, [selectedFdis]);

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

  // Feature C: animation through generated stages
  const handleStartAnimation = useCallback(() => {
    if (generatedStages.length === 0) return;
    setAnimStageIndex(0);
    setIsAnimating(true);
    animTimerRef.current = setInterval(() => {
      setAnimStageIndex(prev => {
        const next = prev + 1;
        if (next >= generatedStages.length) {
          if (animTimerRef.current) clearInterval(animTimerRef.current);
          setIsAnimating(false);
          return prev;
        }
        return next;
      });
    }, 800);
  }, [generatedStages.length]);

  const handleStopAnimation = useCallback(() => {
    if (animTimerRef.current) clearInterval(animTimerRef.current);
    setIsAnimating(false);
  }, []);

  // Clean up animation timer on unmount
  useEffect(() => {
    return () => {
      if (animTimerRef.current) clearInterval(animTimerRef.current);
    };
  }, []);

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
      {/* Geometry status — shown because teeth are rendered as scaled-sphere placeholders,
          not real segmented meshes. Real geometry requires AI segmentation results.
          If scan STL files have been uploaded, arch meshes are shown as reference geometry. */}
      <div className={`col-span-full rounded-lg border px-4 py-3 flex items-start gap-2 ${
        archGeometries.upper || archGeometries.lower
          ? "border-blue-500/30 bg-blue-500/5"
          : "border-amber-500/30 bg-amber-500/5"
      }`}>
        <AlertTriangle size={14} className={`mt-0.5 shrink-0 ${archGeometries.upper || archGeometries.lower ? "text-blue-400" : "text-amber-400"}`} />
        <p className={`text-xs leading-relaxed ${archGeometries.upper || archGeometries.lower ? "text-blue-300" : "text-amber-300"}`}>
          {archGeometries.upper || archGeometries.lower ? (
            <>
              <span className="font-semibold">Scan geometry loaded.</span>{" "}
              Arch scan mesh{archGeometries.upper && archGeometries.lower ? "es" : ""} loaded
              ({[archGeometries.upper && "maxillary", archGeometries.lower && "mandibular"].filter(Boolean).join(", ")}).
              Geometry is centered to origin — registration to planning coordinates is approximate.
              Individual tooth meshes remain sphere approximations; real per-tooth geometry requires AI segmentation.
              Do not use for clinical measurements or manufacturing export.
            </>
          ) : (
            <>
              <span className="font-semibold">Placeholder geometry.</span>{" "}
              Tooth meshes are scaled-sphere approximations — not real tooth geometry.
              Real per-tooth meshes require completed AI segmentation (MODEL_CHECKPOINT not loaded).
              Upload a scan STL to display arch reference geometry.
              Movement planning and collision detection operate on these placeholders only.
              Do not use for clinical measurements or manufacturing export.
            </>
          )}
        </p>
      </div>

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
            <Button
              variant={state.showGhostArch ? "primary" : "secondary"}
              size="sm"
              onClick={() => dispatch({ type: "TOGGLE_GHOST_ARCH" })}
              title="Toggle ghost arch (original position overlay)"
            >
              <Ghost size={14} /> Ghost
            </Button>
            <Button
              variant={colorMapEnabled ? "primary" : "secondary"}
              size="sm"
              onClick={() => setColorMapEnabled(v => !v)}
              title="Toggle movement color map"
            >
              <BarChart3 size={14} /> Color Map
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setSnapshotEnabled(true)}
              title="Download snapshot of current view"
            >
              <Camera size={14} /> Snapshot
            </Button>
          </div>
        </div>

        {/* ── Enterprise toolbar row 2: camera presets + lighting + enamel + tooth ops ── */}
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2">
          {/* Camera preset bar */}
          <div className="flex gap-0.5 rounded-xl border border-[color:var(--border)] p-0.5">
            {(Object.entries(CAMERA_PRESETS) as [CameraPresetName, CameraConfig][]).map(([key, cfg]) => (
              <button
                key={key}
                type="button"
                title={cfg.shortcut ? `${cfg.label} (${cfg.shortcut})` : cfg.label}
                onClick={() => setCameraPreset(key)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold transition-colors ${cameraPreset === key ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
              >
                {cfg.label}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Lighting preset */}
          <div className="flex items-center gap-1.5">
            <SunMedium size={13} className="text-muted-foreground" />
            <select
              value={lightingPreset}
              onChange={e => setLightingPreset(e.target.value as LightingPreset)}
              className="h-7 rounded-lg border border-[color:var(--border)] bg-[color:var(--card)] px-2 text-[11px] text-[color:var(--foreground)] focus:border-[color:var(--primary)] focus:outline-none"
            >
              {(["clinical", "studio", "bright", "dark", "lab", "xray"] as LightingPreset[]).map(p => (
                <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Enamel mode */}
          <div className="flex gap-0.5 rounded-xl border border-[color:var(--border)] p-0.5">
            {(["standard", "translucent", "xray"] as EnamelMode[]).map(m => (
              <button
                key={m}
                type="button"
                onClick={() => setEnamelMode(m)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${enamelMode === m ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
              >
                {m}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Attachment shape */}
          <div className="flex gap-0.5 rounded-xl border border-[color:var(--border)] p-0.5">
            {(["rectangular", "ellipsoid", "beveled"] as AttachmentShape[]).map(s => (
              <button
                key={s}
                type="button"
                onClick={() => setAttachmentShape(s)}
                className={`rounded-lg px-2 py-1 text-[10px] font-semibold capitalize transition-colors ${attachmentShape === s ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)] hover:text-[color:var(--foreground)]"}`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="h-5 w-px bg-border" />

          {/* Hide / Lock / Isolate */}
          <Button
            variant={selectedFdis.size > 0 && Array.from(selectedFdis).some(f => hiddenFdis.has(f)) ? "primary" : "secondary"}
            size="sm"
            onClick={handleHideSelected}
            disabled={selectedFdis.size === 0}
            title="Toggle hide selected teeth (ghost)"
          >
            <EyeOff size={13} /> Hide
          </Button>
          <Button
            variant={selectedFdis.size > 0 && Array.from(selectedFdis).some(f => lockedFdis.has(f)) ? "primary" : "secondary"}
            size="sm"
            onClick={handleLockSelected}
            disabled={selectedFdis.size === 0}
            title="Toggle lock selected teeth (no gizmo)"
          >
            <Lock size={13} /> Lock
          </Button>
          <Button
            variant={isolationMode ? "primary" : "secondary"}
            size="sm"
            onClick={() => setIsolationMode(v => !v)}
            title="Isolate: show only selected teeth"
          >
            <Sliders size={13} /> Isolate
          </Button>
          {(hiddenFdis.size > 0 || lockedFdis.size > 0 || isolationMode) && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setHiddenFdis(new Set()); setLockedFdis(new Set()); setIsolationMode(false); }}
              title="Clear all hide/lock/isolate"
            >
              <LockOpen size={13} /> Clear
            </Button>
          )}
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
                attachmentShape={attachmentShape}
                enamelMode={enamelMode}
                cameraPreset={cameraPreset}
                lightingPreset={lightingPreset}
                showMaxilla={showMaxilla}
                showMandible={showMandible}
                maxillaTransparency={maxillaTransparency}
                mandibleTransparency={mandibleTransparency}
                hiddenFdis={hiddenFdis}
                lockedFdis={lockedFdis}
                isolationMode={isolationMode}
                collisionFdis={collisionFdis}
                clippingPlanes={clippingPlanes}
                ghostArchVisible={state.showGhostArch}
                ghostOpacity={state.ghostOpacity}
                contextAttachmentFdis={contextAttachmentFdis}
                contextIPRMap={contextIPRMap}
                planningOffsets={planningOffsets}
                occlusionContacts={occlusionContacts}
                showOcclusionContacts={state.showOcclusionContacts}
                showIPROverlay={state.showIPROverlay}
                showAlignerShell={state.showAlignerShell}
                alignerThickness={state.alignerThickness}
                alignerArch={state.alignerArch}
                onSelectTooth={handleSelectTooth}
                onTransformChange={handleTransformChange}
                colorMapColors={colorMapColors}
                snapshotEnabled={snapshotEnabled}
                onSnapshotDone={() => setSnapshotEnabled(false)}
                archGeometries={archGeometries}
              />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute bottom-4 left-4 right-4 lg:right-auto rounded-2xl border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur">
            Click to select · Shift+click multi-select · Drag gizmo arrows to move · Double-click canvas to reset
          </div>
          {/* Color map legend */}
          {colorMapEnabled && (
            <div className="pointer-events-none absolute bottom-16 left-4 rounded-xl border border-white/10 bg-slate-950/80 p-2.5 text-[10px] text-white backdrop-blur">
              <p className="mb-1.5 font-bold text-slate-300 text-[10px]">Movement Severity</p>
              {[
                { label: "High (≥3 mm)", color: "#ef4444" },
                { label: "Med (~1.5 mm)", color: "#facc15" },
                { label: "Low (≤0 mm)", color: "#4ade80" },
                { label: "None (unmoved)", color: "#4ade80" },
              ].map((s, i) => (
                <div key={i} className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-block h-3 w-3 rounded-sm shrink-0" style={{ background: s.color }} />
                  <span className="text-slate-300">{s.label}</span>
                </div>
              ))}
            </div>
          )}
          {/* Animation progress bar */}
          {isAnimating && generatedStages.length > 0 && (
            <div className="absolute bottom-0 left-0 right-0 h-1 bg-slate-800">
              <div
                className="h-full bg-primary transition-all duration-700"
                style={{ width: `${((animStageIndex + 1) / generatedStages.length) * 100}%` }}
              />
            </div>
          )}
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
            {/* Context-driven overlays */}
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--foreground)]">
              <input
                type="checkbox"
                checked={state.showOcclusionContacts}
                onChange={() => dispatch({ type: "TOGGLE_OCCLUSION_CONTACTS" })}
                className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
              />
              Occ. Contacts
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-[11px] text-[color:var(--foreground)]">
              <input
                type="checkbox"
                checked={state.showIPROverlay}
                onChange={() => dispatch({ type: "TOGGLE_IPR_OVERLAY" })}
                className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
              />
              IPR Overlay
            </label>
          </div>

          {/* ── Jaw Visibility & Transparency ────────────────────── */}
          <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">
            Jaw Controls
          </p>
          <div className="mb-3 space-y-3 rounded-xl border border-[color:var(--border)] bg-[color-mix(in_srgb,var(--card)_60%,transparent)] p-3">
            {/* Maxilla */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[color:var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={showMaxilla}
                    onChange={e => setShowMaxilla(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
                  />
                  Maxilla (Upper)
                </label>
                <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                  {maxillaTransparency.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={maxillaTransparency}
                onChange={e => setMaxillaTransparency(parseFloat(e.target.value))}
                disabled={!showMaxilla}
                className="w-full accent-[color:var(--primary)] disabled:opacity-40"
              />
            </div>
            {/* Mandible */}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="flex cursor-pointer items-center gap-1.5 text-[11px] font-semibold text-[color:var(--foreground)]">
                  <input
                    type="checkbox"
                    checked={showMandible}
                    onChange={e => setShowMandible(e.target.checked)}
                    className="h-3.5 w-3.5 accent-[color:var(--primary)] cursor-pointer"
                  />
                  Mandible (Lower)
                </label>
                <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">
                  {mandibleTransparency.toFixed(2)}
                </span>
              </div>
              <input
                type="range" min="0" max="1" step="0.01"
                value={mandibleTransparency}
                onChange={e => setMandibleTransparency(parseFloat(e.target.value))}
                disabled={!showMandible}
                className="w-full accent-[color:var(--primary)] disabled:opacity-40"
              />
            </div>
            {/* Quick view toggle */}
            <div className="flex gap-1 rounded-xl border border-[color:var(--border)] p-0.5">
              {([
                { key: "buccal" as CameraPresetName, label: "Buccal" },
                { key: "upperOcclusal" as CameraPresetName, label: "Upper Occ." },
                { key: "lowerOcclusal" as CameraPresetName, label: "Lower Occ." },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setCameraPreset(key)}
                  className={`flex-1 rounded-lg py-1 text-[10px] font-semibold transition-colors ${cameraPreset === key ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)]"}`}
                >
                  {label}
                </button>
              ))}
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

        {/* Manufacturing Preview */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> Manufacturing Preview
          </h3>
          {/* Aligner shell toggle */}
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[11px] text-[color:var(--foreground)]">Aligner Shell</span>
            <button
              type="button"
              onClick={() => dispatch({ type: "TOGGLE_ALIGNER_SHELL" })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full transition-colors duration-200 ${state.showAlignerShell ? "bg-[color:var(--primary)]" : "bg-[color:var(--border)]"}`}
              aria-pressed={state.showAlignerShell}
            >
              <span className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform duration-200 ${state.showAlignerShell ? "translate-x-4" : "translate-x-0.5"}`} />
            </button>
          </div>
          {state.showAlignerShell && (
            <div className="space-y-3">
              {/* Arch selector */}
              <div>
                <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">Arch</p>
                <div className="flex gap-1 rounded-xl border border-[color:var(--border)] p-0.5">
                  {(["upper", "lower", "both"] as const).map(arch => (
                    <button
                      key={arch}
                      type="button"
                      onClick={() => dispatch({ type: "SET_ALIGNER_ARCH", arch })}
                      className={`flex-1 rounded-lg py-1 text-[10px] font-semibold capitalize transition-colors ${state.alignerArch === arch ? "bg-[color:var(--primary)] text-[color:var(--primary-foreground)]" : "text-[color:var(--muted-foreground)]"}`}
                    >
                      {arch}
                    </button>
                  ))}
                </div>
              </div>
              {/* Thickness slider */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-[color:var(--muted-foreground)]">Thickness</p>
                  <span className="text-[10px] tabular-nums text-[color:var(--muted-foreground)]">{state.alignerThickness.toFixed(1)} mm</span>
                </div>
                <input
                  type="range" min="0.3" max="1.5" step="0.1"
                  value={state.alignerThickness}
                  onChange={e => dispatch({ type: "SET_ALIGNER_THICKNESS", thickness: parseFloat(e.target.value) })}
                  className="w-full accent-[color:var(--primary)]"
                />
                <div className="flex justify-between text-[9px] text-[color:var(--muted-foreground)]">
                  <span>0.3 mm</span><span>1.5 mm</span>
                </div>
              </div>
              <p className="text-[9px] leading-relaxed text-[color:var(--muted-foreground)]">
                Demo geometry only. Shell is illustrative; not for clinical manufacturing.
              </p>
            </div>
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

        {/* Movement Summary — visible only when color map is enabled */}
        {colorMapEnabled && (
          <Card className="p-4">
            <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
              <BarChart3 size={14} className="text-primary" /> Movement Summary
            </h3>
            {colorMapData.size === 0 ? (
              <p className="text-[11px] text-[color:var(--muted-foreground)] leading-relaxed">
                No planned movements found. Use the Movements panel to set tooth targets.
              </p>
            ) : (
              <div className="max-h-[220px] overflow-y-auto rounded-xl border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                <div className="grid grid-cols-3 gap-1 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-[color:var(--muted-foreground)]">
                  <span>FDI</span><span>Move mm</span><span>Severity</span>
                </div>
                {Array.from(colorMapData.entries())
                  .sort((a, b) => b[1].severity - a[1].severity)
                  .map(([fdi, data]) => (
                    <div key={fdi} className="grid grid-cols-3 items-center gap-1 px-2 py-1.5 text-[10px]">
                      <span className="font-semibold text-[color:var(--foreground)]">{fdi}</span>
                      <span className="tabular-nums text-[color:var(--muted-foreground)]">{data.movementMm.toFixed(2)}</span>
                      <div className="flex items-center gap-1">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-[color:var(--border)]">
                          <div
                            className="h-full rounded-full"
                            style={{ width: `${Math.round(data.severity * 100)}%`, background: data.color }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </Card>
        )}

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
                  onClick={() => { handleStopAnimation(); setStagesVisible(false); }}
                  className="text-[10px] font-medium text-[color:var(--muted-foreground)] underline-offset-2 hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="mb-2 flex gap-1">
                {isAnimating ? (
                  <Button variant="secondary" size="sm" className="flex-1 justify-center" onClick={handleStopAnimation}>
                    <Square size={13} /> Stop
                  </Button>
                ) : (
                  <Button variant="primary" size="sm" className="flex-1 justify-center" onClick={handleStartAnimation}>
                    <Play size={13} /> Animate
                  </Button>
                )}
              </div>
              <div className="max-h-[260px] overflow-y-auto rounded-xl border border-[color:var(--border)] divide-y divide-[color:var(--border)]">
                {generatedStages.map(row => (
                  <div
                    key={row.stage}
                    className={`flex items-start gap-2 px-3 py-2 text-[11px] ${(isAnimating ? row.stage === animStageIndex + 1 : row.stage === 1) ? "bg-[color-mix(in_srgb,var(--primary-glow)_60%,transparent)]" : ""}`}
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
