import React from "react";
import { X } from "lucide-react";

interface NativeSheetProps {
  isOpen: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}

export default function NativeSheet({ isOpen, title, onClose, children }: NativeSheetProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/30 backdrop-blur-sm ios-sheet-backdrop">
      {/* Tap backdrop to close */}
      <div className="absolute inset-0" onClick={onClose} />
      
      {/* Sliding Sheet Panel */}
      <div className="w-full max-w-lg bg-card border-t border-border rounded-t-3xl shadow-xl z-10 flex flex-col justify-between max-h-[85vh] ios-sheet-content pb-safe-bottom">
        
        {/* iOS Drag Handle */}
        <div className="w-full flex justify-center py-2 shrink-0">
          <div className="w-10 h-1 bg-slate-300 dark:bg-slate-800 rounded-full" />
        </div>
        
        {/* Title & Close Header */}
        <div className="flex items-center justify-between px-5 pb-3 border-b border-border/40 shrink-0">
          <h3 className="font-extrabold text-sm text-foreground">{title}</h3>
          <button 
            onClick={onClose}
            className="p-1.5 bg-slate-100 dark:bg-slate-900 border border-border/40 hover:bg-slate-200 dark:hover:bg-slate-805 rounded-full text-secondary transition-colors"
          >
            <X size={14} />
          </button>
        </div>
        
        {/* Sheet Contents */}
        <div className="flex-1 overflow-y-auto px-5 py-4 text-xs no-scrollbar">
          {children}
        </div>
      </div>
    </div>
  );
}
