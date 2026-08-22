import { api } from './client';

/**
 * Canonical per-tooth movement — signed anatomical components, cumulative at
 * the stage they are attached to. Mirrors backend tooth_movements
 * (migration 075).
 */
export interface ToothMovementValues {
  mesiodistalMm: number; //  mesial + / distal −
  buccolingualMm: number; //  buccal + / lingual −
  occlusogingivalMm: number; //  extrusion + / intrusion −
  rotationDeg: number; //  about tooth long axis, mesial-in +
  tipDeg: number; //  crown angulation, mesial tip +
  torqueDeg: number; //  root torque, buccal +
}

export interface ToothMovement extends ToothMovementValues {
  id: string;
  stageId: string;
  fdiNumber: number;
  isLocked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMovementDto extends Partial<ToothMovementValues> {
  fdiNumber: number;
  isLocked?: boolean;
  notes?: string;
}

const base = (caseId: string, planId: string, stageId: string) =>
  `/api/cases/${caseId}/plans/${planId}/stages/${stageId}/tooth-movements`;

export function listToothMovements(
  caseId: string,
  planId: string,
  stageId: string,
): Promise<ToothMovement[]> {
  return api.get<ToothMovement[]>(base(caseId, planId, stageId));
}

export function upsertToothMovement(
  caseId: string,
  planId: string,
  stageId: string,
  dto: UpsertMovementDto,
): Promise<ToothMovement> {
  return api.put<ToothMovement>(base(caseId, planId, stageId), dto);
}

export function deleteToothMovement(
  caseId: string,
  planId: string,
  stageId: string,
  fdiNumber: number,
): Promise<{ deleted: boolean; fdiNumber: number }> {
  return api.delete(`${base(caseId, planId, stageId)}/${fdiNumber}`);
}
