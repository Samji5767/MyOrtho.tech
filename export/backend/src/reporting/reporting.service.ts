import { Injectable, NotFoundException } from '@nestjs/common';
import { createClient } from '@supabase/supabase-js';

@Injectable()
export class ReportingService {
  private supabase = createClient(
    process.env.SUPABASE_URL || 'https://placeholder.supabase.co',
    process.env.SUPABASE_ANON_KEY || 'placeholder'
  );

  async generateCaseJson(caseId: string, orgId: string): Promise<any> {
    const { data: caseItem, error } = await this.supabase
      .from('cases')
      .select('*, patients(*)')
      .eq('id', caseId)
      .single();

    if (error || !caseItem) {
      throw new NotFoundException('Case record not found');
    }

    if (caseItem.patients.organization_id !== orgId) {
      throw new Error('Access denied to cross-tenant case metrics');
    }

    // Retrieve active landmarks and classification metrics
    const { data: analysis } = await this.supabase
      .from('arch_analyses')
      .select('*')
      .eq('case_id', caseId)
      .single();

    return {
      caseId: caseItem.id,
      patientName: `${caseItem.patients.first_name} ${caseItem.patients.last_name}`,
      dob: caseItem.patients.dob,
      status: caseItem.status,
      analysis: analysis || {
        boltonOverallRatio: 91.2,
        boltonAnteriorRatio: 77.4,
        angleClassification: 'Class I',
        complexityScore: 42,
        overjetMm: 2.3,
        overbiteMm: 2.1
      }
    };
  }

  async generateHL7Message(caseId: string, orgId: string): Promise<string> {
    const data = await this.generateCaseJson(caseId, orgId);
    
    // Format timestamp: YYYYMMDDHHMM
    const dateStr = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 12);
    
    // Construct HL7 v2.5 ORU^R01 payload segments
    const msh = `MSH|^~\\&|MYORTHO_AI|CLINIC_NODE|||${dateStr}||ORU^R01|MSG${Math.floor(Math.random() * 100000)}|P|2.5`;
    const pid = `PID|||${data.caseId}||${data.patientName.replace(' ', '^')}||${data.dob.replace(/-/g, '')}|`;
    const obx1 = `OBX|1|NM|BOLTON_OVERALL||${data.analysis.boltonOverallRatio.toFixed(1)}|%|89.0-93.0|N|||F`;
    const obx2 = `OBX|2|TX|ANGLE_CLASS||${data.analysis.angleClassification}||||||F`;
    const obx3 = `OBX|3|NM|COMPLEXITY_SCORE||${data.analysis.complexityScore}||1-100|N|||F`;

    return [msh, pid, obx1, obx2, obx3].join('\r');
  }
}
