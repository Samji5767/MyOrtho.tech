import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class RestorativeService {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  async createDesign(organizationId: string, dto: any) {
    // 1. Verify Case belongs to organization
    const { data: caseItem, error: cError } = await this.supabase
      .from('cases')
      .select('*, patients(*)')
      .eq('id', dto.caseId)
      .single();

    if (cError || !caseItem) {
      throw new NotFoundException('Case not found');
    }

    if (caseItem.patients.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied to cross-tenant case data');
    }

    // 2. Insert Restorative Design
    const { data: newDesign, error } = await this.supabase
      .from('restorative_designs')
      .insert({
        case_id: dto.caseId,
        tooth_number: dto.toothNumber,
        restoration_type: dto.restorationType,
        margin_line_vertices: dto.marginLineVertices || [],
        minimum_thickness_mm: dto.minimumThickness || 0.8
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return newDesign;
  }

  async findOne(id: string, organizationId: string) {
    const { data: design, error } = await this.supabase
      .from('restorative_designs')
      .select('*, cases(*, patients(*))')
      .eq('id', id)
      .single();

    if (error || !design) {
      throw new NotFoundException('Restoration design not found');
    }

    if (design.cases.patients.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied to cross-tenant restoration metadata');
    }

    return design;
  }
}
