"use client";

/**
 * CasePlanningContext — single source of truth for all planning state.
 *
 * Consumed by:
 *   OrthoAnalysisTabs  (write movements, attachments, IPR, measurements)
 *   OrthoWorkflowRail  (write workflow step status)
 *   CADEngine          (read movements → apply to 3D transforms)
 *   AlignerStaging     (read/write currentStage)
 */

import {
  createContext, useContext, useReducer, useEffect, useRef,
  type ReactNode,
} from "react";

// ─── Domain types ─────────────────────────────────────────────────────────────

export interface PlanningMovement {
  fdi: number;
  tx: number;   // Mesial(+) / Distal(−) mm
  ty: number;   // Buccal(+) / Lingual(−) mm
  tz: number;   // Extrusion(+) / Intrusion(−) mm
  tip: number;       // degrees
  torque: number;    // degrees
  rotation: number;  // degrees
}

export interface PlanningAttachment {
  id: string;
  fdi: number;
  type: string;
  surface: string;
  stage: number;
}

export type IPRSafety = "safe" | "warning" | "unsafe";

export interface PlanningIPR {
  id: string;
  toothA: number;
  toothB: number;
  amount: number;
  stage: number;
  safety: IPRSafety;
}

export interface PlanningMeasurement {
  id: string;
  label: string;
  value: string;
  unit: string;
  note: string;
}

export type WorkflowStepStatus = "not_started" | "in_progress" | "complete" | "needs_review";

export interface CasePlanningState {
  caseId: string | null;
  // Per-tooth movements (keyed by FDI)
  movements: Record<number, PlanningMovement>;
  // Attachment plan
  attachments: PlanningAttachment[];
  // IPR plan
  iprEntries: PlanningIPR[];
  // Measurement table
  measurements: PlanningMeasurement[];
  // Workflow progress
  workflowSteps: Record<string, WorkflowStepStatus>;
  // Staging
  currentStage: number;
  totalStages: number;
  // Viewport modifiers
  showGhostArch: boolean;
  ghostOpacity: number;        // 0-1
  clippingAxis: "none" | "axial" | "coronal" | "sagittal";
  clippingPosition: number;    // −4 to 4 (scene units)
  showRoots: boolean;
}

// ─── Actions ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "SET_CASE_ID"; caseId: string | null }
  | { type: "UPDATE_MOVEMENT"; fdi: number; mov: Partial<PlanningMovement> }
  | { type: "RESET_MOVEMENT"; fdi: number }
  | { type: "RESET_ALL_MOVEMENTS" }
  | { type: "ADD_ATTACHMENT"; entry: PlanningAttachment }
  | { type: "REMOVE_ATTACHMENT"; id: string }
  | { type: "ADD_IPR"; entry: PlanningIPR }
  | { type: "REMOVE_IPR"; id: string }
  | { type: "UPDATE_MEASUREMENT"; id: string; value: string }
  | { type: "SET_MEASUREMENTS"; measurements: PlanningMeasurement[] }
  | { type: "SET_WORKFLOW_STEP"; stepId: string; status: WorkflowStepStatus }
  | { type: "SET_STAGE"; stage: number }
  | { type: "SET_TOTAL_STAGES"; total: number }
  | { type: "TOGGLE_GHOST_ARCH" }
  | { type: "SET_GHOST_OPACITY"; opacity: number }
  | { type: "SET_CLIPPING_AXIS"; axis: CasePlanningState["clippingAxis"] }
  | { type: "SET_CLIPPING_POSITION"; position: number }
  | { type: "TOGGLE_ROOTS" }
  | { type: "LOAD_PERSISTED"; partial: Partial<CasePlanningState> };

// ─── Default state ────────────────────────────────────────────────────────────

