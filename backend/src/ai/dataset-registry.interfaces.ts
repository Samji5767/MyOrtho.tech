/**
 * dataset-registry.interfaces.ts
 *
 * Extension-point interfaces for training dataset management in MyOrtho.tech.
 * These are ARCHITECTURE definitions — no runtime implementations exist here.
 *
 * Scope: management of annotated datasets used to train, fine-tune, and
 * evaluate AI models for orthodontic / craniofacial imaging tasks.
 *
 * Clinical / regulatory context:
 *   - Datasets containing CBCT or intraoral scan imagery are PHI under HIPAA.
 *   - De-identification must be documented in DatasetMetadata.collectionProtocol.
 *   - BiasAssessment is required before clinical deployment of any model
 *     trained on a dataset (21 CFR Part 820 quality-system requirements).
 *
 * Implementation note:
 *   Storage of actual dataset artefacts is out of scope for this interface;
 *   only metadata and evaluation records are managed here.
 */

import type { MLTaskType } from './ml-model.interfaces';

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/**
 * Standard machine-learning data split categories.
 * Proportions (e.g. 70/15/15) are documented in DatasetMetadata.splits.
 */
export type DatasetSplit = 'train' | 'validation' | 'test';

/**
 * Health assessment of a dataset, updated by integrity-check jobs.
 * 'degraded'  — some samples are missing or unreadable but the dataset is usable.
 * 'corrupted' — integrity check failed; dataset must not be used for training.
 * 'unknown'   — health has not yet been assessed for this version.
 */
export type DatasetHealthStatus = 'healthy' | 'degraded' | 'corrupted' | 'unknown';

// ---------------------------------------------------------------------------
// Dataset metadata
// ---------------------------------------------------------------------------

/**
 * Persistent descriptor for a versioned, annotated training dataset.
 *
 * A "dataset" here refers to a cohort of labelled samples (scan + annotation
 * pairs) used for model training and evaluation.  Each dataset is versioned
 * independently; breaking changes (re-annotation, case additions/removals)
 * must produce a new version rather than mutating an existing record.
 */
export interface DatasetMetadata {
  /** Unique registry identifier (UUID v4). */
  id: string;

  /** Human-readable dataset name, e.g. "CBCT-Segmentation-US-v3". */
  name: string;

  /**
   * Semantic version string following the same convention as MLModelMetadata.
   * Breaking annotation changes require a major-version bump.
   */
  version: string;

  /** Clinical AI task this dataset supports. */
  taskType: MLTaskType;

  /**
   * Total number of annotated samples (scan + ground-truth pairs)
   * across all splits.
   */
  sampleCount: number;

  /**
   * Number of samples per split.
   * Sum of values must equal sampleCount.
   * Example: { train: 700, validation: 150, test: 150 }
   */
  splits: Record<DatasetSplit, number>;

  /**
   * Source of the ground-truth annotations.
   * Examples:
   *   'board_certified_orthodontist' — annotated by licensed clinicians
   *   'consensus_panel_3x' — three-reader consensus
   *   'semi_automatic_with_review' — auto-label pipeline with clinician QA
   *
   * Must be documented for FDA 510(k) submissions.
   */
  groundTruthSource: string;

  /**
   * Free-text description of the data collection and de-identification protocol.
   * Must include: IRB number (if applicable), HIPAA de-identification method
   * (Safe Harbor or Expert Determination), scanner models used, and
   * patient demographics summary.
   */
  collectionProtocol: string;

  /**
   * Structured bias assessment summary.
   * Keys are bias dimensions (e.g. 'age_group', 'skeletal_class', 'ethnicity').
   * Values are assessment notes or references to full bias reports.
   *
   * A null value indicates bias assessment has not been completed —
   * models trained on this dataset should not be deployed clinically.
   */
  biasAssessment: Record<string, string> | null;

  /**
   * Current integrity / health status of the dataset artefacts.
   * Updated by scheduled dataset-health-check jobs.
   */
  healthStatus: DatasetHealthStatus;

  /** ISO-8601 timestamp when the dataset was first registered. */
  createdAt: string;
}

// ---------------------------------------------------------------------------
// Model evaluation results
// ---------------------------------------------------------------------------

/**
 * Result of evaluating a specific model version against a specific dataset split.
 *
 * Metric keys are task-specific.  Recommended keys by task:
 *   segmentation:       'dice', 'iou', 'hausdorff_95'
 *   landmark_detection: 'mean_radial_error_mm', 'success_detection_rate_2mm'
 *   growth_prediction:  'mae_mm', 'rmse_mm', 'r_squared'
 *   root_proximity:     'mean_absolute_error_mm', 'sensitivity', 'specificity'
 *   bone_density:       'accuracy', 'f1_macro', 'auc_roc'
 *   airway_analysis:    'volume_error_ml', 'icc'
 *
 * All metric values are floating-point; higher is better unless the key ends
 * with '_error', '_loss', or 'hausdorff'.
 */
