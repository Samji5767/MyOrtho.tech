import { Injectable, Logger } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

export interface ProductionCenter {
  id: string;
  name: string;
  region: string;
  maxCapacity: number;
  currentJobsCount: number;
  slaPerformance: number; // e.g. 98.5%
}

@Injectable()
export class ManufacturingRouterService {
  private readonly logger = new Logger(ManufacturingRouterService.name);
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  private mockCenters: ProductionCenter[] = [
    { id: "lab_us", name: "Boston Aligner Production Hub", region: "US-East", maxCapacity: 200, currentJobsCount: 145, slaPerformance: 0.992 },
    { id: "lab_eu", name: "Stuttgart Dental Center", region: "EU-Central", maxCapacity: 150, currentJobsCount: 142, slaPerformance: 0.985 },
    { id: "lab_apac", name: "Singapore Digital Ortho Lab", region: "APAC-South", maxCapacity: 100, currentJobsCount: 45, slaPerformance: 0.998 }
  ];

  /**
   * Evaluates closest regional lab centers, checking capacity limits and routing print job.
   */
  async routePrintJob(jobId: string, caseRegion: string): Promise<string> {
    this.logger.log(`Manufacturing Router: Routing print job ${jobId} for region ${caseRegion}`);

    // Find center in the same region
    let targetCenter = this.mockCenters.find(c => c.region.toLowerCase() === caseRegion.toLowerCase());

    // Capacity Balancing Logic: If target regional lab is near capacity limit (>90%), reroute to alternative lab
    if (!targetCenter || (targetCenter.currentJobsCount / targetCenter.maxCapacity) > 0.90) {
      this.logger.warn(`Region ${caseRegion} capacity warning! Routing to alternative under-utilized regional lab.`);
      
      // Find center with the lowest utilization ratio
      targetCenter = [...this.mockCenters]
        .sort((a, b) => (a.currentJobsCount / a.maxCapacity) - (b.currentJobsCount / b.maxCapacity))[0];
    }

    this.logger.log(`Manufacturing Router: Job ${jobId} routed successfully to ${targetCenter.name} (${targetCenter.region})`);
    
    // Simulate updating database record
    await this.supabase
      .from('print_jobs')
      .update({ 
        printer_id: targetCenter.id, // routing target
        status: 'queued'
      })
      .eq('id', jobId);

    return targetCenter.id;
  }

  async getProductionTelemetry(): Promise<ProductionCenter[]> {
    return this.mockCenters;
  }
}
