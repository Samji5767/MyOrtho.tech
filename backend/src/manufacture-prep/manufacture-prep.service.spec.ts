import { Test } from '@nestjs/testing';
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
  it('immediately sets status=failed with honest error_message — no setTimeout simulation', async () => {
    const pool = makePool([
      // verifyCaseOwnership → case found
      [{ id: CASE_ID }],
      // stage count query
      [{ cnt: '10' }],
      // INSERT returning the export row
      [{
        id: 'exp-1', case_id: CASE_ID, treatment_plan_id: null, export_format: 'stl',
        export_type: 'stage_models', stage_range_from: null, stage_range_to: null,
        status: 'failed',
        error_message:
          'Manufacturing export pipeline not implemented. ' +
          'Aligner shell geometry requires the AI segmentation pipeline to produce per-tooth mesh files.',
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

    // No setTimeout was set — result is synchronous and immediate
    expect(result.status).toBe('failed');
    expect(result.errorMessage).toMatch(/not implemented/i);

    // The INSERT must NOT write a fake file_path
    const insertCall = pool.query.mock.calls.find((c: unknown[]) =>
      typeof c[0] === 'string' && (c[0] as string).includes('INSERT INTO manufacture_exports'),
    );
    expect(insertCall).toBeDefined();
    const [insertSql] = insertCall as [string, unknown[]];
    // Status must be 'failed', not 'completed' or 'pending'
    expect(insertSql).toMatch(/'failed'/);
    // error_message column must be in INSERT
    expect(insertSql).toContain('error_message');
    // File path must NOT be written in any query call (no setTimeout update)
    const allSqls = pool.query.mock.calls.map((c: unknown[]) => c[0] as string);
    const hasFilePath = allSqls.some(
      (sql: string) => sql.includes('file_path') && sql.includes('UPDATE'),
    );
    expect(hasFilePath).toBe(false);
  });
});
