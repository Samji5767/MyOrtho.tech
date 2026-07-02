import { NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import * as fs from 'fs';
import { AlignerGenerationService } from './aligner-generation.service';
import { PG_POOL } from '../database/database.module';

jest.mock('fs');

const PLAN_ID = 'plan-001';
const ORG_ID  = 'org-test';

function makePool(rows: unknown[]) {
  return { query: jest.fn().mockResolvedValue({ rows, rowCount: rows.length }) };
}

describe('AlignerGenerationService.getStlFile', () => {
  let svc: AlignerGenerationService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        AlignerGenerationService,
        { provide: PG_POOL, useValue: makePool([]) },
      ],
    }).compile();
    svc = module.get(AlignerGenerationService);
  });

  it('throws NotFoundException when plan does not belong to org', async () => {
    (svc as any).db = makePool([]);
    await expect(svc.getStlFile(PLAN_ID, ORG_ID)).rejects.toThrow(NotFoundException);
  });

  it('throws ServiceUnavailableException when stl_export_ready is false', async () => {
    (svc as any).db = makePool([{
      plan_id: PLAN_ID,
      stl_export_ready: false,
      stl_export_path: null,
    }]);
    await expect(svc.getStlFile(PLAN_ID, ORG_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when stl_export_path is null', async () => {
    (svc as any).db = makePool([{
      plan_id: PLAN_ID,
      stl_export_ready: true,
      stl_export_path: null,
    }]);
    await expect(svc.getStlFile(PLAN_ID, ORG_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('throws ServiceUnavailableException when file does not exist on disk', async () => {
    (svc as any).db = makePool([{
      plan_id: PLAN_ID,
      stl_export_ready: true,
      stl_export_path: '/exports/plan-001.stl',
    }]);
    (fs.existsSync as jest.Mock).mockReturnValue(false);
    await expect(svc.getStlFile(PLAN_ID, ORG_ID)).rejects.toThrow(ServiceUnavailableException);
  });

  it('returns filePath and planId when file exists', async () => {
    (svc as any).db = makePool([{
      plan_id: PLAN_ID,
      stl_export_ready: true,
      stl_export_path: '/exports/plan-001.stl',
    }]);
    (fs.existsSync as jest.Mock).mockReturnValue(true);
    const result = await svc.getStlFile(PLAN_ID, ORG_ID);
    expect(result.filePath).toBe('/exports/plan-001.stl');
    expect(result.planId).toBe(PLAN_ID);
  });
});