const DEFAULT_MEASUREMENTS: PlanningMeasurement[] = [
  { id: "overjet",    label: "Overjet",             value: "4.2",  unit: "mm", note: "Pre-treatment" },
  { id: "overbite",   label: "Overbite",            value: "3.1",  unit: "mm", note: "Pre-treatment" },
  { id: "intercan",   label: "Intercanine Width",   value: "32.4", unit: "mm", note: "Upper arch" },
  { id: "intermol",   label: "Intermolar Width",    value: "51.8", unit: "mm", note: "Upper arch" },
  { id: "arch_u",     label: "Upper Arch Length",   value: "78.2", unit: "mm", note: "Pre-treatment" },
  { id: "arch_l",     label: "Lower Arch Length",   value: "75.6", unit: "mm", note: "Pre-treatment" },
  { id: "crowding_u", label: "Upper Crowding",      value: "4.8",  unit: "mm", note: "Estimated" },
  { id: "crowding_l", label: "Lower Crowding",      value: "3.2",  unit: "mm", note: "Estimated" },
];

const INITIAL_STATE: CasePlanningState = {
  caseId: null,
  movements: {},
  attachments: [
    { id: "att_demo_1", fdi: 13, type: "Rotation",             surface: "Buccal", stage: 1 },
    { id: "att_demo_2", fdi: 23, type: "Rotation",             surface: "Buccal", stage: 1 },
    { id: "att_demo_3", fdi: 14, type: "Vertical Rectangular", surface: "Buccal", stage: 2 },
    { id: "att_demo_4", fdi: 24, type: "Vertical Rectangular", surface: "Buccal", stage: 2 },
  ],
  iprEntries: [
    { id: "ipr_demo_1", toothA: 12, toothB: 13, amount: 0.20, stage: 3, safety: "safe" },
    { id: "ipr_demo_2", toothA: 22, toothB: 23, amount: 0.20, stage: 3, safety: "safe" },
    { id: "ipr_demo_3", toothA: 32, toothB: 33, amount: 0.25, stage: 5, safety: "safe" },
  ],
  measurements: DEFAULT_MEASUREMENTS,
  workflowSteps: {},
  currentStage: 0,
  totalStages: 22,
  showGhostArch: false,
  ghostOpacity: 0.18,
  clippingAxis: "none",
  clippingPosition: 0,
  showRoots: false,
};

// ─── Reducer ──────────────────────────────────────────────────────────────────

function emptyMovement(fdi: number): PlanningMovement {
  return { fdi, tx: 0, ty: 0, tz: 0, tip: 0, torque: 0, rotation: 0 };
}

