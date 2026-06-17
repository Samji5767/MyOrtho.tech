"use client";

import React, { useState } from "react";
import { Play, LineChart, ShieldAlert, Cpu, Sparkles, CheckCircle2, ChevronRight, BarChart } from "lucide-react";

interface ModelEpoch {
  epoch: number;
  loss: number;
  diceAccuracy: number;
}

export default function TrainingDashboard() {
  const [modelName, setModelName] = useState("segmentation_3d");
  const [isTraining, setIsTraining] = useState(false);
  const [epochs, setEpochs] = useState<ModelEpoch[]>([
    { epoch: 1, loss: 0.4502, diceAccuracy: 0.812 },
    { epoch: 2, loss: 0.3204, diceAccuracy: 0.865 },
    { epoch: 3, loss: 0.2201, diceAccuracy: 0.912 }
  ]);
  const [onnxExported, setOnnxExported] = useState(false);

  const handleStartTraining = () => {
    setIsTraining(true);
    // Simulate training epochs increments
    setTimeout(() => {
      const newEpochs = [
        ...epochs,
        { epoch: 4, loss: 0.1450, diceAccuracy: 0.942 },
        { epoch: 5, loss: 0.0910, diceAccuracy: 0.978 }
      ];
      setEpochs(newEpochs);
      setIsTraining(false);
    }, 2500);
  };

  const handleExportONNX = () => {
    setOnnxExported(true);
    alert("ONNX: Exporting PyTorch model graph representation. Model compiled to ONNX FP16 standard.");
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-card border border-border rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-sm">
        <div>
          <h3 className="font-semibold text-lg">AI Model Training & Annotation Pipeline</h3>
          <p className="text-xs text-secondary mt-0.5">Train, tune, validate, and export MONAI models for FDI teeth segmentation</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleStartTraining} disabled={isTraining}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-xs font-semibold transition-colors disabled:opacity-50"
          >
            <Play size={14} />
            {isTraining ? "Training..." : "Start Training Run"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Dataset controls */}
        <div className="bg-card border border-border rounded-2xl p-6 space-y-6">
          <div className="border-b border-border pb-3">
            <h4 className="font-semibold text-base flex items-center gap-2">
              <Cpu size={18} className="text-primary" />
              Dataset Mappings
            </h4>
            <p className="text-xs text-secondary mt-0.5">Select active clinical directories for supervised runs</p>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] uppercase font-bold text-secondary mb-1">Target Model Network</label>
              <select
                value={modelName}
                onChange={(e) => setModelName(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-border rounded-lg focus:outline-none"
              >
                <option value="segmentation_3d">3D UNet Tooth Segmentation (MONAI)</option>
                <option value="landmark_detector">PointNet++ Landmarks Extractor</option>
                <option value="root_predictor">Statistical Root Centerline Predictor</option>
              </select>
            </div>

            <div className="p-3 bg-slate-50 dark:bg-slate-950/20 border border-border rounded-xl space-y-2">
              <div className="flex justify-between font-bold">
                <span>Annotated Scans count:</span>
                <span>450 Cases</span>
              </div>
              <div className="flex justify-between font-bold">
                <span>Validation split ratio:</span>
                <span>20% (90 Cases)</span>
              </div>
            </div>

            <button
              onClick={handleExportONNX}
              className={`w-full py-2 border rounded-lg font-semibold transition-colors flex items-center justify-center gap-1 ${
                onnxExported 
                  ? "bg-teal-500/10 text-teal-400 border-teal-500/20" 
                  : "bg-slate-100 hover:bg-slate-200 dark:bg-slate-900 dark:hover:bg-slate-800 border-border"
              }`}
            >
              <Sparkles size={14} />
              {onnxExported ? "ONNX Model Exported" : "Compile & Export to ONNX"}
            </button>
          </div>
        </div>

        {/* Real-time Loss / Accuracy metrics */}
        <div className="lg:col-span-2 bg-card border border-border rounded-2xl p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="border-b border-border pb-3 flex items-center justify-between">
              <div>
                <h4 className="font-semibold text-base flex items-center gap-2">
                  <LineChart size={18} className="text-primary" />
                  Epoch Loss & Validation Progress
                </h4>
                <p className="text-xs text-secondary mt-0.5">Logs of training iterations with average Dice scores</p>
              </div>
              {isTraining && (
                <span className="text-xs text-primary font-semibold flex items-center gap-1.5 animate-pulse">
                  <span className="h-2 w-2 rounded-full bg-primary" /> Running forward propagation...
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
              {epochs.map((e, idx) => (
                <div key={idx} className="p-3 border border-border rounded-xl flex items-center justify-between gap-4 text-xs hover:border-slate-300 dark:hover:border-slate-700 transition-all">
                  <div className="font-semibold">
                    Epoch #{e.epoch}
                  </div>
                  <div className="flex gap-6">
                    <div>
                      <span className="text-secondary text-[10px] block">Average Dice Loss</span>
                      <span className="font-bold font-mono">{e.loss.toFixed(4)}</span>
                    </div>
                    <div>
                      <span className="text-secondary text-[10px] block">Dice Accuracy Score</span>
                      <span className="font-bold font-mono text-teal-400">{(e.diceAccuracy * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
