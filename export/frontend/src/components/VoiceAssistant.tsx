"use client";

import React, { useState } from "react";
import { Mic, MicOff, Play, Sparkles, AlertCircle, CheckCircle2, MessageSquareCode } from "lucide-react";

interface VoiceCommand {
  phrase: string;
  action: string;
}

const sampleCommands: VoiceCommand[] = [
  { phrase: "Show all delayed cases", action: "Routing case navigator: active status filter set to delayed" },
  { phrase: "Analyze patient compliance", action: "AI Monitor check: aligner fit accuracy = 92% (good compliance)" },
  { phrase: "Review printer queues", action: "Manufacturing check: 2/3 online, formlabs running at 42%" }
];

export default function VoiceAssistant() {
  const [isListening, setIsListening] = useState(false);
  const [transcribedText, setTranscribedText] = useState("");
  const [interpretedAction, setInterpretedAction] = useState("");
  const [confidence, setConfidence] = useState<number | null>(null);

  const handleMicTrigger = () => {
    if (isListening) {
      setIsListening(false);
      // Simulate speech-to-text transcription callback
      const randomCommand = sampleCommands[Math.floor(Math.random() * sampleCommands.length)];
      setTranscribedText(randomCommand.phrase);
      setInterpretedAction(randomCommand.action);
      setConfidence(0.95);
    } else {
      setIsListening(true);
      setTranscribedText("Listening for command...");
      setInterpretedAction("");
      setConfidence(null);
    }
  };

  return (
    <div className="bg-card border border-border rounded-2xl shadow-card overflow-hidden">
      <div className="p-6 border-b border-border flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-lg">MyOrtho Voice AI Assistant</h3>
          <p className="text-xs text-secondary mt-0.5">Hands-free natural language case reviews and dashboard control</p>
        </div>
        <span className="flex items-center gap-1.5 px-3 py-1 bg-primary/10 text-primary border border-primary/20 rounded-full text-xs font-bold">
          <Sparkles size={14} /> Whisper AI Engine
        </span>
      </div>

      <div className="p-6 space-y-6">
        {/* Listening controls */}
        <div className="flex flex-col items-center justify-center p-8 bg-slate-50 dark:bg-slate-900/40 border border-border rounded-xl space-y-4">
          <button
            onClick={handleMicTrigger}
            className={`p-5 rounded-full transition-all duration-300 ${
              isListening
                ? "bg-red-500 text-white animate-pulse shadow-lg scale-110"
                : "bg-primary hover:bg-primary-hover text-white shadow-sm"
            }`}
          >
            {isListening ? <MicOff size={28} /> : <Mic size={28} />}
          </button>
          <div className="text-center">
            <p className="text-sm font-semibold">{isListening ? "Listening..." : "Click to Speak"}</p>
            <p className="text-xs text-secondary mt-1 max-w-xs">
              Say commands like: "Analyze patient compliance" or "Review printer queues"
            </p>
          </div>
        </div>

        {/* Output interpretations */}
        {transcribedText && (
          <div className="p-4 border border-border rounded-xl space-y-3 bg-card">
            <div className="flex justify-between items-center border-b border-border/50 pb-2">
              <span className="text-[10px] uppercase font-bold text-secondary">Transcribed Speech</span>
              {confidence && (
                <span className="text-[10px] text-teal-400 font-bold flex items-center gap-1">
                  <CheckCircle2 size={12} /> {Math.round(confidence * 100)}% Confidence
                </span>
              )}
            </div>
            
            <p className="text-sm font-mono text-slate-300 italic">
              "{transcribedText}"
            </p>

            {interpretedAction && (
              <div className="p-3 bg-primary/5 border border-primary/10 rounded-lg text-xs space-y-1.5 mt-2">
                <span className="font-bold flex items-center gap-1 text-primary">
                  <MessageSquareCode size={14} /> Action Triggered
                </span>
                <p className="text-secondary">{interpretedAction}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
