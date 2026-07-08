/**
 * Printer Integration Architecture
 * Extension points for SprintRay, Formlabs, Asiga, NextDent, Ackuretta, Carbon and future printers.
 * These interfaces define the contract for printer connectors.
 * Actual implementations are registered per-device and loaded at runtime.
 */

export type PrinterBrand = 'sprintray' | 'formlabs' | 'asiga' | 'nextdent' | 'ackuretta' | 'carbon' | 'custom';
export type PrintJobStatus = 'queued' | 'printing' | 'post_processing' | 'complete' | 'failed' | 'cancelled';

export interface PrinterCapabilities {
  maxBuildVolumeMm: { x: number; y: number; z: number };
  minLayerHeightMicrons: number;
  maxLayerHeightMicrons: number;
  supportedResins: string[];
  xyzResolutionMicrons: number;
  estimatedSpeedMmPerHour: number;
}

export interface PrinterDevice {
  deviceId: string;
  brand: PrinterBrand;
  model: string;
  firmwareVersion: string;
  ipAddress: string;
  capabilities: PrinterCapabilities;
  isOnline: boolean;
  lastSeenAt: string;
}

export interface SupportSettings {
  autoSupport: boolean;
  supportDensityPercent: number;
  touchPointSizeMm: number;
  raftEnabled: boolean;
}

export interface PrintJobRequest {
  stlFileUrl: string;
  resinCode: string;
  layerHeightMicrons: number;
  copies: number;
  supportSettings: SupportSettings;
}

export interface PrintJobResult {
  jobId: string;
  status: PrintJobStatus;
  actualLayerCount: number;
  resinUsedMl: number;
  durationMs: number;
  errors: string[];
}

/** Abstract contract for all printer connectors */
export abstract class PrinterConnector {
  abstract readonly brand: PrinterBrand;
  abstract discover(): Promise<PrinterDevice[]>;
  abstract connect(deviceId: string, apiKey?: string): Promise<void>;
  abstract submitJob(deviceId: string, request: PrintJobRequest): Promise<PrintJobResult>;
  abstract getJobStatus(deviceId: string, jobId: string): Promise<PrintJobStatus>;
  abstract cancelJob(deviceId: string, jobId: string): Promise<boolean>;
}

export interface PrinterIntegrationConfig {
  brand: PrinterBrand;
  enabled: boolean;
  connectionType: 'usb' | 'network' | 'cloud_api';
  endpoint?: string;
  apiKey?: string;
  autoDiscovery: boolean;
  pollingIntervalMs: number;
}
