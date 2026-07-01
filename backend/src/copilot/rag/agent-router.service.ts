import { Injectable } from '@nestjs/common';

export type AgentType =
  | 'clinical'
  | 'planning'
  | 'cad'
  | 'manufacturing'
  | 'practice'
  | 'support';

export interface AgentConfig {
  agentType: AgentType;
  systemPrompt: string;
}

const DISCLAIMER =
  '\n\nIMPORTANT: All outputs are clinical decision support only. ' +
  'Final clinical decisions must be made by the treating orthodontist. ' +
  'Never advise overriding clinical judgment.';

const BASE_SYSTEM =
  'You are an AI assistant embedded in MyOrtho.tech, a professional orthodontic treatment planning platform. ' +
  'You have access to this patient\'s treatment plan data provided in the context below. ' +
  'Be precise, cite your sources (e.g. Kravitz & Kusnoto 2008, Sheridan 1985), and flag any data gaps honestly. ' +
  'Use metric units (mm, degrees). Keep responses concise and clinician-friendly.' + DISCLAIMER;

const SYSTEM_PROMPTS: Record<AgentType, string> = {
  clinical:
    BASE_SYSTEM +
    '\n\nSpecialty: CLINICAL ANALYSIS. Focus on: Kravitz movement limits, Sheridan IPR enamel safety, ' +
    'Bolton analysis, PDL stress, attachment biology, and clinical contraindications. ' +
    'When movement values are provided, compute whether they exceed published limits.',

  planning:
    BASE_SYSTEM +
    '\n\nSpecialty: ORTHODONTIC PLANNING. Focus on: movement prescriptions, staging strategy, ' +
    'arch coordination, overjet/overbite correction trajectory, interproximal reduction planning, ' +
    'extraction vs. non-extraction decisions, and aligner staging optimisation.',

  cad:
    BASE_SYSTEM +
    '\n\nSpecialty: CAD & ALIGNER DESIGN. Focus on: attachment geometry, aligner shell design, ' +
    'occlusal contacts, shell thickness (0.5–1.0 mm), CBCT segmentation quality, ' +
    'mesh validity checks, and 3D model geometry constraints.',

  manufacturing:
    BASE_SYSTEM +
    '\n\nSpecialty: MANUFACTURING & PRODUCTION. Focus on: aligner material properties ' +
    '(polyurethane, PETG), thermoforming parameters, quality control checks, ' +
    'production timeline estimation, and lab workflow constraints.',

  practice:
    BASE_SYSTEM +
    '\n\nSpecialty: PRACTICE MANAGEMENT. Focus on: appointment scheduling, treatment milestones, ' +
    'patient compliance tracking, billing codes (CDT), consent documentation, ' +
    'and regulatory/HIPAA considerations.',

  support:
    BASE_SYSTEM +
    '\n\nSpecialty: TECHNICAL SUPPORT. Focus on: platform usage, data upload requirements, ' +
    'file format specifications (STL, DICOM, PLY), API integration, and troubleshooting.',
};

const MODULE_TO_AGENT: Record<string, AgentType> = {
  prescriptions: 'planning',
  ipr:           'clinical',
  attachments:   'cad',
  simulation:    'planning',
  segmentation:  'cad',
  aligner:       'manufacturing',
  pdl:           'clinical',
};

const KEYWORD_TO_AGENT: Array<[RegExp, AgentType]> = [
  [/\b(manufactur|print|thermoform|material|petg|polyurethane|lab|production|timeline)\b/i, 'manufacturing'],
  [/\b(bill|cdt|fee|insurance|hipaa|consent|compliance|appointment|schedule|recall)\b/i, 'practice'],
  [/\b(upload|file|stl|dicom|ply|api|integrat|export|import|login|password|error|bug|crash)\b/i, 'support'],
  [/\b(attach|cad|shell|thickness|mesh|geometry|occlus|3d|model|print)\b/i, 'cad'],
  [/\b(kravitz|sheridan|bolton|pdl|stress|enamel|clinical|diagnosis|contraindic)\b/i, 'clinical'],
  [/\b(stage|staging|arch|crowding|movement|prescri|torque|rotation|intrusion|extrusion)\b/i, 'planning'],
];

@Injectable()
export class AgentRouterService {
  route(text: string, detectedModule: string | null): AgentConfig {
    // Module classification takes priority
    if (detectedModule && MODULE_TO_AGENT[detectedModule]) {
      const agentType = MODULE_TO_AGENT[detectedModule]!;
      return { agentType, systemPrompt: SYSTEM_PROMPTS[agentType] };
    }

    // Keyword-based routing
    for (const [pattern, agentType] of KEYWORD_TO_AGENT) {
      if (pattern.test(text)) {
        return { agentType, systemPrompt: SYSTEM_PROMPTS[agentType] };
      }
    }

    // Default: planning assistant (most common use case)
    return { agentType: 'planning', systemPrompt: SYSTEM_PROMPTS['planning'] };
  }

  getSystemPrompt(agentType: AgentType): string {
    return SYSTEM_PROMPTS[agentType];
  }

  getAllAgents(): AgentType[] {
    return ['clinical', 'planning', 'cad', 'manufacturing', 'practice', 'support'];
  }
}
