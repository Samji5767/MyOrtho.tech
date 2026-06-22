"use client";

import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import {
  ContactShadows, Html, OrbitControls,
  PerspectiveCamera, TransformControls,
} from "@react-three/drei";
import * as THREE from "three";
import {
  AlertTriangle, BarChart3, CheckCircle2, ChevronRight,
  Download, Layers, Move3d, RotateCcw, Target, Zap,
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

// ─── Geometry helpers ─────────────────────────────────────────────────────────

const UPPER_FDIS = [11, 12, 13, 14, 15, 16, 17, 21, 22, 23, 24, 25, 26, 27];
const LOWER_FDIS = [41, 42, 43, 44, 45, 46, 47, 31, 32, 33, 34, 35, 36, 37];
const ATTACHMENT_FDIS = new Set([13, 23, 33, 43]);
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
  onSelect,
  onMeshMounted,
}: {
  tooth: ToothObject;
  isSelected: boolean;
  isGroupSelected: boolean;
  isColliding: boolean;
  showAttachments: boolean;
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
      {/* Attachment block */}
      {showAttachments && tooth.hasAttachment && (
        <mesh position={[0, 0.46, 0]}>
          <boxGeometry args={[0.18, 0.11, 0.10]} />
          <meshPhysicalMaterial color="#38bdf8" roughness={0.45} metalness={0} />
        </mesh>
      )}
      {/* IPR marker disc */}
      {tooth.iprLeft && (
        <mesh position={[0.42, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.10, 0.10, 0.018, 12]} />
          <meshBasicMaterial color="#f97316" transparent opacity={0.75} />
        </mesh>
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
  collisionFdis,
  onSelectTooth,
  onTransformChange,
}: {
  teeth: ToothObject[];
  selectedFdis: Set<number>;
  gizmoMode: GizmoMode;
  showAttachments: boolean;
  collisionFdis: Set<number>;
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
      <PerspectiveCamera makeDefault fov={35} position={[0, 7, 7]} />
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

export default function CADEngine() {
  const [teeth] = useState<ToothObject[]>(() => buildTeethObjects());
  const [selectedFdis, setSelectedFdis] = useState<Set<number>>(new Set());
  const [gizmoMode, setGizmoMode] = useState<GizmoMode>("translate");
  const [showAttachments, setShowAttachments] = useState(true);
  const [showCollision, setShowCollision] = useState(true);
  const [toothOverrides, setToothOverrides] = useState<Map<number, { position: THREE.Vector3; rotation: THREE.Euler }>>(new Map());
  const [biomechanicsWarning, setBiomechanicsWarning] = useState<string | null>(null);

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
    setToothOverrides(prev => new Map(prev).set(fdi, { position: pos, rotation: rot }));
  }, [teeth]);

  const primaryFdi = selectedFdis.size === 1 ? Array.from(selectedFdis)[0] : null;
  const selectedTooth = teeth.find(t => t.fdi === primaryFdi) ?? null;
  const attachmentCount = teeth.filter(t => t.hasAttachment).length;
  const iprCount = teeth.filter(t => t.iprLeft).length;

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
              Click tooth to select · Shift+click multi-select · Drag gizmo to move
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
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
                collisionFdis={collisionFdis}
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

        {/* Stage generation */}
        <Card className="p-4">
          <h3 className="mb-3 text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap size={14} className="text-primary" /> Stage Generation
          </h3>
          <div className="space-y-1 mb-3">
            <DataRow label="Estimated stages" value="20" />
            <DataRow label="Overcorrection" value="2 stages" />
            <DataRow label="Velocity limit" value="0.25 mm/stage" />
            <DataRow label="Refinements" value="Estimated 0" />
          </div>
          <Button
            variant="primary"
            size="sm"
            className="w-full"
            onClick={() => alert("Stage generation complete: 20 aligner stages created with PDL-validated movements. Ready for manufacturing review.")}
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
        </Card>
      </div>
    </div>
  );
}
