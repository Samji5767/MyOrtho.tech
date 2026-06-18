"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, ThreeEvent, useThree } from "@react-three/fiber";
import { ContactShadows, Environment, Html, OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { STLLoader } from "three/examples/jsm/loaders/STLLoader.js";
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

function MeasurementOverlay({ points }: { points: THREE.Vector3[] }) {
  if (points.length < 2) return null;
  const mid = points[0].clone().add(points[1]).multiplyScalar(0.5);
  const distance = points[0].distanceTo(points[1]);
  return (
    <>
      <line>
        <bufferGeometry attach="geometry" setFromPoints={points} />
        <lineBasicMaterial attach="material" color="#2dd4bf" linewidth={2} />
      </line>
      <Html position={mid} center>
        <span className="rounded-md border border-teal-400/40 bg-slate-950/90 px-2 py-1 text-xs font-bold text-teal-100 shadow-lg">{distance.toFixed(2)} mm</span>
      </Html>
    </>
  );
}

function DentalModel({ geometry, clipping, measurementMode, onPick }: { geometry: THREE.BufferGeometry; clipping: boolean; measurementMode: boolean; onPick: (point: THREE.Vector3) => void }) {
  const clippingPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, -1, 0), 0), []);

  return (
    <mesh
      geometry={geometry}
      castShadow
      receiveShadow
      onDoubleClick={(event: ThreeEvent<MouseEvent>) => {
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

function Scene({ geometry, preset, resetSignal, clipping, measurementMode, measurePoints, setMeasurePoints }: {
  geometry: THREE.BufferGeometry;
  preset: ViewPreset;
  resetSignal: number;
  clipping: boolean;
  measurementMode: boolean;
  measurePoints: THREE.Vector3[];
  setMeasurePoints: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
}) {
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
        onPick={point => setMeasurePoints(prev => (prev.length >= 2 ? [point] : [...prev, point]))}
      />
      <MeasurementOverlay points={measurePoints} />
      <ContactShadows opacity={0.34} scale={10} blur={2.4} far={4} position={[0, -1.25, 0]} />
      <Environment preset="studio" />
      <OrbitControls makeDefault enableDamping dampingFactor={0.08} minDistance={1.5} maxDistance={80} />
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
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [viewerNode, setViewerNode] = useState<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => () => geometry.dispose(), [geometry]);

  const loadStl = async (file: File) => {
    setLoadingProgress(10);
    const buffer = await file.arrayBuffer();
    setLoadingProgress(55);
    const loader = new STLLoader();
    const parsed = loader.parse(buffer);
    const centered = centerGeometry(parsed);
    setLoadingProgress(80);
    setGeometry(previous => {
      previous.dispose();
      return centered;
    });
    setStats(getStats(centered, file.name));
    setMeasurePoints([]);
    setPreset("occlusal");
    setResetSignal(signal => signal + 1);
    setLoadingProgress(100);
    window.setTimeout(() => setLoadingProgress(null), 450);
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

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-3 border-b border-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <StatusBadge tone="primary">PBR STL viewer</StatusBadge>
              <StatusBadge tone={measurementMode ? "success" : "neutral"}>Measurements {measurementMode ? "on" : "off"}</StatusBadge>
            </div>
            <h3 className="mt-2 text-lg font-semibold tracking-tight text-foreground">Treatment model workspace</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            <input ref={fileRef} type="file" accept=".stl" className="hidden" onChange={event => event.target.files?.[0] && void loadStl(event.target.files[0])} />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}><UploadCloud size={15} /> STL</Button>
            <Button variant={measurementMode ? "primary" : "secondary"} size="sm" onClick={() => setMeasurementMode(value => !value)}><Ruler size={15} /> Measure</Button>
            <Button variant={clipping ? "primary" : "secondary"} size="sm" onClick={() => setClipping(value => !value)}><Scissors size={15} /> Section</Button>
            <Button variant="secondary" size="icon" aria-label="Reset camera" onClick={() => setResetSignal(signal => signal + 1)}><RotateCcw size={17} /></Button>
            <Button variant="secondary" size="icon" aria-label="Export screenshot" onClick={exportScreenshot}><Camera size={17} /></Button>
            <Button variant="secondary" size="icon" aria-label="Fullscreen" onClick={() => void toggleFullscreen()}><Expand size={17} /></Button>
          </div>
        </div>

        <div ref={setViewerNode} className="relative h-[560px] min-h-[420px] bg-[#0b111a] clinical-grid md:h-[680px]">
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
              <Scene geometry={geometry} preset={preset} resetSignal={resetSignal} clipping={clipping} measurementMode={measurementMode} measurePoints={measurePoints} setMeasurePoints={setMeasurePoints} />
            </Suspense>
          </Canvas>
          <div className="pointer-events-none absolute bottom-4 left-4 rounded-lg border border-white/10 bg-slate-950/70 px-3 py-2 text-xs text-slate-200 backdrop-blur">
            Double click the model to place measurement points
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
            ] as [ViewPreset, React.ComponentType<{ size?: number }>][]) .map(([view, Icon]) => (
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
