import { IsEnum, IsOptional, IsUUID, IsString } from 'class-validator';

export class CreatePrintJobDto {
  @IsOptional()
  @IsUUID()
  printerId?: string;

  @IsOptional()
  @IsUUID()
  stageId?: string;

  @IsOptional()
  @IsString()
  gcodePath?: string;

  @IsOptional()
  @IsString()
  qcNotes?: string;
}

const JOB_STATUSES = [
  'queued',
  'nesting',
  'printing',
  'cleaning',
  'curing',
  'qc_pending',
  'completed',
  'failed',
] as const;

export type JobStatus = (typeof JOB_STATUSES)[number];

export class UpdatePrintJobStatusDto {
  @IsEnum(JOB_STATUSES)
  status: JobStatus;

  @IsOptional()
  @IsString()
  qcNotes?: string;

  @IsOptional()
  @IsString()
  failureReason?: string;
}

export class CancelJobDto {
  @IsOptional()
  @IsString()
  reason?: string;
}
