// Printer connector interfaces and implementations for 3D dental printers.
//
// Honesty contract: No connector may return a successful result when credentials
// or network access are absent. All simulated connectors that lack real
// credentials must surface ConnectorError.notConfigured.

export interface PrintJobDetails {
  jobId: string;
  gcodeUrl: string;
  sliceCount: number;
  materialVolumeMl: number;
}

export interface PrinterTelemetry {
  status: 'idle' | 'printing' | 'error' | 'offline' | 'not_configured';
  temperatureC?: number;
  resinVolumeMl: number;
  progressPercent?: number;
  currentSlice?: number;
  connectorStatus: ConnectorStatus;
}

export type ConnectorStatus =
  | 'not_configured'
  | 'connector_required'
  | 'configured'
  | 'offline'
  | 'online'
  | 'error';

export class ConnectorError extends Error {
  readonly code: ConnectorStatus;
  constructor(code: ConnectorStatus, message: string) {
    super(message);
    this.name = 'ConnectorError';
    this.code = code;
  }

  static notConfigured(brand: string) {
    return new ConnectorError(
      'not_configured',
      `${brand} connector is not configured. ` +
        'Provide valid API credentials before submitting print jobs.',
    );
  }

  static connectorRequired(brand: string) {
    return new ConnectorError(
      'connector_required',
      `${brand} requires a dedicated connector plugin. ` +
        'Install and configure the connector before printing.',
    );
  }
}

export interface PrinterConnector {
  brand: string;
  connectorStatus: ConnectorStatus;
  connect(ipAddress: string, apiKey?: string): Promise<ConnectorStatus>;
  getTelemetry(ipAddress: string): Promise<PrinterTelemetry>;
  sendPrintJob(ipAddress: string, job: PrintJobDetails): Promise<boolean>;
  cancelPrintJob(ipAddress: string, jobId: string): Promise<boolean>;
}

// ── Formlabs Connector ────────────────────────────────────────────────────────
//
// Status: Connector Required — real integration requires Formlabs Fleet Control
// API keys from https://formlabs.com/software/fleet-control/
//
// This stub surfaces the correct error state rather than faking success.

export class FormlabsConnector implements PrinterConnector {
  readonly brand = 'Formlabs';
  connectorStatus: ConnectorStatus = 'connector_required';

  async connect(_ipAddress: string, apiKey?: string): Promise<ConnectorStatus> {
    if (!apiKey) {
      this.connectorStatus = 'connector_required';
      return 'connector_required';
    }
    // Real credential validation would go here
    this.connectorStatus = 'configured';
    return 'configured';
  }

  async getTelemetry(_ipAddress: string): Promise<PrinterTelemetry> {
    return {
      status: 'not_configured',
      resinVolumeMl: 0,
      connectorStatus: this.connectorStatus,
    };
  }

  async sendPrintJob(_ipAddress: string, _job: PrintJobDetails): Promise<boolean> {
    throw ConnectorError.connectorRequired(this.brand);
  }

  async cancelPrintJob(_ipAddress: string, _jobId: string): Promise<boolean> {
    throw ConnectorError.connectorRequired(this.brand);
  }
}

// ── SprintRay Connector ───────────────────────────────────────────────────────
//
// Status: Connector Required — real integration requires SprintRay Cloud API
// credentials from https://sprintray.com/
//
// This stub surfaces the correct error state rather than faking success.

export class SprintRayConnector implements PrinterConnector {
  readonly brand = 'SprintRay';
  connectorStatus: ConnectorStatus = 'connector_required';

  async connect(_ipAddress: string, apiKey?: string): Promise<ConnectorStatus> {
    if (!apiKey) {
      this.connectorStatus = 'connector_required';
      return 'connector_required';
    }
    this.connectorStatus = 'configured';
    return 'configured';
  }

  async getTelemetry(_ipAddress: string): Promise<PrinterTelemetry> {
    return {
      status: 'not_configured',
      resinVolumeMl: 0,
      connectorStatus: this.connectorStatus,
    };
  }

  async sendPrintJob(_ipAddress: string, _job: PrintJobDetails): Promise<boolean> {
    throw ConnectorError.connectorRequired(this.brand);
  }

  async cancelPrintJob(_ipAddress: string, _jobId: string): Promise<boolean> {
    throw ConnectorError.connectorRequired(this.brand);
  }
}

// ── Generic Printer Connector ─────────────────────────────────────────────────
//
// Used for any printer brand that is not yet natively supported.
// Always surfaces not_configured unless a custom endpoint is provided.

export class GenericPrinterConnector implements PrinterConnector {
  readonly brand: string;
  connectorStatus: ConnectorStatus = 'not_configured';
  private apiEndpoint: string | null = null;

  constructor(brand: string) {
    this.brand = brand;
  }

  async connect(ipAddress: string, apiKey?: string): Promise<ConnectorStatus> {
    if (!ipAddress && !apiKey) {
      this.connectorStatus = 'not_configured';
      return 'not_configured';
    }
    this.apiEndpoint = ipAddress;
    // Without a real connector plugin, we cannot actually connect
    this.connectorStatus = 'connector_required';
    return 'connector_required';
  }

  async getTelemetry(_ipAddress: string): Promise<PrinterTelemetry> {
    return {
      status: 'not_configured',
      resinVolumeMl: 0,
      connectorStatus: this.connectorStatus,
    };
  }

  async sendPrintJob(_ipAddress: string, _job: PrintJobDetails): Promise<boolean> {
    throw ConnectorError.notConfigured(this.brand);
  }

  async cancelPrintJob(_ipAddress: string, _jobId: string): Promise<boolean> {
    throw ConnectorError.notConfigured(this.brand);
  }
}

// ── Registry ──────────────────────────────────────────────────────────────────

const CONNECTORS: Record<string, () => PrinterConnector> = {
  Formlabs: () => new FormlabsConnector(),
  SprintRay: () => new SprintRayConnector(),
};

export function getConnector(brand: string): PrinterConnector {
  const factory = CONNECTORS[brand];
  return factory ? factory() : new GenericPrinterConnector(brand);
}
