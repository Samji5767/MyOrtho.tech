import React from "react";

interface NativeAlertProps {
  isOpen: boolean;
  title: string;
  message: string;
  primaryActionLabel?: string;
  primaryActionDestructive?: boolean;
  secondaryActionLabel?: string;
  onPrimaryAction: () => void;
  onSecondaryAction?: () => void;
  onClose: () => void;
}

export default function NativeAlert({
  isOpen,
  title,
  message,
  primaryActionLabel = "OK",
  primaryActionDestructive = false,
  secondaryActionLabel = "Cancel",
  onPrimaryAction,
  onSecondaryAction,
  onClose
}: NativeAlertProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/40 backdrop-blur-sm ios-sheet-backdrop">
      <div className="w-full max-w-[270px] bg-card/90 dark:bg-card/95 backdrop-blur-md rounded-[14px] overflow-hidden text-center shadow-lg border border-border/30 ios-alert-content font-sans">
        <div className="p-4 space-y-1">
          <h3 className="font-extrabold text-sm text-foreground">{title}</h3>
          <p className="text-[11px] text-secondary leading-normal">{message}</p>
        </div>
        
        <div className="flex flex-col border-t border-border/40">
          <button
            onClick={() => {
              onPrimaryAction();
              onClose();
            }}
            className={`w-full py-2.5 text-xs font-bold border-b border-border/30 last:border-none hover:bg-slate-500/10 active:bg-slate-500/20 transition-all ${
              primaryActionDestructive ? "text-rose-500 font-extrabold" : "text-primary"
            }`}
          >
            {primaryActionLabel}
          </button>
          
          {onSecondaryAction && (
            <button
              onClick={() => {
                if (onSecondaryAction) onSecondaryAction();
                onClose();
              }}
              className="w-full py-2.5 text-xs font-semibold text-primary border-b border-border/30 last:border-none hover:bg-slate-500/10 active:bg-slate-500/20 transition-all"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
