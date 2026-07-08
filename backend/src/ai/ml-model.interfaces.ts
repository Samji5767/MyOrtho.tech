/**
 * ml-model.interfaces.ts
 *
 * Extension-point interfaces for ML framework integration in MyOrtho.tech.
 * These are ARCHITECTURE definitions — no runtime implementations exist here.
 * Actual framework adapters (MONAI, ONNX Runtime, TensorRT, etc.) must be
 * implemented in separate adapter classes that satisfy these contracts.
 *
 * Clinical note: All models deployed under these interfaces that produce
 * outputs used for treatment decisions must carry FDA 510(k) clearance or
 * De Novo authorization. `fdaStatus` on MLModelMetadata tracks this.
 */

// ---------------------------------------------------------------------------
// Primitive types
// ---------------------------------------------------------------------------

/**
 * Supported ML inference frameworks.
 * 'custom' covers proprietary inference engines or future integrations.
 */
export type MLFramework =
  | 'monai'        // MONAI (Medical Open Network for AI) — PyTorch-based medical imaging
  | 'pytorch'      // Raw PyTorch / TorchScript
  | 'onnx_runtime' // ONNX Runtime — cross-framework serialization format
  | 'tensorrt'     // NVIDIA TensorRT — GPU-optimized inference
  | 'custom';      // Proprietary or unclassified engines

/**
 * Lifecycle state of a model in the registry.
 * Transitions: registered → loading → ready | error; ready → deprecated
 */
export type MLModelStatus =
  | 'registered'  // Model artifact has been registered but not yet loaded
  | 'loading'     // Framework adapter is loading weights into device memory
  | 'ready'       // Inference-ready; can accept requests
  | 'error'       // Load or runtime failure — inspect error logs
  | 'deprecated'; // Superseded by a newer version; soft-disabled

// ---------------------------------------------------------------------------
// Task types — exported as a runtime constant for validation & listing
// ---------------------------------------------------------------------------

/**
 * Exhaustive list of orthodontic/craniofacial AI task types supported
 * by the platform. Extend this array — and the union type below — together.
 */
export const ML_TASK_TYPES = [
  'segmentation',          // Tooth/bone/soft-tissue segmentation (CBCT / scan data)
  'landmark_detection',    // Cephalometric / CBCT landmark localisation
  'growth_prediction',     // Skeletal growth forecasting from serial records
  'root_proximity',        // Root-to-cortical-bone clearance estimation
  'bone_density',          // Alveolar bone density classification
  'airway_analysis',       // Upper-airway volume and cross-section analysis
] as const;

/** Union derived from ML_TASK_TYPES for compile-time safety. */
export type MLTaskType = (typeof ML_TASK_TYPES)[number];

// ---------------------------------------------------------------------------
// Model metadata
// ---------------------------------------------------------------------------

/**
 * Persistent descriptor for a registered ML model.
 * Stored in the model registry and used for audit trails.
 *
 * Shape arrays follow the convention [batch, channel, depth?, height, width]
 * consistent with the MONAI / PyTorch channel-first format.
 */
export interface MLModelMetadata {
  /** Unique registry identifier (UUID v4). */
  id: string;

  /** Human-readable model name, e.g. "OrthoSeg-CBCT-v2". */
  name: string;

  /** Semantic version string, e.g. "2.1.0". */
  version: string;

  /** Framework used to run inference. */
  framework: MLFramework;

  /**
   * Expected input tensor shape.
   * Use -1 for dynamic dimensions (e.g. variable batch size or spatial dims).
   * Example for a 3-D CBCT volume: [-1, 1, 256, 256, 256]
   */
  inputShape: number[];

  /**
   * Expected output tensor shape.
   * Example for a segmentation map: [-1, 32, 256, 256, 256]
   */
  outputShape: number[];

  /** Clinical task this model performs. */
  taskType: MLTaskType;

  /**
   * Whether the model has completed formal clinical validation
   * (IRB-approved study, multi-site evaluation, etc.).
   * false does NOT mean the model is unsafe — it means the formal
   * validation pipeline has not yet been completed.
   */
  clinicalValidated: boolean;

