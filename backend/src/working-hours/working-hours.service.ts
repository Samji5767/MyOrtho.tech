import { Injectable, Inject, NotFoundException } from '@nestjs/common';
import type { Pool } from 'pg';
import { PG_POOL } from '../database/database.module';

export interface WorkingHours {
  id: string; organizationId: string; locationId: string | null;
  dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean;
  createdAt: string; updatedAt: string;
}

export interface Chair {
  id: string; organizationId: string; locationId: string | null;
  name: string; chairType: string; isActive: boolean;
  createdAt: string; updatedAt: string;
}

@Injectable()
export class WorkingHoursService {
  constructor(@Inject(PG_POOL) private readonly db: Pool) {}

  async getSchedule(orgId: string, locationId?: string): Promise<WorkingHours[]> {
    const hasLocation = Boolean(locationId);
    const { rows } = await this.db.query(
      `SELECT * FROM working_hours WHERE organization_id=$1 ${hasLocation ? 'AND location_id=$2' : 'AND location_id IS NULL'} ORDER BY day_of_week`,
      hasLocation ? [orgId, locationId] : [orgId],
    );
    return rows.map(this.mapHours);
  }

  async upsertSchedule(
    orgId: string,
    locationId: string | null,
    schedule: Array<{ dayOfWeek: number; openTime: string; closeTime: string; isOpen: boolean }>,
  ): Promise<WorkingHours[]> {
    for (const slot of schedule) {
      await this.db.query(
        `INSERT INTO working_hours (organization_id, location_id, day_of_week, open_time, close_time, is_open)
         VALUES ($1,$2,$3,$4,$5,$6)
         ON CONFLICT (organization_id, COALESCE(location_id, '00000000-0000-0000-0000-000000000000'::uuid), day_of_week)
         DO UPDATE SET open_time=$4, close_time=$5, is_open=$6, updated_at=now()`,
        [orgId, locationId, slot.dayOfWeek, slot.openTime, slot.closeTime, slot.isOpen],
      );
    }
    return this.getSchedule(orgId, locationId ?? undefined);
  }

  async listChairs(orgId: string, locationId?: string): Promise<Chair[]> {
    const hasLocation = Boolean(locationId);
    const { rows } = await this.db.query(
      `SELECT * FROM chairs WHERE organization_id=$1 ${hasLocation ? 'AND location_id=$2' : ''} ORDER BY name`,
      hasLocation ? [orgId, locationId] : [orgId],
    );
    return rows.map(this.mapChair);
  }

  async createChair(orgId: string, dto: { name: string; locationId?: string; chairType?: string }): Promise<Chair> {
    const { rows } = await this.db.query(
      `INSERT INTO chairs (organization_id, location_id, name, chair_type) VALUES ($1,$2,$3,$4) RETURNING *`,
      [orgId, dto.locationId ?? null, dto.name, dto.chairType ?? 'treatment'],
    );
    return this.mapChair(rows[0]);
  }

  async updateChair(id: string, orgId: string, dto: Partial<{ name: string; chairType: string; isActive: boolean }>): Promise<Chair> {
    const { rows } = await this.db.query(
      `UPDATE chairs SET
         name=COALESCE($3,name), chair_type=COALESCE($4,chair_type),
         is_active=COALESCE($5,is_active), updated_at=now()
       WHERE id=$1 AND organization_id=$2 RETURNING *`,
      [id, orgId, dto.name ?? null, dto.chairType ?? null, dto.isActive ?? null],
    );
    if (!rows[0]) throw new NotFoundException('Chair not found');
    return this.mapChair(rows[0]);
  }

  private mapHours(r: Record<string, unknown>): WorkingHours {
    return {
      id: r.id as string, organizationId: r.organization_id as string,
      locationId: r.location_id as string | null, dayOfWeek: r.day_of_week as number,
      openTime: r.open_time as string, closeTime: r.close_time as string,
      isOpen: r.is_open as boolean, createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }

  private mapChair(r: Record<string, unknown>): Chair {
    return {
      id: r.id as string, organizationId: r.organization_id as string,
      locationId: r.location_id as string | null, name: r.name as string,
      chairType: r.chair_type as string, isActive: r.is_active as boolean,
      createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    };
  }
}
