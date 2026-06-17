import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class CasesService {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  private getClient() {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_ANON_KEY;
    if (!url || !key || url.includes('placeholder') || key === 'placeholder') {
      throw new Error('Supabase credentials are not configured on the backend.');
    }
    return this.supabase;
  }

  async findAllByOrg(organizationId: string) {
    const { data, error } = await this.getClient()
      .from('cases')
      .select('*, patients(*)')
      .eq('patients.organization_id', organizationId);

    if (error) throw new Error(error.message);
    return data || [];
  }

  async create(organizationId: string, dto: any) {
    // 1. Ensure Patient exists and belongs to organization
    const { data: patient, error: pError } = await this.getClient()
      .from('patients')
      .select('id')
      .eq('id', dto.patientId)
      .eq('organization_id', organizationId)
      .single();

    if (pError || !patient) {
      throw new ForbiddenException('Patient record not found in this organization scope');
    }

    // 2. Insert Case
    const { data: newCase, error: cError } = await this.getClient()
      .from('cases')
      .insert({
        patient_id: dto.patientId,
        dentist_id: dto.dentistId,
        notes: dto.notes,
        status: 'draft',
      })
      .select()
      .single();

    if (cError) throw new Error(cError.message);
    return newCase;
  }

  async findOne(id: string, organizationId: string) {
    const { data: caseItem, error } = await this.getClient()
      .from('cases')
      .select('*, patients(*)')
      .eq('id', id)
      .single();

    if (error || !caseItem) {
      throw new NotFoundException('Case record not found');
    }

    // Tenant Check
    if (caseItem.patients.organization_id !== organizationId) {
      throw new ForbiddenException('Access denied to cross-tenant case data');
    }

    return caseItem;
  }

  async approveStaging(id: string, organizationId: string, doctorId: string, signature: string) {
    const caseItem = await this.findOne(id, organizationId);

    // Update case status to approved & sign treatment plan
    const { data, error } = await this.getClient()
      .from('treatment_plans')
      .update({
        doctor_approval: true,
        doctor_signature: signature,
        approved_at: new Date().toISOString(),
      })
      .eq('case_id', id)
      .select();

    if (error) throw new Error(error.message);

    // Update case status
    await this.getClient()
      .from('cases')
      .update({ status: 'approved' })
      .eq('id', id);

    return { success: true, message: 'Treatment staging plan approved successfully' };
  }
}
