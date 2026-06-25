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

struct APISegJob: Decodable {
    let jobId: String
    let status: String   // queued | processing | completed | failed
    let caseId: String?
    let scanId: String?
    let teethDetected: Int?
    let missingTeeth: [Int]?
    let completedAt: Date?
    let error: String?
    let disclaimer: String?

    var isTerminal: Bool { status == "completed" || status == "failed" }
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

struct APIPrintJobsResponse: Decodable {
    let jobs: [APIPrintJob]
    let total: Int
}

struct APIPrintJob: Decodable, Identifiable {
    let id: String
    let printerId: String?
    let printerName: String?
    let patientName: String?
    let status: String
    let qualityScore: Double?
    let qcNotes: String?
    let startedAt: Date?
    let completedAt: Date?
    let createdAt: Date
}

struct APIPrintersResponse: Decodable {
    let printers: [APIPrinter]
}

struct APIPrinter: Decodable, Identifiable {
    let id: String
    let name: String
    let brand: String
    let model: String
    let status: String
    let materialType: String?
    let materialVolumeMl: Double?
    let connectorStatus: String   // always "connector_required"
    let connectorNote: String
    let createdAt: Date
}
