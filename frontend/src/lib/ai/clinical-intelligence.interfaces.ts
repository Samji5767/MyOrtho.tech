/**
 * clinical-intelligence.interfaces.ts
 *
 * Frontend-side extension-point interfaces for future clinical AI modules
 * in MyOrtho.tech.
 *
 * These are PURE ARCHITECTURE DEFINITIONS — no implementations, no fetch calls,
 * no dummy data.  All values described in comments cite their clinical reference.
 *
 * Clinical disclaimer: every AI output surfaced through these interfaces
 * requires clinician review before influencing treatment decisions.
 * See CLINICAL_AI_DISCLAIMER exported at the bottom of this file.
 *
 * Coordinate system convention (unless noted otherwise):
 *   - 2-D: origin at top-left of the image, x = right, y = down (pixels).
 *   - 3-D: origin at image centre, x = right, y = anterior, z = superior (mm).
 *
 * FDI tooth numbering is used throughout (ISO 3950).
 */

// ===========================================================================
// CEPHALOMETRIC INTELLIGENCE
// ===========================================================================

// ---------------------------------------------------------------------------
// Landmarks
// ---------------------------------------------------------------------------

/**
 * Standard cephalometric landmark names.
 *
 * Sources:
 *   - Jacobson A. "Radiographic Cephalometry." Quintessence, 1995.
 *   - McNamara JA. "A method of cephalometric evaluation." Am J Orthod. 1984.
 *   - Steiner CC. "Cephalometrics for you and me." Am J Orthod. 1953.
 *   - Ricketts RM. "Perspectives in the clinical application of cephalometrics."
 *     Angle Orthod. 1981.
 *
 * Abbreviations follow the international convention used in major analysis
 * systems (Steiner, McNamara, Ricketts, Björk–Jarabak).
 */
export const LANDMARK_NAMES = [
  'Sella',              // Centre of the sella turcica (S)
  'Nasion',             // Most anterior point of the fronto-nasal suture (N)
  'Orbitale',           // Most inferior point of the orbital margin (Or)
  'Porion',             // Most superior point of the external auditory meatus (Po)
  'A_Point',            // Most concave point on the anterior maxilla (A)
  'B_Point',            // Most concave point on the anterior mandibular symphysis (B)
  'Pogonion',           // Most anterior point of the bony chin (Pog)
  'Gnathion',           // Most anterior-inferior point of the bony chin (Gn)
  'Menton',             // Most inferior point of the mandibular symphysis (Me)
  'Gonion',             // Most posterior-inferior point of the mandibular angle (Go)
  'Articulare',         // Junction of posterior border of ramus and cranial base (Ar)
  'ANS',                // Anterior nasal spine (ANS)
  'PNS',                // Posterior nasal spine (PNS)
  'Upper_Incisor_Tip',  // Incisal tip of most prominent maxillary central incisor (UI)
  'Upper_Incisor_Apex', // Root apex of most prominent maxillary central incisor
  'Lower_Incisor_Tip',  // Incisal tip of most prominent mandibular central incisor (LI)
  'Lower_Incisor_Apex', // Root apex of most prominent mandibular central incisor
  'Upper_Molar_Distal', // Distobuccal cusp tip of maxillary first molar
  'Lower_Molar_Mesial', // Mesiobuccal cusp tip of mandibular first molar
  'Basion',             // Most inferior-posterior point of the clivus (Ba)
  'Pterygomaxillare',   // Intersection of the floor of the nose and posterior maxilla (Ptm)
  'Condylion',          // Most superior-posterior point of the mandibular condyle (Co)
] as const;

/** Union type of all valid landmark name strings. */
export type LandmarkName = (typeof LANDMARK_NAMES)[number];

/**
 * A single detected cephalometric landmark with spatial coordinates
 * and detection confidence.
 *
 * Coordinates are in pixels relative to the original cephalogram image
 * (2-D) or in mm in patient space (3-D CBCT-derived landmarks, z populated).
 */
export interface CephalometricLandmark {
  /** Landmark identifier from LANDMARK_NAMES. */
  name: LandmarkName;

  /**
   * Horizontal position.
   * 2-D: pixels from left edge of the image.
   * 3-D: mm in patient-space x-axis (positive = right).
   */
  x: number;

