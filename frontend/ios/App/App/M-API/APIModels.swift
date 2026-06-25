import Foundation

// MARK: - Case list

struct APICaseListItem: Decodable, Identifiable {
    let id: String
    let status: String
    let chiefComplaint: String?
    let malocclusionClass: String?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
    let patient: APIPatient
    let assignedTo: APIAssignee?
}

struct APIPatient: Decodable {
    let id: String
    let firstName: String
    let lastName: String
    var fullName: String { "\(firstName) \(lastName)" }
}

struct APIAssignee: Decodable {
    let id: String
    let name: String
    let email: String
}

// MARK: - Case detail

struct APICaseDetail: Decodable {
    let id: String
    let status: String
    let chiefComplaint: String?
    let malocclusionClass: String?
    let notes: String?
    let createdAt: Date
    let updatedAt: Date
    let patient: APIPatientDetail
    let assignedTo: APIAssignee?
    let workflowHistory: [APIWorkflowEvent]
    let allowedTransitions: [String]
}

struct APIPatientDetail: Decodable {
    let id: String
    let firstName: String
    let lastName: String
    let dateOfBirth: String?
    let gender: String?
    let clinicalNotes: String?
    var fullName: String { "\(firstName) \(lastName)" }
}

struct APIWorkflowEvent: Decodable, Identifiable {
    let id: String
    let fromStatus: String?
    let toStatus: String
    let actorId: String?
    let actorName: String?
    let actorRole: String?
    let notes: String?
    let createdAt: Date
}

// MARK: - Scans

struct APIScan: Decodable, Identifiable {
    let id: String
    let caseId: String
    let jawType: String
    let originalFilename: String
    let fileFormat: String
    let fileSizeBytes: Int
    let filePath: String
    let createdAt: Date
}

// MARK: - Segmentation jobs

struct APISegTriggerResponse: Decodable {
    let jobId: String
    let status: String
    let disclaimer: String?
}

/// Persistent segmentation job (Phase 15F — stored in segmentation_jobs table, survives backend restart)
struct APISegJob: Decodable {
    let jobId: String
    let status: String   // queued | processing | completed | failed | review_required
    let caseId: String?
    let scanId: String?
    let scanFilename: String?
    let scanJawType: String?
    let teethDetected: Int?
    let missingTeeth: [Int]?
    let failureReason: String?
    let modelName: String?
    let modelVersion: String?
    let validationStatus: String?  // not_validated | research_use_only | cleared
    let queuedAt: Date?
    let startedAt: Date?
    let completedAt: Date?
    let createdAt: Date?
    // Legacy field name from AI engine responses
    let error: String?
    let disclaimer: String?

    var isTerminal: Bool { status == "completed" || status == "failed" || status == "review_required" }
    var displayFailureReason: String? { failureReason ?? error }
}

// MARK: - Treatment plans

struct APITreatmentPlan: Decodable, Identifiable {
    let id: String
    let caseId: String
    let createdByEmail: String?
    let doctorApproval: Bool
    let doctorSignature: String?
    let approvedAt: Date?
    let estimatedStages: Int
    let aiRecommendationNotes: String?
    let createdAt: Date
    let aiDisclaimer: String?
}

// MARK: - Manufacturing
//
// Backend returns arrays directly (not wrapped).
// APIPrintJobsResponse is kept as a Decodable wrapper for backwards compat —
// LiveManufacturingViewModel decodes [APIPrintJob] directly.

struct APIPrintJob: Decodable, Identifiable {
    let id: String
    let printerId: String?
    let printer: APIPrinterRef?
    let stageId: String?
    let stageNumber: Int?
    let status: String
    let qualityScore: Double?
    let qcNotes: String?
    let failureReason: String?
    let retryCount: Int?
    let startedAt: Date?
    let completedAt: Date?
    let createdAt: Date
    let connectorNote: String?

    // Legacy iOS fields for backwards compat in LiveJobRow
    var printerName: String? { printer?.name }
    var patientName: String? { nil }
}

struct APIPrinterRef: Decodable {
    let name: String
    let brand: String
    let model: String
    let status: String
    let connectorStatus: String?
}

struct APIPrinter: Decodable, Identifiable {
    let id: String
    let name: String
    let brand: String
    let model: String
    let status: String
    let materialType: String?
    let materialVolumeMl: Double?
    let connectorStatus: String
    let apiEndpoint: String?
    let connectorNote: String
    let createdAt: Date
    let updatedAt: Date
}
