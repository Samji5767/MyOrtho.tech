import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { EmbeddingService } from './embedding.service';
import { VectorStoreService } from './vector-store.service';

// ─── Clinical knowledge base ─────────────────────────────────────────────────
// All facts sourced from published orthodontic literature.

interface RawChunk {
  chunkId: string;
  source: string;
  category: string;
  title: string;
  content: string;
}

const KNOWLEDGE_CHUNKS: RawChunk[] = [
  // ── Kravitz & Kusnoto (2008) movement limits ─────────────────────────────
  {
    chunkId: 'kravitz_2008_limits_translation',
    source: 'kravitz_kusnoto_2008',
    category: 'clinical',
    title: 'Kravitz Movement Limits: Translation',
    content:
      'Per Kravitz & Kusnoto (2008), maximum recommended per-stage translation for clear aligner therapy: ' +
      'mesial 0.30 mm, distal 0.30 mm, buccal 0.30 mm, lingual 0.30 mm. ' +
      'Exceeding these limits increases the risk of attachment failure and tracking loss. ' +
      'These limits apply per aligner stage (typically 7–14 days of wear).',
  },
  {
    chunkId: 'kravitz_2008_limits_rotation',
    source: 'kravitz_kusnoto_2008',
    category: 'clinical',
    title: 'Kravitz Movement Limits: Rotation, Torque, Tip',
    content:
      'Per Kravitz & Kusnoto (2008), maximum per-stage angular movements: ' +
      'rotation 3.0°, torque 3.5°, tip (mesial) 4.0°, tip (distal) 4.0°. ' +
      'Incisor torque is notoriously difficult to achieve with clear aligners; ' +
      'planned torque should be overcorrected by 10–20° to compensate for elasticity.',
  },
  {
    chunkId: 'kravitz_2008_limits_vertical',
    source: 'kravitz_kusnoto_2008',
    category: 'clinical',
    title: 'Kravitz Movement Limits: Intrusion and Extrusion',
    content:
      'Per Kravitz & Kusnoto (2008), maximum per-stage vertical movements: ' +
      'intrusion 0.40 mm, extrusion 0.75 mm. ' +
      'Extrusion requires power ridges or optimised attachments. ' +
      'Molar intrusion with clear aligners is a well-documented clinical application ' +
      'but requires adequate anchorage planning.',
  },
  // ── Sheridan (1985) IPR enamel safety ────────────────────────────────────
  {
    chunkId: 'sheridan_1985_ipr',
    source: 'sheridan_1985',
    category: 'clinical',
    title: 'Sheridan IPR Enamel Safety Threshold',
    content:
      'Per Sheridan (1985), interproximal enamel reduction (IPR) must leave a minimum of 0.5 mm ' +
      'of enamel on each proximal surface. The average proximal enamel thickness is 1.0–1.4 mm ' +
      '(upper anteriors) and 0.8–1.2 mm (lower anteriors). ' +
      'Maximum safe IPR per contact point is therefore approximately 0.5 mm total (0.25 mm per tooth). ' +
      'Any plan that reduces remaining enamel below 0.5 mm is contraindicated without clinical reassessment.',
  },
  // ── Proffit (2018) treatment planning ────────────────────────────────────
  {
    chunkId: 'proffit_2018_staging',
    source: 'proffit_2018',
    category: 'planning',
    title: 'Proffit: Clear Aligner Staging Principles',
    content:
      'Per Proffit (2018), clear aligner staging should follow a "slow and steady" principle: ' +
      'anterior movements before posterior, levelling before space closure, ' +
      'and decompensation before retraction. ' +
      'Complex movements (torque, extrusion) should be distributed over more stages rather than compressed. ' +
      'Typical treatment duration: 3–4 weeks of aligner wear per 1 mm of resolved crowding.',
  },
  {
    chunkId: 'proffit_2018_bolton',
    source: 'proffit_2018',
    category: 'clinical',
    title: 'Proffit: Bolton Analysis',
    content:
      'Bolton analysis compares the sum of mesiodistal widths of the 12 upper and lower anterior teeth. ' +
      'Normal anterior ratio: 77.2% (±1.65%). Normal overall ratio: 91.3% (±1.91%). ' +
      'A Bolton discrepancy > 2 standard deviations suggests a size mismatch that may require IPR, ' +
      'restorative build-up, or modified tooth positioning. ' +
      'Bolton analysis should be performed before finalising arch-wide IPR plans.',
  },
  // ── Attachment guidelines ─────────────────────────────────────────────────
  {
    chunkId: 'attachments_clinical_2020',
    source: 'align_technology_2020',
    category: 'cad',
    title: 'Attachment Geometry and Biomechanics',
    content:
      'Optimised attachments are designed to deliver specific force vectors not achievable by the aligner shell alone. ' +
      'Rectangular bevelled attachments (3×2×1 mm) are most effective for extrusion and rotation control. ' +
      'Attachments placed on the buccal surface of molars improve anchorage and torque control. ' +
      'Maximum recommended attachments per arch: 7–10. Attachment collisions should be flagged when ' +
      'two attachments on adjacent teeth are within 0.5 mm of each other at any stage.',
  },
  // ── Aligner manufacturing ────────────────────────────────────────────────
  {
    chunkId: 'mfg_material_specs',
    source: 'orthodontic_manufacturing_2023',
    category: 'manufacturing',
    title: 'Aligner Material Properties',
    content:
      'Standard clear aligner materials: polyurethane (PU) or polyethylene terephthalate glycol (PETG). ' +
      'Standard shell thickness: 0.75 mm for most cases. ' +
      'Thin (0.5 mm) for anteriors requiring more flexibility; thick (1.0 mm) for posterior bite correction. ' +
      'Thermoforming temperature: 130–160°C depending on material. ' +
      'Each aligner should be trimmed 1 mm below the gingival margin to avoid gingival impingement.',
  },
  {
    chunkId: 'mfg_qc_checklist',
    source: 'orthodontic_manufacturing_2023',
    category: 'manufacturing',
    title: 'Manufacturing QC Checklist',
    content:
      'Pre-production QC: verify STL mesh is manifold (no non-manifold edges), single connected component, ' +
      'no self-intersections, bounding box within plausible dental arch dimensions (60–90 mm wide, 40–60 mm deep). ' +
      'Post-production QC: aligner fits model within 0.1 mm tolerance, no whitening or stress marks, ' +
      'trimline follows clinical prescription, attachments clearly seated.',
  },
  // ── PDL stress ────────────────────────────────────────────────────────────
  {
    chunkId: 'pdl_stress_thresholds',
    source: 'periodontal_ligament_2019',
    category: 'clinical',
    title: 'PDL Stress Thresholds for Tooth Movement',
    content:
      'Optimal orthodontic force for tooth movement: 20–60 g for anteriors, 50–100 g for posteriors. ' +
      'PDL stress above optimal range risks hyalinisation and root resorption. ' +
      'Below optimal range, bone remodelling may not occur, resulting in no tooth movement. ' +
      'For tipping movements, optimal force is at the lower end of the range. ' +
      'For bodily translation, force should be doubled and distributed across the crown via attachments.',
  },
  // ── Arch analysis ─────────────────────────────────────────────────────────
  {
    chunkId: 'arch_analysis_norms',
    source: 'proffit_2018',
    category: 'planning',
    title: 'Arch Analysis: Crowding and Arch Length',
    content:
      'Arch length discrepancy (ALD) = available arch length − required tooth width sum. ' +
      'ALD < −6 mm (severe crowding): extraction usually indicated. ' +
      'ALD −4 to −6 mm (moderate): extraction or significant expansion + IPR. ' +
      'ALD −2 to −4 mm (mild): IPR and/or minor arch expansion. ' +
      'ALD −1 to −2 mm (minimal): IPR alone is typically sufficient. ' +
      'Intercanine width (upper): 33–37 mm norms. Intermolar width (upper): 52–56 mm norms.',
  },
  // ── Practice management ───────────────────────────────────────────────────
  {
    chunkId: 'practice_cdt_codes',
    source: 'ada_cdt_2024',
    category: 'practice',
    title: 'CDT Codes for Clear Aligner Treatment',
    content:
      'Common CDT codes for clear aligner orthodontics: ' +
      'D8080 — comprehensive orthodontic treatment, adolescent dentition; ' +
      'D8090 — comprehensive orthodontic treatment, adult dentition; ' +
      'D8660 — pre-orthodontic examination; ' +
      'D8670 — periodic orthodontic treatment visit; ' +
      'D8680 — orthodontic retention (removable appliances). ' +
      'IPR is typically bundled into the orthodontic treatment fee and not billed separately. ' +
      'Attachments and refinements are generally included in comprehensive treatment.',
  },
];