  /**
   * Vertical position.
   * 2-D: pixels from top edge of the image.
   * 3-D: mm in patient-space y-axis (positive = anterior).
   */
  y: number;

  /**
   * Depth position in patient space (mm, positive = superior).
   * Only populated for 3-D landmark detection from CBCT volumes.
   * undefined for 2-D cephalogram landmarks.
   */
  z?: number;

  /**
   * Detection confidence [0.0, 1.0].
   * Derived from the model's spatial probability heatmap at the predicted
   * landmark location.  Values below 0.6 should prompt manual verification.
   */
  confidence: number;

  /** ISO-8601 timestamp when this landmark was detected. */
  detectedAt: string;
}

// ---------------------------------------------------------------------------
// Measurements
// ---------------------------------------------------------------------------

/**
 * Standard cephalometric angular and linear measurements.
 *
 * All angles are in degrees; all linear measurements are in millimetres.
 *
 * Normal range references:
 *   - ANB: 2° ± 2° (Steiner, 1953; Jacobson, 1975)
 *   - SNA: 82° ± 2° (Steiner, 1953)
 *   - SNB: 80° ± 2° (Steiner, 1953)
 *   - FMA:  25° ± 5° (Tweed, 1953)
 *   - IMPA: 90° ± 5° (Tweed, 1953 — mandibular incisor to Frankfort mandibular plane)
 *   - FMIA: 65° ± 5° (Tweed, 1953 — Frankfort mandibular incisor angle)
 *   - upperIncisorToNA: angle 22° ± 2°; linear 4 mm ± 2 (Steiner, 1953)
 *   - lowerIncisorToNB: angle 25° ± 2°; linear 4 mm ± 2 (Steiner, 1953)
 *   - witsAppraisal: 0 mm ± 2 (male); -1 mm ± 2 (female) (Jacobson, 1975)
 *   - anteriorFacialHeight: patient-specific; Björk–Jarabak ratio 62% ± 2%
 *   - posteriorFacialHeight: see anteriorFacialHeight
 *
 * null indicates the measurement could not be computed (missing landmark).
 */
export interface CephalometricMeasurements {
  /** ANB angle (degrees) — maxillomandibular sagittal relationship. */
  ANB: number | null;

  /** SNA angle (degrees) — maxillary sagittal position relative to cranial base. */
  SNA: number | null;

  /** SNB angle (degrees) — mandibular sagittal position relative to cranial base. */
  SNB: number | null;

  /**
   * Frankfort Mandibular Angle (FMA, degrees).
   * Angle between Frankfort horizontal (Po–Or) and mandibular plane (Go–Me).
   */
  FMA: number | null;

  /**
   * Lower incisor to mandibular plane angle (IMPA, degrees).
   * Reference: Tweed CH. "The Frankfort-mandibular incisor angle."
   * Angle Orthod. 1954.
   */
  IMPA: number | null;

  /**
   * Frankfort Mandibular Incisor Angle (FMIA, degrees).
   * Angle between Frankfort horizontal and long axis of lower incisor.
   */
  FMIA: number | null;

  /**
   * Upper incisor to NA line — angular component (degrees).
   * Angle between the long axis of the upper central incisor and the NA line.
   */
  upperIncisorToNAAngle: number | null;

  /**
   * Upper incisor to NA line — linear component (mm).
   * Horizontal distance from the incisal tip to the NA line.
   * Positive = incisor is anterior to NA.
   */
  upperIncisorToNAMm: number | null;

  /**
   * Lower incisor to NB line — angular component (degrees).
   * Angle between the long axis of the lower central incisor and the NB line.
   */
  lowerIncisorToNBAngle: number | null;

  /**
   * Lower incisor to NB line — linear component (mm).
   * Horizontal distance from the incisal tip to the NB line.
   * Positive = incisor is anterior to NB.
   */
  lowerIncisorToNBMm: number | null;

  /**
   * Wits appraisal (mm).
   * Perpendicular projections of A-Point and B-Point onto the functional
   * occlusal plane; distance between the two projections.
   * Reference: Jacobson A. "The 'Wits' appraisal of jaw disharmony."
   * Am J Orthod. 1975.
   */
  witsAppraisal: number | null;

