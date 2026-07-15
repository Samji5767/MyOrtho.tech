import { Controller, Get, Header, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { AuthGuard } from '../auth/auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermission } from '../auth/require-permission.decorator';
import { BackgroundJobsService } from '../background-jobs/background-jobs.service';
import { MlopsService } from '../mlops/mlops.service';
import { WorkerService } from '../background-jobs/worker.service';

interface AuthUser { id: string; orgId: string | null }
function getOrgId(req: Request): string {
  const u = (req as Request & { user?: AuthUser }).user;
  return u?.orgId ?? 'system';
}

@Controller('api/metrics')
@UseGuards(AuthGuard, PermissionsGuard)
@RequirePermission('admin:settings')
export class MetricsController {
  constructor(
    private readonly jobs: BackgroundJobsService,
    private readonly mlops: MlopsService,
    private readonly worker: WorkerService,
  ) {}

  @Get()
  async getMetrics(@Req() req: Request) {
    const orgId = getOrgId(req);
    const [jobStats, aiStats, workerStats] = await Promise.all([
      this.jobs.getStats(orgId),
      this.mlops.getUtilizationStats(orgId),
      Promise.resolve(this.worker.getWorkerStats()),
    ]);
    return { jobQueue: jobStats, aiInference: aiStats, worker: workerStats, collectedAt: new Date().toISOString() };
  }

  @Get('prometheus')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  async getPrometheus(@Req() req: Request): Promise<string> {
    const orgId = getOrgId(req);
    const [jobStats, aiStats, workerStats] = await Promise.all([
      this.jobs.getStats(orgId),
      this.mlops.getUtilizationStats(orgId),
      Promise.resolve(this.worker.getWorkerStats()),
    ]);

    const lines: string[] = [
      '# HELP myortho_background_jobs_total Total background jobs by status',
      '# TYPE myortho_background_jobs_total gauge',
    ];
    for (const [status, count] of Object.entries(jobStats)) {
      lines.push(`myortho_background_jobs_total{status="${status}"} ${count}`);
    }

    lines.push(
      '# HELP myortho_worker_active_jobs Currently executing jobs',
      '# TYPE myortho_worker_active_jobs gauge',
      `myortho_worker_active_jobs ${workerStats.activeJobs}`,
      '# HELP myortho_worker_concurrency Worker concurrency limit',
      '# TYPE myortho_worker_concurrency gauge',
      `myortho_worker_concurrency ${workerStats.concurrency}`,
      '# HELP myortho_ai_inferences_total Total AI inference calls',
      '# TYPE myortho_ai_inferences_total counter',
      `myortho_ai_inferences_total ${aiStats.totalInferences}`,
      '# HELP myortho_ai_disclaimer_rate Fraction of AI calls with disclaimer shown',
      '# TYPE myortho_ai_disclaimer_rate gauge',
      `myortho_ai_disclaimer_rate ${aiStats.disclaimerShownRate.toFixed(4)}`,
    );

    for (const [model, count] of Object.entries(aiStats.byModel)) {
      lines.push(`myortho_ai_inferences_by_model_total{model="${model}"} ${count}`);
    }

    return lines.join('\n') + '\n';
  }
}