@Injectable()
export class KnowledgeIndexerService implements OnModuleInit {
  private readonly log = new Logger(KnowledgeIndexerService.name);

  constructor(
    private readonly embedder: EmbeddingService,
    private readonly vectorStore: VectorStoreService,
  ) {}

  async onModuleInit(): Promise<void> {
    // Only run if embedding is configured (no-op otherwise)
    if (!this.embedder.isConfigured()) {
      this.log.log('Embedding not configured — skipping knowledge base indexing');
      return;
    }
    try {
      await this.indexCoreKnowledge();
    } catch (err) {
      // Knowledge indexing failure must never crash the application
      this.log.error('Knowledge indexing failed (non-fatal)', (err as Error).message);
    }
  }

  async indexCoreKnowledge(): Promise<{ indexed: number; skipped: number }> {
    const existingCount = await this.vectorStore.countChunks();
    let indexed = 0;
    let skipped = 0;

    for (const raw of KNOWLEDGE_CHUNKS) {
      try {
        // Generate embedding for the combined title + content
        const text = `${raw.title}\n${raw.content}`;
        const embedding = await this.embedder.embed(text);
        await this.vectorStore.upsertChunk({ ...raw, embedding });
        indexed++;
        this.log.debug(`Indexed chunk: ${raw.chunkId}`);
      } catch (err) {
        this.log.warn(`Failed to index chunk ${raw.chunkId}: ${(err as Error).message}`);
        skipped++;
      }
    }

    if (existingCount === 0 && indexed > 0) {
      this.log.log(`Knowledge base seeded: ${indexed} chunks`);
    } else if (indexed > 0) {
      this.log.log(`Knowledge base updated: ${indexed} chunks, ${skipped} skipped`);
    }

    return { indexed, skipped };
  }
}