function reducer(state: CasePlanningState, action: Action): CasePlanningState {
  switch (action.type) {
    case "SET_CASE_ID":
      return { ...state, caseId: action.caseId };

    case "UPDATE_MOVEMENT": {
      const prev = state.movements[action.fdi] ?? emptyMovement(action.fdi);
      return {
        ...state,
        movements: { ...state.movements, [action.fdi]: { ...prev, ...action.mov } },
      };
    }

    case "RESET_MOVEMENT": {
      const next = { ...state.movements };
      delete next[action.fdi];
      return { ...state, movements: next };
    }

    case "RESET_ALL_MOVEMENTS":
      return { ...state, movements: {} };

    case "ADD_ATTACHMENT":
      return { ...state, attachments: [...state.attachments, action.entry] };

    case "REMOVE_ATTACHMENT":
      return { ...state, attachments: state.attachments.filter((a) => a.id !== action.id) };

    case "ADD_IPR":
      return { ...state, iprEntries: [...state.iprEntries, action.entry] };

    case "REMOVE_IPR":
      return { ...state, iprEntries: state.iprEntries.filter((e) => e.id !== action.id) };

    case "UPDATE_MEASUREMENT":
      return {
        ...state,
        measurements: state.measurements.map((m) =>
          m.id === action.id ? { ...m, value: action.value } : m
        ),
      };

    case "SET_MEASUREMENTS":
      return { ...state, measurements: action.measurements };

    case "SET_WORKFLOW_STEP":
      return {
        ...state,
        workflowSteps: { ...state.workflowSteps, [action.stepId]: action.status },
      };

    case "SET_STAGE":
      return { ...state, currentStage: action.stage };

    case "SET_TOTAL_STAGES":
      return { ...state, totalStages: action.total };

    case "TOGGLE_GHOST_ARCH":
      return { ...state, showGhostArch: !state.showGhostArch };

    case "SET_GHOST_OPACITY":
      return { ...state, ghostOpacity: action.opacity };

    case "SET_CLIPPING_AXIS":
      return { ...state, clippingAxis: action.axis };

    case "SET_CLIPPING_POSITION":
      return { ...state, clippingPosition: action.position };

    case "TOGGLE_ROOTS":
      return { ...state, showRoots: !state.showRoots };

    case "LOAD_PERSISTED":
      return { ...state, ...action.partial };

    default:
      return state;
  }
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface CasePlanningContextValue {
  state: CasePlanningState;
  dispatch: React.Dispatch<Action>;
}

const CasePlanningContext = createContext<CasePlanningContextValue | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

function persistKey(caseId: string | null): string {
  return caseId ? `mo_plan_${caseId}` : "mo_plan_default";
}

const DEBOUNCE_MS = 800;

export function CasePlanningProvider({
  children,
  caseId,
}: {
  children: ReactNode;
  caseId: string | null;
}) {
  const [state, dispatch] = useReducer(reducer, { ...INITIAL_STATE, caseId });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Set caseId when it changes
  useEffect(() => {
    dispatch({ type: "SET_CASE_ID", caseId });
  }, [caseId]);

  // Load persisted state when caseId changes
  useEffect(() => {
    const key = persistKey(caseId);
    try {
      const raw = localStorage.getItem(key);
      if (raw) {
        const persisted = JSON.parse(raw) as Partial<CasePlanningState>;
        dispatch({ type: "LOAD_PERSISTED", partial: persisted });
      }
    } catch {}
  }, [caseId]);

  // Auto-save on state change (debounced)
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      try {
        const key = persistKey(state.caseId);
        const toSave: Partial<CasePlanningState> = {
          movements:     state.movements,
          attachments:   state.attachments,
          iprEntries:    state.iprEntries,
          measurements:  state.measurements,
          workflowSteps: state.workflowSteps,
          totalStages:   state.totalStages,
          showGhostArch: state.showGhostArch,
          ghostOpacity:  state.ghostOpacity,
          showRoots:     state.showRoots,
        };
        localStorage.setItem(key, JSON.stringify(toSave));
      } catch {}
    }, DEBOUNCE_MS);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [state]);

  return (
    <CasePlanningContext.Provider value={{ state, dispatch }}>
      {children}
    </CasePlanningContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useCasePlanning(): CasePlanningContextValue {
  const ctx = useContext(CasePlanningContext);
  if (!ctx) {
    throw new Error("useCasePlanning must be used inside <CasePlanningProvider>");
  }
  return ctx;
}

// ─── Convenience selectors (memoisation handled by callers) ───────────────────

export function getMovement(
  state: CasePlanningState,
  fdi: number,
): PlanningMovement {
  return state.movements[fdi] ?? emptyMovement(fdi);
}

export function getIPRForPair(
  state: CasePlanningState,
  toothA: number,
  toothB: number,
): number {
  const entry = state.iprEntries.find(
    (e) =>
      (e.toothA === toothA && e.toothB === toothB) ||
      (e.toothA === toothB && e.toothB === toothA),
  );
  return entry?.amount ?? 0;
}

export function hasAttachment(
  state: CasePlanningState,
  fdi: number,
): boolean {
  return state.attachments.some((a) => a.fdi === fdi);
}

export function getAttachmentsForTooth(
  state: CasePlanningState,
  fdi: number,
): PlanningAttachment[] {
  return state.attachments.filter((a) => a.fdi === fdi);
}