  /**
   * Total anterior facial height (N–Me, mm).
   * Used in Björk–Jarabak analysis for vertical growth pattern assessment.
   */
  anteriorFacialHeight: number | null;

  /**
   * Posterior facial height (S–Go, mm).
   * Björk–Jarabak ratio = posteriorFacialHeight / anteriorFacialHeight × 100.
   * Normal: 62–65% (Björk 1947, Jarabak 1972).
   */
  posteriorFacialHeight: number | null;
}

// ---------------------------------------------------------------------------
// Full cephalometric analysis record
// ---------------------------------------------------------------------------

/**
 * Complete cephalometric analysis result for a single patient image.
 * Produced by the cephalometric AI module and stored per-image.
 *
 * This record does NOT replace a clinician's analysis — it is an AI-assisted
 * starting point subject to verification (see clinicianVerified).
 */
export interface CephalometricAnalysis {
  /** Patient identifier (UUID v4). */
  patientId: string;

  /** Identifier of the source cephalogram image (storage or database ID). */
  imageId: string;

  /** All detected landmarks for this analysis. */
  landmarks: CephalometricLandmark[];

  /** Computed measurements derived from the detected landmarks. */
  measurements: CephalometricMeasurements;

  /**
   * Assessed skeletal growth stage based on CVM (Cervical Vertebral Maturation)
   * or hand-wrist radiograph analysis.
   *
   * 'growing'  — pre-peak or circum-peak; significant growth remaining.
   * 'peak'     — CS3/CS4 (Baccetti et al., 2002); peak growth velocity.
   * 'complete' — CS5/CS6; growth largely complete.
   *
   * Reference: Baccetti T, Franchi L, McNamara JA.
   * "An improved version of the cervical vertebral maturation (CVM) method
   * for the assessment of mandibular growth." Angle Orthod. 2002.
   */
  growthStage: 'growing' | 'peak' | 'complete';

  /** ISO-8601 date the analysis was performed. */
  analysisDate: string;

  /**
   * Overall analysis confidence [0.0, 1.0].
   * Aggregated from individual landmark confidences.
   * Analyses below 0.7 should be flagged for mandatory manual review.
   */
  confidence: number;

  /**
   * Whether a licensed orthodontist has reviewed and approved this analysis.
   * Must be true before the analysis influences any treatment decision.
   */
  clinicianVerified: boolean;
}

// ===========================================================================
// CBCT INTELLIGENCE
// ===========================================================================

// ---------------------------------------------------------------------------
// Volume metadata
// ---------------------------------------------------------------------------

/**
 * Metadata describing the physical properties of a CBCT volume.
 * Used to convert voxel indices to real-world mm coordinates.
 */
export interface CBCTVolumeMetadata {
  /** Unique identifier for this CBCT scan (matches scan record in database). */
  scanId: string;

  /**
   * Isotropic or anisotropic voxel size in mm.
   * Most orthodontic CBCT units produce isotropic voxels of 0.1–0.4 mm.
   * Format: [x, y, z] in mm.
   */
  voxelSizeMm: [number, number, number];

  /**
   * Volume dimensions in voxels [width, height, depth].
   * Real-world field-of-view = dimensions × voxelSizeMm (element-wise).
   */
  dimensions: [number, number, number];

  /**
   * Total number of axial slices in the volume.
   * Should equal dimensions[2] for axial-primary reconstructions.
   */
  sliceCount: number;

  /** ISO-8601 date the CBCT scan was acquired. */
  scanDate: string;

  /**
   * Scanner make/model string.
   * Examples: 'Carestream CS 9600', 'Planmeca ProMax 3D', 'i-CAT FLX'
   */
  scanner: string;
}

// ---------------------------------------------------------------------------
// Root proximity
// ---------------------------------------------------------------------------

/**
 * Root-to-bone proximity data for a single tooth.
 *
 * Critical for miniscrew / TAD placement planning and
 * for assessing cortical bone contact risk during orthodontic movement.
 *
 * Reference: Poggio PM et al. "Safe zones: a guide for miniscrew positioning
 * in the maxillary and mandibular arch." Angle Orthod. 2006.
 */