  /**
   * FDA regulatory status for models used in clinical workflows.
   * 'not_submitted' | '510k_pending' | '510k_cleared' | 'de_novo' | 'exempt'
   * Null for research-only / non-US-deployed models.
   */
  fdaStatus:
    | 'not_submitted'
    | '510k_pending'
    | '510k_cleared'
    | 'de_novo'
    | 'exempt'
    | null;

  /** ISO-8601 timestamp when the model was first registered. */
  createdAt: string;

  /** ISO-8601 timestamp of the last metadata update. */
  updatedAt: string;
}

// ---------------------------------------------------------------------------
// Inference request / result
// ---------------------------------------------------------------------------

/**
 * Options that control a single inference call.
 * All fields are optional; adapters apply framework-specific defaults.
 */
export interface MLInferenceOptions {
  /**
   * Maximum wall-clock time (milliseconds) before the adapter cancels
   * the request and returns an error.
   */
  timeoutMs?: number;

  /**
   * Number of samples to collate into a single forward pass.
   * Only applicable to batching-capable frameworks.
   * Default: 1
   */
  batchSize?: number;

  /**
   * Target compute device.
   * 'auto' lets the adapter choose the fastest available device.
   * 'cpu' forces CPU-only execution (for reproducibility / low-resource envs).
   * 'cuda:<n>' targets a specific NVIDIA GPU (e.g. 'cuda:0').
   */
  device?: 'auto' | 'cpu' | `cuda:${number}`;
}

/**
 * Payload sent to the inference adapter for a single model invocation.
 */
export interface MLInferenceRequest {
  /** Registry ID of the model to invoke. */
  modelId: string;

  /**
   * Raw input data.
   * - Buffer: serialised tensor bytes (framework-native format).
   * - Float32Array: flat float tensor data; shape must match MLModelMetadata.inputShape.
   * - Record<string,unknown>: named input map for multi-input models (ONNX named inputs).
   */
  input: Buffer | Float32Array | Record<string, unknown>;

  /** Runtime options for this specific call. */
  options?: MLInferenceOptions;
}

/**
 * Structured result returned by the inference adapter after a successful call.
 */
export interface MLInferenceResult {
  /** Registry ID of the model that produced this result. */
  modelId: string;

  /**
   * Raw output tensor data.
   * Consumers must reshape using MLModelMetadata.outputShape.
   * - Float32Array: flat float output.
   * - Record<string,Float32Array>: named output map for multi-output models.
   */
  output: Float32Array | Record<string, Float32Array>;

  /**
   * Overall confidence score [0.0, 1.0].
   * Semantics are task-specific (e.g. mean Dice confidence for segmentation,
   * landmark localisation probability for landmark_detection).
   * null when the model architecture does not produce a confidence estimate.
   */
  confidence: number | null;

  /** End-to-end wall-clock inference latency in milliseconds. */
  latencyMs: number;

  /** Device that actually executed the inference (resolved from options.device). */
  deviceUsed: string;

  /**
   * Non-fatal warnings raised by the adapter, e.g.:
   * - 'input_range_clipped' — input values outside training distribution
   * - 'low_confidence_output' — output confidence below recommended threshold
   * Empty array when no warnings were raised.
   */
  warnings: string[];
}

// ---------------------------------------------------------------------------
// Abstract model registry
// ---------------------------------------------------------------------------

/**
 * Abstract base that all ML model registry implementations must extend.
 *
 * Responsibility: maintain a catalogue of versioned model artefacts and
 * dispatch inference requests to the appropriate framework adapter.
 *
 * Implementations must NOT leak framework-specific types across this boundary.
 */
export abstract class MLModelRegistry {
  /**
   * Registers a new model artefact and returns the assigned registry ID.
   *
   * @param metadata - Descriptor (id will be assigned if empty string is provided).
   * @param artifactPath - Filesystem or object-storage path to the model weights.
   * @returns The assigned registry ID.
   * @throws If a model with the same name+version already exists.
   */
  abstract register(metadata: Omit<MLModelMetadata, 'id' | 'createdAt' | 'updatedAt'>, artifactPath: string): Promise<string>;

