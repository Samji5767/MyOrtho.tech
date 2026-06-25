import { api } from './client';

export interface ToothMovement {
  id: string;
  stageId: string;
  fdiNumber: number;
  translateX: number;
  translateY: number;
  translateZ: number;
  rotateX: number;
  rotateY: number;
  rotateZ: number;
  tip: number;
  torque: number;
  intrusion: number;
  extrusion: number;
  isLocked: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface UpsertMovementDto {
  fdiNumber: number;
  translateX?: number;
  translateY?: number;
  translateZ?: number;
  rotateX?: number;
  rotateY?: number;
  rotateZ?: number;
  tip?: number;
  torque?: number;
  intrusion?: number;
  extrusion?: number;
  isLocked?: boolean;
  notes?: string;
}

export interface ClinicalMeasurement {
  id: string;
  caseId: string;
  measuredBy: string | null;
  measuredByEmail: string | null;
  measurementLabel: string | null;
  overjetMm: number | null;
  overbitemm: number | null;
  angleClass: string | null;
  distanceMm: number | null;
  notes: string | null;
  createdAt: string;
}

export interface CreateMeasurementDto {
  measurementLabel?: string;
  overjetMm?: number;
  overbitemm?: number;
  angleClass?: string;
  distanceMm?: number;
  notes?: string;
}

export function listToothMovements(
  caseId: string,
  planId: string,
  stageId: string,
): Promise<ToothMovement[]> {
  return api.get<ToothMovement[]>(
    `/api/cases/${caseId}/plans/${planId}/stages/${stageId}/tooth-movements`,
  );
}

export function upsertToothMovement(
  caseId: string,
  planId: string,
  stageId: string,
  dto: UpsertMovementDto,
): Promise<ToothMovement> {
  return api.put<ToothMovement>(
    `/api/cases/${caseId}/plans/${planId}/stages/${stageId}/tooth-movements`,
    dto,
  );
}

export function deleteToothMovement(
  caseId: string,
  planId: string,
  stageId: string,
  fdiNumber: number,
): Promise<{ deleted: boolean; fdiNumber: number }> {
  return api.delete(`/api/cases/${caseId}/plans/${planId}/stages/${stageId}/tooth-movements/${fdiNumber}`);
}

export function listMeasurements(caseId: string): Promise<ClinicalMeasurement[]> {
  return api.get<ClinicalMeasurement[]>(`/api/cases/${caseId}/measurements`);
}

export function createMeasurement(
  caseId: string,
  dto: CreateMeasurementDto,
): Promise<{ id: string; caseId: string; createdAt: string }> {
  return api.post(`/api/cases/${caseId}/measurements`, dto);
}
