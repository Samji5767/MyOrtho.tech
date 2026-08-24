import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import * as fs from 'fs';
import { ManufacturePrepService } from './manufacture-prep.service';
import { PG_POOL } from '../database/database.module';

const CASE_ID = 'case-111';
const ORG_ID  = 'org-aaa';
const USER_ID = 'user-x';

function makePool(rows: unknown[][] = []) {
  let call = 0;
  return {
    query: jest.fn().mockImplementation(() =>
      Promise.resolve({ rows: rows[call++] ?? [], rowCount: (rows[call - 1] ?? []).length }),
    ),
  };
}

describe('ManufacturePrepService.createExport', () => {
  it('fails with actionable message when no aligner generation plan exists', async () => {
    const pool = makePool([
      // verifyCase → case found
      [{ id: CASE_ID }],
      // aligner_generation_plans lookup → no plan
      [],
      // INSERT returning the export row
      [{
        id: 'exp-1', case_id: CASE_ID, treatment_plan_id: null, export_format: 'stl',
        export_type: 'stage_models', stage_range_from: null, stage_range_to: null,
        status: 'failed',
        error_message: 'No aligner generation plan found for this case.',
        manifest: '{}', generated_by: USER_ID,
        generated_at: new Date(), completed_at: null, created_at: new Date(),
        file_path: null, file_size_bytes: null,
      }],
    ]);

    const module = await Test.createTestingModule({
      providers: [
        ManufacturePrepService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();

    const svc = module.get(ManufacturePrepService);
    const result = await svc.createExport(CASE_ID, ORG_ID, USER_ID, {
      exportFormat: 'stl',
      exportType: 'stage_models',
    });

    // Result is immediate (no async simulation)
    expect(result.status).toBe('failed');
    // Error message points user to the aligner generation step
    expect(result.errorMessage).toMatch(/aligner generation/i);

    // INSERT must have been called
    const insertCall = pool.query.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO manufacture_exports'),
    );
    expect(insertCall).toBeDefined();

    // No UPDATE that sets a file_path (no async background work)
    const allSqls = pool.query.mock.calls.map((c: unknown[]) => c[0] as string);
    const hasFilePath = allSqls.some(
      (sql: string) => sql.includes('file_path') && sql.includes('UPDATE'),
    );
    expect(hasFilePath).toBe(false);
  });

  it('completes only after the export file is verified on disk', async () => {
    const ZIP_PATH = '/app/uploads/cases/case-111/aligner_plan_plan-xyz.zip';
    const statSpy = jest.spyOn(fs, 'statSync').mockReturnValue({
      isFile: () => true,
      size: 12345,
    } as unknown as fs.Stats);

    const pool = makePool([
      [{ id: CASE_ID }],
      [{
        id: 'agp-1', plan_id: 'plan-xyz', total_active_stages: 14,
        stl_export_ready: true, stl_export_path: ZIP_PATH, gen_status: 'approved',
      }],
      [{
        id: 'exp-1', case_id: CASE_ID, treatment_plan_id: 'plan-xyz', export_format: 'stl',
        export_type: 'stage_models', stage_range_from: null, stage_range_to: null,
        status: 'completed', error_message: null, manifest: {},
        generated_by: USER_ID, generated_at: new Date(),
        completed_at: new Date(), created_at: new Date(),
        file_path: ZIP_PATH, file_size_bytes: null,
      }],
    ]);

    const module = await Test.createTestingModule({
      providers: [
        ManufacturePrepService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();

    const svc = module.get(ManufacturePrepService);
    const result = await svc.createExport(CASE_ID, ORG_ID, USER_ID, {
      exportFormat: 'stl',
      exportType: 'stage_models',
      treatmentPlanId: 'plan-xyz',
    });
    statSpy.mockRestore();

    expect(result.status).toBe('completed');
    const insert = pool.query.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO manufacture_exports'),
    )!;
    const params = insert[1] as unknown[];
    expect(params[7]).toBe('completed');
    expect(params[9]).toBe(ZIP_PATH);
    expect(params[10]).toBe(12345); // file_size_bytes column
    const manifest = JSON.parse(params[11] as string) as { file?: { sizeBytes: number } };
    expect(manifest.file?.sizeBytes).toBe(12345);
  });

  it('blocks completion when the export path is outside managed storage', async () => {
    const pool = makePool([
      [{ id: CASE_ID }],
      [{
        id: 'agp-1', plan_id: 'plan-xyz', total_active_stages: 14,
        stl_export_ready: true, stl_export_path: '/etc/passwd', gen_status: 'approved',
      }],
      [{
        id: 'exp-1', case_id: CASE_ID, status: 'failed', manifest: {},
        error_message: 'Export blocked', file_path: null,
        generated_at: new Date(), completed_at: null, created_at: new Date(),
      }],
    ]);

    const module = await Test.createTestingModule({
      providers: [
        ManufacturePrepService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();

    const svc = module.get(ManufacturePrepService);
    await svc.createExport(CASE_ID, ORG_ID, USER_ID, {
      exportFormat: 'stl',
      exportType: 'stage_models',
      treatmentPlanId: 'plan-xyz',
    });

    const insert = pool.query.mock.calls.find((c: unknown[]) =>
      (c[0] as string).includes('INSERT INTO manufacture_exports'),
    )!;
    const params = insert[1] as unknown[];
    expect(params[7]).toBe('failed');
    expect(params[9]).toBeNull();
    expect(String(params[8])).toMatch(/outside managed storage/);
  });

  it('refuses appliance types with no geometry pipeline', async () => {
    const pool = makePool([[{ id: CASE_ID }], []]);
    const module = await Test.createTestingModule({
      providers: [
        ManufacturePrepService,
        { provide: PG_POOL, useValue: pool },
      ],
    }).compile();

    const svc = module.get(ManufacturePrepService);
    await expect(
      svc.createExport(CASE_ID, ORG_ID, USER_ID, {
        exportFormat: 'stl',
        exportType: 'surgical_guide',
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
