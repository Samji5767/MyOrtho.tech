"use client";

import React, { useState, useRef, useEffect } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Grid, Center, Html } from "@react-three/drei";
import * as THREE from "three";
import { 
  CheckCircle2, 
  ChevronRight, 
  AlertCircle, 
  RefreshCw, 
  BarChart2, 
  Upload, 
  Sparkles, 
  Ruler,
  Users,
  MessageSquare,
  Send,
  GitPullRequest,
  Eye,
  Settings,
  Layers
} from "lucide-react";

// Interactive Tooth mesh rendering custom buffer geometries
function CADToothMesh({ 
  fdiNumber, 
  geometry, 
  isSelected, 
  anyToothSelected,
  onClick,
  offsetMove,
  isMaxillary,
  onDoubleClick,
  visible = true
}: { 
  fdiNumber: number; 
  geometry: THREE.BufferGeometry | null;
  isSelected: boolean; 
  anyToothSelected: boolean;
  onClick: () => void;
  offsetMove: [number, number, number];
  isMaxillary: boolean;
  onDoubleClick?: () => void;
  visible?: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  // Apply staging offsets
  const positionY = isMaxillary ? 0.9 : -0.9;
  const finalPos: [number, number, number] = [
    offsetMove[0], 
    positionY + offsetMove[1], 
    offsetMove[2]
  ];

  const opacity = isSelected ? 1.0 : (anyToothSelected ? 0.15 : 1.0);
  const transparent = anyToothSelected && !isSelected;

  return (
    <mesh
      ref={meshRef}
      position={finalPos}
      visible={visible}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onDoubleClick={(e) => {
        e.stopPropagation();
        if (onDoubleClick) onDoubleClick();
      }}
    >
      {geometry ? (
        <primitive object={geometry} attach="geometry" />
      ) : (
        <boxGeometry args={[0.9, 1.2, 0.8]} />
      )}
      <meshStandardMaterial 
        color={isSelected ? "#14b8a6" : "#f1f5f9"} 
        roughness={0.2}
        metalness={0.1}
        emissive={isSelected ? "#0d9488" : "#000000"}
        emissiveIntensity={isSelected ? 0.35 : 0}
        transparent={transparent}
        opacity={opacity}
      />
    </mesh>
  );
}

export default function Viewer3D() {
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [occlusionMap, setOcclusionMap] = useState(false);
  const [crossSection, setCrossSection] = useState(false);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [viewMode, setViewMode] = useState<"both" | "maxillary" | "mandibular">("both");
  
  const [isolateSelected, setIsolateSelected] = useState(false);
  const [trackpadSensitivity, setTrackpadSensitivity] = useState(1.0);
  const [measurementPoints, setMeasurementPoints] = useState<[number, number, number][]>([]);
  const [measuredDistance, setMeasuredDistance] = useState<number | null>(null);
  const [segmentLoadingMode, setSegmentLoadingMode] = useState<"instant" | "progressive">("progressive");
  
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<"viewport" | "controls">("viewport");

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const handleMeasureDoubleClick = (fdi: number) => {
    const pos = getOffset(fdi);
    const yPos = (fdi < 30 ? 0.9 : -0.9) + pos[1];
    const pt1: [number, number, number] = [pos[0] - 0.25, yPos, pos[2] - 0.2];
    const pt2: [number, number, number] = [pos[0] + 0.25, yPos + 0.15, pos[2] + 0.2];
    setMeasurementPoints([pt1, pt2]);
    const dist = Math.sqrt(
      Math.pow(pt2[0] - pt1[0], 2) +
      Math.pow(pt2[1] - pt1[1], 2) +
      Math.pow(pt2[2] - pt1[2], 2)
    ) * 10;
    setMeasuredDistance(dist);
  };
  
  // Collaboration & Moat States
  const [activePanelTab, setActivePanelTab] = useState<"movement" | "collaboration">("movement");
  const [collaborators] = useState([
    { id: "u-1", name: "Elena Rostova (Lab)", active: true, color: "#10b981" },
    { id: "u-2", name: "Dr. Sarah Jenkins (You)", active: true, color: "#14b8a6" }
  ]);
  const [comments, setComments] = useState<{ id: string; author: string; text: string; coords: [number, number, number]; fdi?: number }[]>([
    { id: "c-101", author: "Elena Rostova", text: "Is FDI 12 root expansion matching anatomical limit?", coords: [0.5, 0.9, 0.4] as [number, number, number], fdi: 12 },
    { id: "c-102", author: "Dr. Sarah Jenkins", text: "Yes, verified against the CBCT cross-section scan data.", coords: [-0.6, 0.9, 0.2] as [number, number, number], fdi: 11 }
  ]);
  const [newCommentText, setNewCommentText] = useState("");
  const [comparedVersion, setComparedVersion] = useState<"none" | "v1" | "v2">("none");
  const [otherCursors, setOtherCursors] = useState<Record<string, { x: number; y: number; name: string; color: string }>>({
    "u-1": { x: 180, y: 220, name: "Elena (Lab)", color: "#10b981" }
  });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Simulate updating cursor positions coordinates
    setOtherCursors(prev => ({
      ...prev,
      "u-1": {
        x: x + Math.sin(Date.now() / 1000) * 15,
        y: y + Math.cos(Date.now() / 1000) * 15,
        name: "Elena (Lab)",
        color: "#10b981"
      }
    }));
  };

  const handleAddCommentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText) return;
    const newComm = {
      id: `c-${Date.now()}`,
      author: "Dr. Sarah Jenkins",
      text: newCommentText,
      coords: selectedTooth ? (getOffset(selectedTooth).map((n, i) => i === 1 ? n + (selectedTooth < 30 ? 0.9 : -0.9) : n) as [number, number, number]) : [0, 0, 0] as [number, number, number],
      fdi: selectedTooth || undefined
    };
    setComments([...comments, newComm]);
    setNewCommentText("");
  };
  
  // Custom Mesh states
  const [maxillaryMeshGeom, setMaxillaryMeshGeom] = useState<THREE.BufferGeometry | null>(null);
  const [mandibularMeshGeom, setMandibularMeshGeom] = useState<THREE.BufferGeometry | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<number | null>(null);

  // Real-time tooth offsets (FDI ID -> [x, y, z, pitch, roll, yaw])
  const [toothOffsets, setToothOffsets] = useState<Record<number, { trans: [number, number, number]; rot: [number, number, number] }>>({});

  const maxillaryTeeth = [17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27];
  const mandibularTeeth = [47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37];

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>, isMaxillary: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoadingProgress(0);

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        setLoadingProgress(Math.round((event.loaded / event.total) * 50));
      }
    };

    reader.onload = (event) => {
      const buffer = event.target?.result as ArrayBuffer;
      const worker = new Worker(new URL("../lib/cad/DecimationWorker.ts", import.meta.url));
      worker.postMessage({
        fileData: buffer,
        format: file.name.split(".").pop()?.toUpperCase() === "STL" ? "STL" : "OBJ",
        targetRatio: 0.15
      });

      worker.onmessage = (workerEvent) => {
        const { success, vertices, faces, error } = workerEvent.data;
        if (success) {
          const geom = new THREE.BufferGeometry();
          geom.setAttribute("position", new THREE.BufferAttribute(vertices, 3));
          geom.setIndex(new THREE.BufferAttribute(faces, 1));
          geom.computeVertexNormals();

          if (isMaxillary) {
            setMaxillaryMeshGeom(geom);
          } else {
            setMandibularMeshGeom(geom);
          }
          setLoadingProgress(100);
          setTimeout(() => setLoadingProgress(null), 1000);
        } else {
          console.error("Worker Error:", error);
          setLoadingProgress(null);
        }
        worker.terminate();
      };
    };

    reader.readAsArrayBuffer(file);
  };

  const getOffset = (fdi: number): [number, number, number] => {
    return toothOffsets[fdi]?.trans || [0, 0, 0];
  };

  const handleControlChange = (type: "trans" | "rot", axisIndex: number, val: number) => {
    if (selectedTooth === null) return;
    setToothOffsets((prev) => {
      const current = prev[selectedTooth] || { trans: [0, 0, 0], rot: [0, 0, 0] };
      const updated = { ...current };
      if (type === "trans") {
        const newTrans = [...updated.trans] as [number, number, number];
        newTrans[axisIndex] = val;
        updated.trans = newTrans;
      } else {
        const newRot = [...updated.rot] as [number, number, number];
        newRot[axisIndex] = val;
        updated.rot = newRot;
      }
      return { ...prev, [selectedTooth]: updated };
    });
  };

  const currentOffset = selectedTooth !== null ? toothOffsets[selectedTooth] || { trans: [0, 0, 0], rot: [0, 0, 0] } : null;

  return (
    <div className="flex flex-col gap-4 h-full min-h-[500px]">
      
      {/* iOS styled Segment picker on Mobile screen to switch columns */}
      {isMobile && (
        <div className="bg-slate-100 dark:bg-slate-900 p-1 rounded-xl flex relative w-full border border-border/40 select-none">
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(10);
              }
              setMobileTab("viewport");
            }}
            className={`flex-1 py-2 text-xs font-bold text-center z-10 transition-colors ${
              mobileTab === "viewport" ? "text-foreground" : "text-secondary"
            }`}
          >
            3D Viewport
          </button>
          <button
            onClick={() => {
              if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                window.navigator.vibrate(10);
              }
              setMobileTab("controls");
            }}
            className={`flex-1 py-2 text-xs font-bold text-center z-10 transition-colors ${
              mobileTab === "controls" ? "text-foreground" : "text-secondary"
            }`}
          >
            Staging Controls
          </button>
          <div
            className="absolute top-1 bottom-1 bg-card rounded-lg shadow-sm transition-all duration-300"
            style={{
              left: mobileTab === "viewport" ? "4px" : "50%",
              width: "calc(50% - 6px)",
            }}
          />
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full flex-1 min-h-[450px]">
        
        {/* 3D Scene Viewport */}
        <div className={`lg:col-span-3 bg-card border border-border rounded-2xl shadow-md overflow-hidden flex flex-col relative min-h-[350px] md:min-h-[450px] h-[55vh] lg:h-full ${
          isMobile && mobileTab !== "viewport" ? "hidden" : "flex"
        }`}>
          
          {/* Arch selection overlay */}
          <div className="absolute top-4 left-4 z-10 flex gap-2">
            {["both", "maxillary", "mandibular"].map((mode) => (
              <button 
                key={mode}
                onClick={() => {
                  if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                    window.navigator.vibrate(10);
                  }
                  setViewMode(mode as any);
                }}
                className={`px-4 min-h-[44px] rounded-xl text-[10px] md:text-xs font-extrabold uppercase tracking-wider border transition-spring focus-ring flex items-center justify-center ${
                  viewMode === mode 
                    ? "bg-primary text-white border-primary shadow-glow" 
                    : "bg-card/90 backdrop-blur-sm border-border text-secondary hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                {mode === "both" ? "Dual Arch" : mode}
              </button>
            ))}
          </div>

          {/* Viewport Diagnostic utilities (Touch-friendly 44x44px target zones) */}
          <div className="absolute top-4 right-4 z-10 flex flex-col gap-2.5">
            {[
              { id: "occlusion", state: occlusionMap, set: () => setOcclusionMap(!occlusionMap), icon: BarChart2, label: "Occlusion Heatmap" },
              { id: "cross", state: crossSection, set: () => setCrossSection(!crossSection), icon: Layers, label: "Cross Section" },
              { id: "measure", state: measurementMode, set: () => setMeasurementMode(!measurementMode), icon: Ruler, label: "Landmark Distance Ruler" },
              { id: "isolate", state: isolateSelected, set: () => setIsolateSelected(!isolateSelected), icon: Eye, label: "Isolate Selected FDI" }
            ].map(tool => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => {
                    if (typeof window !== "undefined" && window.navigator && window.navigator.vibrate) {
                      window.navigator.vibrate(10);
                    }
                    tool.set();
                  }}
                  className={`w-11 h-11 rounded-xl border transition-spring focus-ring flex items-center justify-center ${
                    tool.state 
                      ? "bg-primary/20 text-primary border-primary backdrop-blur-sm shadow-glow" 
                      : "bg-card/90 border-border text-secondary hover:text-foreground hover:bg-slate-50 dark:hover:bg-slate-850 backdrop-blur-sm"
                  }`}
                  title={tool.label}
                  aria-label={tool.label}
                >
                  <Icon size={18} />
                </button>
              );
            })}
          </div>

          {/* Loading decimation worker overlay */}
          {loadingProgress !== null && (
            <div className="absolute inset-0 bg-black/70 backdrop-blur-sm z-20 flex flex-col items-center justify-center text-white p-4">
              <Sparkles className="animate-pulse text-primary mb-3" size={32} />
              <h3 className="text-xs font-bold mb-2">Dental CAD: Decimating STL points ({loadingProgress}%)</h3>
              <div className="w-48 bg-slate-800 h-1 rounded-full overflow-hidden">
                <div className="bg-primary h-full transition-all duration-150" style={{ width: `${loadingProgress}%` }} />
              </div>
            </div>
          )}

          {/* 3D Canvas Box */}
          <div 
            className="flex-1 w-full bg-slate-950 relative"
            onMouseMove={handleMouseMove}
          >
            {/* Virtual pointers coordinates */}
            {Object.entries(otherCursors).map(([id, cursor]) => (
              <div
                key={id}
                className="absolute pointer-events-none z-10 flex flex-col items-start gap-0.5"
                style={{ left: cursor.x, top: cursor.y }}
              >
                <div className="w-2 h-2 rounded-full shadow" style={{ backgroundColor: cursor.color }} />
                <span className="bg-slate-950/80 text-white border border-border px-1.5 py-0.5 rounded text-[8px] font-bold">
                  {cursor.name}
                </span>
              </div>
            ))}

            <Canvas camera={{ position: [0, 8, 12], fov: 45 }}>
              <ambientLight intensity={1.5} />
              <pointLight position={[10, 10, 10]} intensity={1.8} />
              <pointLight position={[-10, -10, -10]} intensity={0.5} />
              <directionalLight position={[0, 15, 0]} intensity={1} />
              
              <Center>
                {(viewMode === "both" || viewMode === "maxillary") && (
                  <group position={[0, 0, 0]}>
                    {maxillaryTeeth.map((fdi) => (
                      <CADToothMesh
                        key={fdi}
                        fdiNumber={fdi}
                        geometry={maxillaryMeshGeom}
                        isSelected={selectedTooth === fdi}
                        anyToothSelected={selectedTooth !== null}
                        onClick={() => setSelectedTooth(fdi)}
                        offsetMove={getOffset(fdi)}
                        isMaxillary={true}
                        visible={!isolateSelected || selectedTooth === fdi}
                        onDoubleClick={() => handleMeasureDoubleClick(fdi)}
                      />
                    ))}
                  </group>
                )}

                {(viewMode === "both" || viewMode === "mandibular") && (
                  <group position={[0, -0.8, 0]}>
                    {mandibularTeeth.map((fdi) => (
                      <CADToothMesh
                        key={fdi}
                        fdiNumber={fdi}
                        geometry={mandibularMeshGeom}
                        isSelected={selectedTooth === fdi}
                        anyToothSelected={selectedTooth !== null}
                        onClick={() => setSelectedTooth(fdi)}
                        offsetMove={getOffset(fdi)}
                        isMaxillary={false}
                        visible={!isolateSelected || selectedTooth === fdi}
                        onDoubleClick={() => handleMeasureDoubleClick(fdi)}
                      />
                    ))}
                  </group>
                )}
              </Center>

              {isolateSelected && selectedTooth !== null && (
                <gridHelper 
                  args={[4, 10, "#14b8a6", "#475569"]} 
                  position={[
                    getOffset(selectedTooth)[0], 
                    (selectedTooth < 30 ? 0.9 : -0.9) + getOffset(selectedTooth)[1], 
                    getOffset(selectedTooth)[2]
                  ]} 
                />
              )}

              {comments.map((comm) => (
                <mesh key={comm.id} position={comm.coords}>
                  <sphereGeometry args={[0.15, 16, 16]} />
                  <meshStandardMaterial color="#f59e0b" emissive="#d97706" emissiveIntensity={0.6} roughness={0.1} />
                  <Html distanceFactor={8} position={[0, 0.35, 0]}>
                    <div className="bg-slate-950/90 border border-amber-500/40 text-white p-2 rounded-xl text-[9px] whitespace-nowrap shadow-lg pointer-events-none select-none">
                      <span className="font-extrabold text-amber-400 block">@{comm.author}</span>
                      {comm.text}
                    </div>
                  </Html>
                </mesh>
              ))}

              {measurementMode && measurementPoints.length === 2 && (
                <group>
                  {measurementPoints.map((pt, idx) => (
                    <mesh key={idx} position={pt}>
                      <sphereGeometry args={[0.07, 16, 16]} />
                      <meshBasicMaterial color="#14b8a6" depthTest={false} />
                    </mesh>
                  ))}
                  <Html distanceFactor={7} position={measurementPoints[1]}>
                    <div className="bg-slate-950/95 border border-teal-500/50 text-white p-2.5 rounded-xl text-[10px] shadow-2xl pointer-events-none select-none max-w-[200px]">
                      <span className="font-extrabold text-teal-400 block mb-0.5">Ruler Distance</span>
                      <div className="text-xs font-bold">{measuredDistance ? `${measuredDistance.toFixed(2)} mm` : "3.12 mm"}</div>
                      <span className="text-[8px] text-amber-400 block mt-1 leading-normal">⚠️ Calibrate meshes coordinates.</span>
                    </div>
                  </Html>
                </group>
              )}

              {comparedVersion !== "none" && (
                <group position={[0, 0, 0]}>
                  {maxillaryTeeth.map((fdi) => (
                    <mesh key={`ghost-${fdi}`} position={[0, 0.9, 0]}>
                      <boxGeometry args={[0.9, 1.2, 0.8]} />
                      <meshBasicMaterial color="#ffffff" transparent opacity={0.25} wireframe />
                    </mesh>
                  ))}
                </group>
              )}

              <OrbitControls enableDamping dampingFactor={0.05} />
              <Grid 
                position={[0, -2, 0]} 
                args={[30, 30]} 
                cellSize={0.5} 
                cellThickness={0.5} 
                cellColor="#334155" 
                sectionSize={2} 
                sectionThickness={1} 
                sectionColor="#0d9488" 
                fadeDistance={20}
              />
            </Canvas>
          </div>

          {/* Load CAD Mesh controls bottom toolbar (Touch-friendly 44px links) */}
          <div className="p-4 bg-slate-900 border-t border-border flex items-center justify-between text-[11px] text-slate-400 flex-wrap gap-3">
            <div className="flex gap-3 items-center flex-wrap">
              <label className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] border border-border/60 bg-slate-950/20 hover:bg-slate-900/40 rounded-xl cursor-pointer text-xs font-bold transition-all text-primary">
                <Upload size={14} /> <span>Maxillary CAD</span>
                <input type="file" onChange={(e) => handleFileUpload(e, true)} className="hidden" accept=".stl" />
              </label>
              <label className="flex items-center gap-1.5 px-3 py-2 min-h-[44px] border border-border/60 bg-slate-950/20 hover:bg-slate-900/40 rounded-xl cursor-pointer text-xs font-bold transition-all text-primary">
                <Upload size={14} /> <span>Mandibular CAD</span>
                <input type="file" onChange={(e) => handleFileUpload(e, false)} className="hidden" accept=".stl" />
              </label>
              <div className="h-5 w-px bg-slate-800 hidden sm:block" />
              <button
                onClick={() => setSegmentLoadingMode(prev => prev === "instant" ? "progressive" : "instant")}
                className="text-secondary hover:text-foreground transition-colors flex items-center gap-1 min-h-[44px] px-2 text-xs font-semibold"
              >
                Loading: <span className="text-teal-400 font-bold capitalize">{segmentLoadingMode}</span>
              </button>
            </div>
            <span className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs select-none">
              <CheckCircle2 size={13} /> GPU Active
            </span>
          </div>
        </div>

        {/* Viewport Control Panel Cards */}
        <div className={`bg-card border border-border rounded-2xl p-5 flex flex-col justify-between shadow-md ${
          isMobile && mobileTab !== "controls" ? "hidden" : "flex"
        }`}>
          <div>
            <h3 className="font-bold text-sm border-b border-border pb-3 mb-4 flex items-center gap-2">
              <Settings size={14} className="text-primary" />
              <span>Viewer Controls</span>
            </h3>
            
            {/* Segmented controls tab */}
            <div className="flex bg-slate-50 dark:bg-slate-900/50 p-1 border border-border rounded-xl mb-4 text-[11px] min-h-[44px]">
              <button 
                onClick={() => setActivePanelTab("movement")}
                className={`flex-1 py-2 font-bold uppercase tracking-wider rounded-lg transition-spring ${
                  activePanelTab === "movement" 
                    ? "bg-card text-primary shadow-sm" 
                    : "text-slate-400 hover:text-foreground"
                }`}
              >
                Staging
              </button>
              <button 
                onClick={() => setActivePanelTab("collaboration")}
                className={`flex-1 py-2 font-bold uppercase tracking-wider rounded-lg transition-spring ${
                  activePanelTab === "collaboration" 
                    ? "bg-card text-primary shadow-sm" 
                    : "text-slate-400 hover:text-foreground"
                }`}
              >
                Collab
              </button>
            </div>

            {activePanelTab === "movement" ? (
              selectedTooth !== null ? (
                <div className="space-y-5">
                  <div className="p-3 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl">
                    <span className="text-[9px] uppercase font-bold text-slate-400 block">Selected element</span>
                    <p className="text-xs font-bold mt-0.5">Tooth FDI #{selectedTooth}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">
                      {selectedTooth < 30 ? "Maxillary Arch" : "Mandibular Arch"}
                    </p>
                  </div>

                  {/* Range Sliders */}
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-wider">Displacement (mm)</h4>

                    {[
                      { axis: 0, label: "Mesial / Distal (X)" },
                      { axis: 1, label: "Intrusion / Extrusion (Y)" },
                      { axis: 2, label: "Labial / Lingual (Z)" }
                    ].map(ctrl => (
                      <div key={ctrl.axis} className="space-y-1">
                        <div className="flex justify-between text-[11px] font-semibold">
                          <span className="text-slate-400">{ctrl.label}</span>
                          <span className="text-primary font-bold">{(currentOffset?.trans[ctrl.axis] || 0).toFixed(2)} mm</span>
                        </div>
                        <input
                          type="range" min="-3" max="3" step="0.1"
                          className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-lg appearance-none cursor-pointer accent-primary focus-ring"
                          value={currentOffset?.trans[ctrl.axis] || 0}
                          onChange={(e) => handleControlChange("trans", ctrl.axis, parseFloat(e.target.value))}
                        />
                      </div>
                    ))}
                  </div>

                  {/* Gesture zone */}
                  <div className="p-3 bg-slate-900 border border-slate-800 rounded-xl space-y-2">
                    <div className="flex justify-between items-center text-[9px] uppercase font-bold text-slate-400">
                      <span>Trackpad Scroll Area</span>
                      <span className="text-[8px] text-teal-400 font-mono">sens: {trackpadSensitivity}x</span>
                    </div>
                    <div 
                      className="h-14 bg-slate-950 border border-dashed border-slate-800 rounded-lg flex items-center justify-center cursor-ns-resize hover:bg-slate-900/40 transition-colors"
                      onWheel={(e) => {
                        e.preventDefault();
                        const delta = -e.deltaY * 0.005 * trackpadSensitivity;
                        handleControlChange("trans", 1, Math.max(-3, Math.min(3, (currentOffset?.trans[1] || 0) + delta)));
                      }}
                    >
                      <span className="text-[9px] text-slate-500 select-none">Scroll here for Y translate</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-400 font-semibold">Sensitivity</span>
                      <input 
                        type="range" min="0.2" max="2.0" step="0.1"
                        value={trackpadSensitivity}
                        onChange={(e) => setTrackpadSensitivity(parseFloat(e.target.value))}
                        className="w-20 h-1 bg-slate-800 rounded appearance-none cursor-pointer accent-teal-500 focus-ring"
                      />
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-12 border border-dashed border-border rounded-xl text-slate-400 text-xs flex flex-col items-center justify-center p-4">
                  <AlertCircle size={24} className="text-slate-400 mb-2" />
                  <p className="font-bold">No Active FDI Selected</p>
                  <p className="mt-1 leading-relaxed text-[10px]">Load STL file records or click on individual tooth structures inside the 3D studio viewport.</p>
                </div>
              )
            ) : (
              <div className="space-y-4 text-xs">
                <div className="flex items-center justify-between bg-slate-900/40 p-2.5 rounded-xl border border-border">
                  <span className="font-bold flex items-center gap-1.5"><Users size={12} className="text-teal-400" /> Active Session</span>
                  <span className="px-2 py-0.5 bg-teal-500/10 text-teal-400 border border-teal-500/20 rounded font-black uppercase text-[8px] select-none">LIVE</span>
                </div>
                
                <div className="space-y-1.5">
                  {collaborators.map(c => (
                    <div key={c.id} className="flex items-center gap-2 font-bold text-[11px]">
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="text-foreground">{c.name}</span>
                    </div>
                  ))}
                </div>

                {/* Version mapping */}
                <div className="border-t border-border pt-3 space-y-1.5">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><GitPullRequest size={10} /> Versions</span>
                  <div className="grid grid-cols-2 gap-2">
                    <button 
                      onClick={() => setComparedVersion("none")}
                      className={`py-2 min-h-[44px] border rounded-lg font-bold text-[9px] uppercase tracking-wider focus-ring ${comparedVersion === "none" ? "bg-primary text-white border-primary shadow-sm" : "border-border hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      Active
                    </button>
                    <button 
                      onClick={() => setComparedVersion("v1")}
                      className={`py-2 min-h-[44px] border rounded-lg font-bold text-[9px] uppercase tracking-wider focus-ring ${comparedVersion === "v1" ? "bg-primary text-white border-primary shadow-sm" : "border-border hover:bg-slate-50 dark:hover:bg-slate-800"}`}
                    >
                      Compare Initial
                    </button>
                  </div>
                </div>

                {/* Pins lists */}
                <div className="border-t border-border pt-3 space-y-2">
                  <span className="block text-[9px] uppercase font-bold text-slate-400 flex items-center gap-1"><MessageSquare size={10} /> Pins Annotations</span>
                  <div className="max-h-36 overflow-y-auto space-y-2 pr-1">
                    {comments.map(c => (
                      <div key={c.id} className="p-2 bg-slate-900/30 border border-border rounded-xl space-y-1 text-[11px] leading-relaxed">
                        <div className="flex justify-between font-bold">
                          <span className="text-primary">@{c.author}</span>
                          {c.fdi && <span className="text-slate-400">FDI {c.fdi}</span>}
                        </div>
                        <p className="text-foreground">{c.text}</p>
                      </div>
                    ))}
                  </div>

                  <form onSubmit={handleAddCommentSubmit} className="flex gap-1.5">
                    <input
                      type="text"
                      required
                      value={newCommentText}
                      onChange={(e) => setNewCommentText(e.target.value)}
                      placeholder="Enter annotation..."
                      className="flex-1 px-3 py-2 min-h-[44px] bg-slate-50 dark:bg-slate-900/60 border border-border rounded-lg text-[11px] focus:outline-none focus-ring"
                    />
                    <button 
                      type="submit"
                      className="p-3.5 min-h-[44px] bg-primary hover:bg-primary-hover text-white rounded-lg transition-colors focus-ring flex items-center justify-center shrink-0"
                      aria-label="Submit comment annotation"
                    >
                      <Send size={14} />
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-border mt-4 flex flex-col gap-3">
            <button 
              onClick={() => setToothOffsets({})}
              className="flex items-center justify-center gap-1.5 w-full py-3.5 min-h-[44px] bg-slate-50 hover:bg-slate-100 dark:bg-slate-900 dark:hover:bg-slate-850 border border-border text-xs font-bold rounded-xl transition-colors focus-ring"
            >
              <RefreshCw size={12} />
              <span>Reset FDI Layouts</span>
            </button>
            <button className="flex items-center justify-center gap-1.5 w-full py-3.5 min-h-[44px] bg-primary hover:bg-primary-hover text-white text-xs font-bold rounded-xl transition-spring shadow-sm focus-ring">
              <span>Save Ortho Staging</span>
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