export interface ModelEvaluationResult {
  /** Registry ID of the evaluated model (from MLModelMetadata). */
  modelId: string;

  /** Registry ID of the dataset used for evaluation. */
  datasetId: string;

  /** Which split of the dataset was used (should normally be 'test'). */
  splitUsed: DatasetSplit;

  /**
   * Dictionary of evaluation metrics.
   * Keys must match the recommended keys documented above, or be prefixed
   * with the evaluating team's identifier to avoid collisions.
   */
  metrics: Record<string, number>;

  /** ISO-8601 timestamp when the evaluation was run. */
  evaluatedAt: string;

  /**
   * Identifier of the person or automated system that ran the evaluation.
   * Example: 'user:jane.doe@myortho.tech' or 'ci:github-actions/eval-pipeline'.
   */
  evaluatedBy: string;
}

// ---------------------------------------------------------------------------
// Training runs
// ---------------------------------------------------------------------------

/**
 * Record of a single model training run.
 *
 * Captures the full provenance needed to reproduce the trained artefact:
 * which dataset, which framework, which hyperparameters, and where the
 * resulting checkpoint was stored.
 *
 * Immutable once completedAt is set.  If a training run is re-started
 * (e.g. after a failure), a new TrainingRun record must be created.
 */
export interface TrainingRun {
  /** Unique identifier for this training run (UUID v4). */
  id: string;

  /** Registry ID of the model being trained (from MLModelMetadata). */
  modelId: string;

  /** Registry ID of the dataset used for this training run. */
  datasetId: string;

  /**
   * Framework used for training.
   * Note: may differ from MLModelMetadata.framework if a training framework
   * exports to a different inference format (e.g. PyTorch → ONNX Runtime).
   */
  framework: string;

  /**
   * Key-value map of hyperparameters used.
   * Common keys: 'learning_rate', 'batch_size', 'epochs', 'optimizer',
   *              'loss_function', 'weight_decay', 'lr_scheduler'.
   * Values must be serialisable to JSON for storage.
   */
  hyperparameters: Record<string, string | number | boolean>;

  /** ISO-8601 timestamp when training commenced. */
  startedAt: string;

  /**
   * ISO-8601 timestamp when training completed (successfully or otherwise).
   * null if the run is still in progress or was never cleanly terminated.
   */
  completedAt: string | null;

  /**
   * Final training metrics at the last (or best) checkpoint.
   * Keys should include at minimum 'train_loss' and 'val_loss'.
   * null if the run did not complete.
   */
  finalMetrics: Record<string, number> | null;

  /**
   * Object-storage or filesystem path to the saved model checkpoint.
   * Example: 's3://myortho-models/training-runs/<id>/best_model.ckpt'
   * null if no checkpoint was saved (failed early runs).
   */
  checkpointPath: string | null;
}

// ---------------------------------------------------------------------------
// Dataset registry interface
// ---------------------------------------------------------------------------

/**
 * Service contract for the training dataset registry.
 *
 * ARCHITECTURE EXTENSION POINT: no concrete implementation exists in the
 * current codebase.  Implementations may persist to PostgreSQL,
 * MLflow, DVC, or a custom metadata store.
 *
 * The registry manages only metadata.  Actual dataset artefacts (scan files,
 * annotation files) are stored externally (object storage) and referenced
 * by paths in DatasetMetadata.collectionProtocol or out-of-band.
 */
export interface IDatasetRegistry {
  /**
   * Registers a new dataset version in the registry.
   *
   * @param metadata - Dataset descriptor (id will be assigned if empty string).
   * @returns The assigned registry ID.
   * @throws If a dataset with the same name+version already exists.
   */
  registerDataset(metadata: Omit<DatasetMetadata, 'id' | 'createdAt'>): Promise<string>;

  /**
   * Retrieves metadata for a single registered dataset.
   *
   * @param datasetId - Registry UUID.
   * @returns The metadata record.
   * @throws If no dataset with the given ID is found.
   */
  getDataset(datasetId: string): Promise<DatasetMetadata>;

  /**
   * Lists all registered datasets, optionally filtered.
   *
   * @param filter - Optional filters; omit to return all datasets.
   */
  listDatasets(filter?: {
    taskType?: MLTaskType;
    healthStatus?: DatasetHealthStatus;
  }): Promise<DatasetMetadata[]>;

  /**
   * Stores a model evaluation result against a dataset.
   *
   * @param result - Evaluation payload to persist.
   */
  addEvaluation(result: ModelEvaluationResult): Promise<void>;

  /**
   * Returns all evaluation results for a model, optionally filtered
   * by dataset or split.
   *
   * @param modelId - Registry ID of the model.
   * @param filter - Optional filters.
   * @returns List of evaluation records, newest-first.
   */
  getEvaluations(
    modelId: string,
    filter?: { datasetId?: string; splitUsed?: DatasetSplit },
  ): Promise<ModelEvaluationResult[]>;
}
