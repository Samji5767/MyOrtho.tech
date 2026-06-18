"use client";

import React, { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertTriangle, Loader2, Sparkles, FileText } from "lucide-react";

interface ScanImportSystemProps {
  caseId: string;
  patientName: string;
  onUploadSuccess: (metrics: any) => void;
}

export default function ScanImportSystem({ caseId, patientName, onUploadSuccess }: ScanImportSystemProps) {
  const [isDragActive, setIsDragActive] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [fileDetails, setFileDetails] = useState<{ name: string; size: string; format: string } | null>(null);
  const [validationStage, setValidationStage] = useState<"idle" | "running" | "complete">("idle");
  const [meshMetrics, setMeshMetrics] = useState<any>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setIsDragActive(true);
    } else if (e.type === "dragleave") {
      setIsDragActive(false);
    }
  };

  const processFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    const validExts = ["stl", "obj", "ply", "dcm", "dicom"];
    
    if (!ext || !validExts.includes(ext)) {
      alert("Unsupported format. Please upload STL, OBJ, PLY, or DICOM/CBCT scans.");
      return;
    }

    setFileDetails({
      name: file.name,
      size: `${(file.size / (1024 * 1024)).toFixed(2)} MB`,
      format: ext.toUpperCase()
    });

    setUploading(true);
    setProgress(0);
    setValidationStage("idle");
    setMeshMetrics(null);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setUploading(false);
          runAIValidation();
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const runAIValidation = () => {
    setValidationStage("running");
    setTimeout(() => {
      const mockMetrics = {
        triangleCount: 342109,
        holeCount: 2,
        thinWallRisk: false,
        unsupportedGeometry: true,
        orientationCorrected: true,
        artifactRisk: "Low"
      };
      setMeshMetrics(mockMetrics);
      setValidationStage("complete");
      onUploadSuccess(mockMetrics);
    }, 1500);
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-md overflow-hidden">
      
      {/* Header */}
      <div className="p-5 border-b border-border bg-slate-50/50 dark:bg-slate-900/10">
        <h2 className="text-base font-bold tracking-tight flex items-center gap-2">
          <UploadCloud size={16} className="text-primary" />
          <span>Orthodontic Scan Acquisition</span>
        </h2>
        <p className="text-[11px] text-slate-400 mt-0.5">Upload CBCT, STL, OBJ, or PLY patient records for {patientName}</p>
      </div>

      <div className="p-4 md:p-6 space-y-6">
        
        {/* Drag/Drop Zone */}
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-2xl p-6 md:p-8 flex flex-col items-center justify-center cursor-pointer transition-spring select-none min-h-[180px] ${
            isDragActive 
              ? "border-primary bg-primary/5 shadow-glow" 
              : "border-border hover:border-slate-400 dark:hover:border-slate-650 bg-slate-50/10"
          }`}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              fileInputRef.current?.click();
            }
          }}
          aria-label="Upload STL scan file"
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileInput}
            className="hidden"
            accept=".stl,.obj,.ply,.dcm,.dicom"
          />
          <UploadCloud className="text-primary mb-3 shrink-0" size={38} />
          <p className="text-xs font-bold mb-1 text-foreground text-center">Drag & drop orthodontic scan files here</p>
          <p className="text-[10px] text-slate-400 mb-4 text-center">STL, OBJ, PLY, DICOM up to 250MB</p>
          <button
            type="button"
            className="px-5 py-3 min-h-[44px] border border-border text-[11px] font-extrabold rounded-xl bg-card hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors focus-ring flex items-center justify-center"
          >
            Select from Disk
          </button>
        </div>

        {/* Upload State */}
        {uploading && (
          <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-2 text-xs">
                <Loader2 size={13} className="animate-spin text-primary" />
                <span className="font-semibold truncate max-w-xs">Uploading {fileDetails?.name}...</span>
              </div>
              <span className="text-xs font-black text-primary">{progress}%</span>
            </div>
            <div className="w-full bg-slate-200 dark:bg-slate-850 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-primary h-full transition-all duration-150" 
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        {/* File Analysis Metrics Panel */}
        {fileDetails && !uploading && (
          <div className="space-y-4 animate-in fade-in slide-in-from-top-1 duration-200">
            <div className="p-4 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <FileText className="text-primary shrink-0" size={18} />
                <div className="min-w-0 text-xs">
                  <p className="font-bold truncate text-foreground">{fileDetails.name}</p>
                  <p className="text-[10px] text-slate-400 mt-0.5">Format: {fileDetails.format} • Size: {fileDetails.size}</p>
                </div>
              </div>
              <span className="text-[9px] w-fit px-3 py-1.5 bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 rounded-full font-black select-none text-center">
                UPLOADS DONE
              </span>
            </div>

            {/* Validation progress skeleton loader simulation */}
            {validationStage === "running" && (
              <div className="p-6 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                <Loader2 className="animate-spin text-primary mb-1 shrink-0" size={24} />
                <h4 className="text-xs font-bold text-foreground">Dental AI mesh parsing...</h4>
                <p className="text-[10px] text-slate-400 max-w-xs leading-relaxed">
                  Verifying mesh watertight coordinates, orienting vectors, and checking bracket placement bounds.
                </p>
                <div className="w-full max-w-xs space-y-2.5 pt-4">
                  <div className="h-6 w-full animate-skeleton rounded-lg" />
                  <div className="h-6 w-5/6 animate-skeleton rounded-lg mx-auto" />
                </div>
              </div>
            )}

            {/* AI Diagnostics details */}
            {validationStage === "complete" && meshMetrics && (
              <div className="p-4 border border-border rounded-2xl bg-card space-y-4 shadow-sm">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary border-b border-border pb-2">
                  <Sparkles size={13} />
                  <span>AI Diagnostics Report</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[11px]">
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-border rounded-xl">
                    <p className="text-slate-400">Total Mesh Triangles</p>
                    <p className="font-bold text-foreground mt-0.5 text-xs">{meshMetrics.triangleCount.toLocaleString()}</p>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-border rounded-xl">
                    <p className="text-slate-400">Geometry Holes</p>
                    <p className="font-bold text-foreground mt-0.5 text-xs flex items-center gap-1.5 flex-wrap">
                      <span>{meshMetrics.holeCount}</span>
                      {meshMetrics.holeCount > 0 && (
                        <span className="text-[9px] bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded font-black border border-amber-500/15">
                          AUTO-FILLED
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-border rounded-xl">
                    <p className="text-slate-400">Thin Wall Risks</p>
                    <p className="font-bold text-emerald-500 mt-0.5 text-xs">None Detected</p>
                  </div>
                  <div className="p-3 bg-slate-50/50 dark:bg-slate-900/40 border border-border rounded-xl">
                    <p className="text-slate-400">Scan Alignment</p>
                    <p className="font-bold text-primary mt-0.5 text-xs flex items-center gap-1">
                      <CheckCircle2 size={12} className="text-primary" />
                      <span>Aligned</span>
                    </p>
                  </div>
                </div>

                {meshMetrics.unsupportedGeometry && (
                  <div className="flex items-start gap-2.5 p-3.5 bg-amber-500/5 text-amber-600 border border-amber-500/15 rounded-xl text-xs leading-relaxed">
                    <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-500" />
                    <div>
                      <p className="font-bold text-amber-700 dark:text-amber-500 text-xs">Minor artifacts smoothed</p>
                      <p className="text-slate-400 mt-0.5 text-[11px] leading-normal">Noisy scans coordinates near tooth 47 crown decimation were automatically resolved.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
