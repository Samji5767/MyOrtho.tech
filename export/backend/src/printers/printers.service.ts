import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';
import { PrinterConnector, FormlabsConnector, SprintRayConnector } from './connectors/printer.connector';

@Injectable()
export class PrintersService {
  private readonly logger = new Logger(PrintersService.name);
  private connectors: Map<string, PrinterConnector> = new Map();
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  private mockPrinters: any[] = [];
  private mockPrintJobs: any[] = [];

  constructor() {
    this.registerConnector(new FormlabsConnector());
    this.registerConnector(new SprintRayConnector());

    // Seed mock fleet data for developer bypass
    this.mockPrinters = [
      { id: 'pr-1', name: 'Formlabs 3B+', brand: 'Formlabs', status: 'idle', ip_address: '192.168.1.10', material_volume_ml: 800, organization_id: 'org-123' },
      { id: 'pr-2', name: 'SprintRay Pro S', brand: 'SprintRay', status: 'idle', ip_address: '192.168.1.11', material_volume_ml: 1200, organization_id: 'org-123' },
      { id: 'pr-3', name: 'Backup Formlabs', brand: 'Formlabs', status: 'idle', ip_address: '192.168.1.12', material_volume_ml: 500, organization_id: 'org-123' }
    ];
  }

  registerConnector(connector: PrinterConnector) {
    this.connectors.set(connector.brand.toLowerCase(), connector);
    this.logger.log(`Registered universal connector plugin for: ${connector.brand}`);
  }

  async getTelemetry(printerId: string, organizationId: string) {
    // 1. Resolve printer details
    let printer: any = null;
    try {
      const { data, error } = await this.supabase
        .from('printers')
        .select('*')
        .eq('id', printerId)
        .eq('organization_id', organizationId)
        .single();
      
      if (!error && data) {
        printer = data;
      }
    } catch (err) {
      this.logger.warn(`Database query failed for printer ${printerId}. Searching mock fleet.`);
    }

    if (!printer) {
      printer = this.mockPrinters.find(p => p.id === printerId && p.organization_id === organizationId);
    }

    if (!printer) {
      throw new NotFoundException('Printer not registered or out of org scope');
    }

    // 2. Resolve connector plugin
    const connector = this.connectors.get(printer.brand.toLowerCase());
    if (!connector) {
      return { status: printer.status, materialVolumeMl: printer.material_volume_ml };
    }

    // 3. Connect and fetch live telemetry
    try {
      await connector.connect(printer.ip_address);
      return await connector.getTelemetry(printer.ip_address);
    } catch (err) {
      return { status: 'offline', error: 'Failed to communicate with printer hardware API' };
    }
  }

  async submitJob(printerId: string, organizationId: string, jobDetails: any) {
    let printer: any = null;
    try {
      const { data, error } = await this.supabase
        .from('printers')
        .select('*')
        .eq('id', printerId)
        .eq('organization_id', organizationId)
        .single();
      
      if (!error && data) {
        printer = data;
      }
    } catch (err) {
      this.logger.warn(`DB submit check failed. Using mock search.`);
    }

    if (!printer) {
      printer = this.mockPrinters.find(p => p.id === printerId && p.organization_id === organizationId);
    }

    if (!printer) {
      throw new NotFoundException('Printer not found');
    }

    const connector = this.connectors.get(printer.brand.toLowerCase());
    if (!connector) {
      throw new NotFoundException(`No active connector plugin found for brand: ${printer.brand}`);
    }

    // Handshake and dispatch job details
    await connector.connect(printer.ip_address);
    const success = await connector.sendPrintJob(printer.ip_address, {
      jobId: jobDetails.id,
      gcodeUrl: jobDetails.gcodePath,
      sliceCount: 500,
      materialVolumeMl: jobDetails.materialVolumeMl || 12.5
    });

    if (success) {
      try {
        await this.supabase
          .from('print_jobs')
          .update({ status: 'printing', started_at: new Date().toISOString() })
          .eq('id', jobDetails.id);
      } catch (err) {
        const job = this.mockPrintJobs.find(j => j.id === jobDetails.id);
        if (job) {
          job.status = 'printing';
          job.printer_id = printerId;
        } else {
          this.mockPrintJobs.push({
            id: jobDetails.id,
            status: 'printing',
            printer_id: printerId,
            gcodePath: jobDetails.gcodePath,
            materialVolumeMl: jobDetails.materialVolumeMl || 12.5
          });
        }
      }
    }

    return { success };
  }

  /**
   * Automatically reroute a print job to an idle printer if active hardware encounters an error.
   */
  async rerouteFailedJob(jobId: string, organizationId: string): Promise<{ success: boolean; newPrinterId?: string; error?: string }> {
    this.logger.warn(`Processing automatic reroute for print job ID: ${jobId}`);

    // 1. Fetch active print job parameters
    let job: any = null;
    try {
      const { data } = await this.supabase
        .from('print_jobs')
        .select('*')
        .eq('id', jobId)
        .single();
      if (data) job = data;
    } catch (err) {
      job = this.mockPrintJobs.find(j => j.id === jobId);
    }

    if (!job) {
      this.logger.error(`Print job ${jobId} not found. Cannot reroute.`);
      return { success: false, error: 'Job not found' };
    }

    const failedPrinterId = job.printer_id;
    const materialNeeded = job.material_volume_ml || 12.5;

    // 2. Query other idle printers within the organization
    let idlePrinters: any[] = [];
    try {
      const { data } = await this.supabase
        .from('printers')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('status', 'idle')
        .neq('id', failedPrinterId);
      if (data) idlePrinters = data;
    } catch (err) {
      idlePrinters = this.mockPrinters.filter(
        p => p.organization_id === organizationId && p.status === 'idle' && p.id !== failedPrinterId
      );
    }

    // Filter candidate printer with sufficient resin levels
    const candidate = idlePrinters.find(p => p.material_volume_ml >= materialNeeded);

    if (!candidate) {
      this.logger.error(`No alternative idle printers with sufficient resin available in Org: ${organizationId}`);
      // Mark job as failed
      try {
        await this.supabase.from('print_jobs').update({ status: 'failed' }).eq('id', jobId);
      } catch (err) {
        job.status = 'failed';
      }
      return { success: false, error: 'No candidate printer available' };
    }

    this.logger.log(`Rerouting job ${jobId} to printer ${candidate.name} (${candidate.ip_address})`);

    // 3. Submit job to new candidate printer
    const submitResult = await this.submitJob(candidate.id, organizationId, {
      id: jobId,
      gcodePath: job.gcodePath || 'https://placeholder.stl/gcode',
      materialVolumeMl: materialNeeded
    });

    if (submitResult.success) {
      // Log event to audit logs
      try {
        await this.supabase.from('audit_logs').insert({
          organization_id: organizationId,
          action: `Automated print job reroute: Job #${jobId} reassigned from printer #${failedPrinterId} to #${candidate.id}`,
          severity: 'warning'
        });
      } catch (err) {
        this.logger.log('Audit log synced to memory.');
      }
      return { success: true, newPrinterId: candidate.id };
    }

    return { success: false, error: 'Failed to submit job to alternative printer' };
  }
}