  /**
   * Retrieves metadata for a single registered model.
   *
   * @param modelId - Registry UUID.
   * @returns The metadata record.
   * @throws If no model with the given ID is found.
   */
  abstract get(modelId: string): Promise<MLModelMetadata>;

  /**
   * Lists all registered models, optionally filtered by status or task type.
   *
   * @param filter - Optional filters; omit to return all models.
   */
  abstract list(filter?: { status?: MLModelStatus; taskType?: MLTaskType }): Promise<MLModelMetadata[]>;

  /**
   * Dispatches an inference request to the appropriate framework adapter.
   *
   * @param request - Inference payload including model ID and input data.
   * @returns Structured inference result.
   * @throws MLInferenceError (to be defined per-adapter) on timeout / model error.
   */
  abstract runInference(request: MLInferenceRequest): Promise<MLInferenceResult>;
}

// ---------------------------------------------------------------------------
// Federated learning
// ---------------------------------------------------------------------------

/**
 * Configuration for a federated learning participant.
 *
 * Federated learning is an ARCHITECTURE EXTENSION POINT.
 * No federated aggregation server exists in the current codebase;
 * this interface defines the contract for future implementation.
 *
 * Privacy budget follows the (ε, δ)-differential-privacy convention.
 * Recommended ε ≤ 8.0 for clinical applications (NIST SP 800-226).
 */
export interface FederatedLearningConfig {
  /** Unique identifier for this participating practice / node. */
  participantId: string;

  /**
   * Global model aggregation strategy.
   * 'fedavg'  — Federated Averaging (McMahan et al., 2017).
   * 'fedprox' — FedProx with proximal regularisation (Li et al., 2020).
   */
  aggregationStrategy: 'fedavg' | 'fedprox';

  /**
   * Minimum number of participants required before the aggregation
   * server initiates a global model update round.
   */
  minParticipants: number;

  /**
   * Differential-privacy epsilon (ε) budget per communication round.
   * Lower values provide stronger privacy guarantees at the cost of accuracy.
   * Set to null to disable DP (not recommended for PHI-adjacent data).
   */
  privacyBudget: number | null;

  /** Total number of global aggregation rounds to run. */
  communicationRounds: number;
}

// ---------------------------------------------------------------------------
// Model drift detection
// ---------------------------------------------------------------------------

/**
 * Metrics produced by the drift-detection subsystem for a deployed model.
 *
 * Concept drift indicates that the production data distribution has shifted
 * away from the training distribution, which may silently degrade clinical
 * output quality.  Alerts should be raised when driftScore > alertThreshold.
 *
 * ARCHITECTURE EXTENSION POINT: drift computation logic must be implemented
 * by a concrete DriftMonitor class; this interface defines the data contract.
 */
export interface ModelDriftMetrics {
  /** Registry ID of the monitored model. */
  modelId: string;

  /**
   * Reference accuracy measured on the held-out validation set
   * at the time the model was deployed.
   * Range: [0.0, 1.0]
   */
  baselineAccuracy: number;

  /**
   * Accuracy estimated from recent production inferences
   * (requires ground-truth labels from clinician feedback loop).
   * null when insufficient labelled production samples are available.
   * Range: [0.0, 1.0]
   */
  currentAccuracy: number | null;

  /**
   * Scalar drift score derived from distribution-shift metrics
   * (e.g. Population Stability Index, Jensen–Shannon divergence).
   * Range: [0.0, ∞); 0.0 = no drift.
   */
  driftScore: number;

  /** ISO-8601 timestamp when this drift report was computed. */
  detectedAt: string;

  /**
   * driftScore threshold above which an alert should be raised.
   * Recommended starting value: 0.2 (based on PSI interpretation guidelines).
   */
  alertThreshold: number;
}