export interface RootProximityData {
  /**
   * Tooth identifier using FDI notation (ISO 3950).
   * Values 11–18, 21–28, 31–38, 41–48 for permanent dentition.
   * Values 51–55, 61–65, 71–75, 81–85 for deciduous dentition.
   */
  toothFdi: number;

  /**
   * Shortest distance from the outer root surface to the nearest
   * cortical bone surface (mm).
   * Values ≤ 0 indicate root-cortical contact.
   */
  nearestBoneDistanceMm: number;

  /**
   * Risk classification for cortical bone contact during planned movement.
   * 'low'      — clearance ≥ 2 mm; standard movement planning applies.
   * 'moderate' — clearance 1–2 mm; reduce planned torque; re-image mid-treatment.
   * 'high'     — clearance < 1 mm or contact detected; consult prior to movement.
   */
  corticateContactRisk: 'low' | 'moderate' | 'high';

  /**
   * Clearance from the inferior alveolar nerve canal or mental foramen (mm).
   * null for teeth not adjacent to the IAN / mental foramen.
   * Values < 2 mm require clinician review before lower premolar / molar movement.
   */
  nerveClearanceMm: number | null;
}

// ---------------------------------------------------------------------------
// Bone thickness
// ---------------------------------------------------------------------------

/**
 * Alveolar bone thickness measurement at a specific anatomical region.
 *
 * Used for TAD placement, bone graft planning, and root-movement safety.
 *
 * Reference: Gracco A et al. "Quantitative cone-beam computed tomography
 * evaluation of palatal bone thickness for orthodontic miniscrew insertion."
 * Am J Orthod Dentofacial Orthop. 2008.
 */
export interface BoneThicknessMeasurement {
  /**
   * Anatomical region label.
   * Examples: 'mid_palate', 'buccal_maxilla_14', 'lingual_mandible_33'
   */
  region: string;

  /**
   * Measured bone thickness at this region (mm).
   * Typically measured as the shortest bone-surface-to-bone-surface distance
   * perpendicular to the alveolar crest.
   */
  thicknessMm: number;

  /**
   * 3-D coordinate of the measurement point in patient space (mm).
   * Convention: x = right, y = anterior, z = superior.
   */
  measuredAt: { x: number; y: number; z: number };

  /**
   * Measurement confidence [0.0, 1.0] from the segmentation model.
   * Values below 0.75 should prompt manual measurement verification.
   */
  confidence: number;
}

// ---------------------------------------------------------------------------
// Full CBCT analysis result
// ---------------------------------------------------------------------------

/**
 * Aggregated AI analysis result for a single CBCT volume.
 *
 * Combines root proximity, bone thickness, impaction risk, and airway data
 * into a single frontend-consumable record.
 *
 * All measurements require clinician review prior to clinical use.
 */
export interface CBCTAnalysisResult {
  /** Scan identifier (matches CBCTVolumeMetadata.scanId). */
  scanId: string;

  /**
   * Root proximity data for each tooth detected in the volume.
   * Teeth not visible or not segmented are absent from the array.
   */
  rootProximity: RootProximityData[];

  /**
   * Bone thickness measurements at anatomical regions of interest.
   * Regions are determined by the analysis protocol (e.g. TAD placement map).
   */
  boneThickness: BoneThicknessMeasurement[];

  /**
   * Risk classification for impacted or unerupted teeth detected in the volume.
   * Map of toothFdi (string key) → risk level.
   * Keys present only for teeth classified as impacted or at risk of impaction.
   */
  impactionRisk: Record<string, 'low' | 'moderate' | 'high'>;

  /**
   * Upper-airway volume in millilitres, measured from the posterior
   * nasal spine to the base of the epiglottis.
   * null if airway segmentation was not performed or failed.
   *
   * Reference: Ogawa T et al. "Evaluation of 3-dimensional airway space
   * of patients with obstructive sleep apnea." Am J Orthod. 2007.
   */
  airwayVolumeML: number | null;

  /** ISO-8601 date the analysis was performed. */
  analysisDate: string;

