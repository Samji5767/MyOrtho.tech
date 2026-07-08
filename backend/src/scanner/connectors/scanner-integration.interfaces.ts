/**
 * Scanner Integration Architecture
 * Extension points for 3shape, Medit, iTero, Carestream and future scanners.
 * These interfaces define the contract for scanner connectors.
 * Actual implementations are registered per-device and loaded at runtime.
 */

export type ScannerBrand = '3shape' | 'medit' | 'itero' | 'carestream' | 'planmeca' | 'sirona' | 'custom';
export type ScannerConnectionStatus = 'connected' | 'disconnected' | 'pairing' | 'error' | 'unknown';
export type ScanFileFormat = 'stl' | 'obj' | 'ply' | 'dcm' | '3ox' | 'tdw';

export interface ScannerDevice {
  deviceId: string;
  brand: ScannerBrand;
  model: string;
  firmwareVersion: string;
  connectionStatus: ScannerConnectionStatus;
  lastSeenAt: string;
  capabilities: ScannerCapabilities;
}

export interface ScannerCapabilities {
  supportsFullArch: boolean;
  supportsBiteRegistration: boolean;
  supportsCBCTFusion: boolean;
  supportedFormats: ScanFileFormat[];
  maxResolutionMicrons: number;
  colorCapture: boolean;
}

export interface ScanTransferRequest {
  deviceId: string;
  patientId: string;
  caseId: string;
  archType: 'upper' | 'lower' | 'both' | 'bite';
  format: ScanFileFormat;
  requestedAt: string;
}

export interface ScanTransferResult {
  requestId: string;
  success: boolean;
  fileUrls: string[];
  format: ScanFileFormat;
  transferDurationMs: number;
  errors: string[];
}

/** Abstract contract for all scanner connectors */
export abstract class ScannerConnector {
  abstract readonly brand: ScannerBrand;
  abstract discover(): Promise<ScannerDevice[]>;
  abstract connect(deviceId: string): Promise<void>;
  abstract disconnect(deviceId: string): Promise<void>;
  abstract requestScan(req: ScanTransferRequest): Promise<ScanTransferResult>;
  abstract getStatus(deviceId: string): Promise<ScannerConnectionStatus>;
}

export interface ScannerIntegrationConfig {
  brand: ScannerBrand;
  enabled: boolean;
  connectionType: 'usb' | 'network' | 'cloud_api';
  endpoint?: string;
  apiKey?: string;
  autoDiscovery: boolean;
  pollingIntervalMs: number;
}