  /**
   * Processing status of the CBCT analysis pipeline.
   * 'pending'    — queued but not yet started.
   * 'processing' — AI pipeline is running.
   * 'complete'   — all results populated.
   * 'failed'     — pipeline error; results may be partial or absent.
   */
  processingStatus: 'pending' | 'processing' | 'complete' | 'failed';
}

// ===========================================================================
// GROWTH PREDICTION ARCHITECTURE
// ===========================================================================

/**
 * Skeletal growth stage classification.
 *
 * Based on the Cervical Vertebral Maturation (CVM) method.
 * Reference: Baccetti T, Franchi L, McNamara JA.
 * "An improved version of the cervical vertebral maturation (CVM) method
 * for the assessment of mandibular growth." Angle Orthod. 2002.
 *
 * 'prepubertal'   — CS1/CS2; significant growth remaining before peak.
 * 'circumpubertal' — CS3/CS4; at or near peak mandibular growth velocity.
 * 'postpubertal'  — CS5/CS6; growth largely complete.
 */
export type GrowthStage = 'prepubertal' | 'circumpubertal' | 'postpubertal';

/**
 * AI-generated skeletal growth prediction for a patient.
 *
 * ARCHITECTURE EXTENSION POINT: growth prediction models are not yet
 * deployed in the platform.  This interface defines the data contract
 * for future implementation.
 *
 * Clinical context: growth prediction informs timing of functional appliance
 * therapy and orthognathic surgery planning.  Predictions carry inherent
 * biological variability and must not be used as a sole decision criterion.
 *
 * References:
 *   - Franchi L, Baccetti T, McNamara JA. "Mandibular growth as related
 *     to cervical vertebral maturation and body height." Am J Orthod. 2000.
 *   - Stahl F et al. "Cephalometric growth studies of patients with Angle
 *     Class II malocclusion." Angle Orthod. 2008.
 */
export interface GrowthPrediction {
  /** Patient identifier (UUID v4). */
  patientId: string;

  /** Assessed CVM-based growth stage at time of prediction. */
  currentStage: GrowthStage;

  /**
   * Skeletal age in years estimated from CVM staging and growth velocity curves.
   * May differ from chronologicalAge due to early/late maturation.
   */
  skeletalAge: number;

  /**
   * Patient's chronological age in years at time of prediction.
   * Computed from date-of-birth; retained here for model auditability.
   */
  chronologicalAge: number;

  /**
   * Estimated remaining mandibular growth at the condyle (mm).
   * Derived from growth velocity models referenced above.
   * null when the model cannot produce a reliable estimate (e.g. CS5/CS6).
   */
  remainingGrowthMm: number | null;

  /**
   * Predicted mandibular growth vector as a unit direction [x, y, z].
   * Convention: x = transverse, y = anteroposterior, z = vertical.
   * Magnitude encodes expected displacement in mm over the prediction horizon.
   * null when directional data is unavailable.
   */
  mandibularGrowthVector: [number, number, number] | null;

  /**
   * Predicted maxillary growth vector as a unit direction [x, y, z].
   * Same convention as mandibularGrowthVector.
   * null when directional data is unavailable.
   */
  maxillaryGrowthVector: [number, number, number] | null;

  /**
   * Overall prediction confidence [0.0, 1.0].
   * Reflects model uncertainty; lower for patients at atypical skeletal ages
   * or with sparse training data representation.
   */
  confidence: number;

  /** ISO-8601 timestamp when the prediction was generated. */
  predictedAt: string;
}

// ===========================================================================
// CLINICAL AI DISCLAIMER
// ===========================================================================

/**
 * Mandatory disclaimer to be displayed alongside any AI-generated clinical
 * output in the UI.
 *
 * Regulatory basis:
 *   - FDA Guidance: "Artificial Intelligence and Machine Learning (AI/ML)-Based
 *     Software as a Medical Device (SaMD) Action Plan." January 2021.
 *   - ADA Policy on Artificial Intelligence in Dentistry. October 2022.
 *   - HIPAA Security Rule (45 CFR Parts 160 and 164) — AI outputs that
 *     constitute clinical recommendations are subject to PHI handling rules.
 */
export const CLINICAL_AI_DISCLAIMER =
  'AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist. All AI outputs require clinical review and verification before implementation.';
