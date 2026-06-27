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

// MARK: - Clinical Analysis (Phase 17B)

struct APICaseAnalysis: Decodable, Identifiable {
    let id: String
    let caseId: String
    let boltonOverall: Double?
    let boltonAnterior: Double?
    let angleClass: String?
    let overjetMm: Double?
    let overbiteM: Double?
    let upperCrowdingMm: Double?
    let lowerCrowdingMm: Double?
    let complexityScore: Int?
    let iprSchedule: [APIIprEntry]
    let notes: String?
    let createdByEmail: String?
    let createdAt: Date
    let updatedAt: Date?

    var boltonOverallFormatted: String {
        guard let v = boltonOverall else { return "—" }
        return String(format: "%.1f%%", v)
    }
    var boltonAnteriorFormatted: String {
        guard let v = boltonAnterior else { return "—" }
        return String(format: "%.1f%%", v)
    }
    var crowdingLabel: String {
        let u = upperCrowdingMm.map { String(format: "U: %+.1fmm", $0) } ?? "U: —"
        let l = lowerCrowdingMm.map { String(format: " L: %+.1fmm", $0) } ?? " L: —"
        return u + l
    }
}

struct APIIprEntry: Decodable {
    let stage: Int
    let toothA: String
    let toothB: String
    let amountMm: Double
}

// MARK: - Surgical Planning (Phase 18)

struct APIImplant: Decodable, Identifiable {
    let id: String
    let manufacturer: String
    let system: String
    let sku: String?
    let diameterMm: Double
    let lengthMm: Double
    let material: String
    let connectionType: String?

    var displayName: String { "\(manufacturer) \(system) Ø\(String(format:"%.1f",diameterMm))×\(String(format:"%.0f",lengthMm))mm" }
}

struct APIImplantPlacement: Decodable, Identifiable {
    let id: String
    let toothNumber: String
    let pitchDeg: Double?
    let rollDeg: Double?
    let boneDensity: String?
    let safetyStatus: String   // safe | warning | collision
    let notes: String?
    let implant: APIImplantRef?
    let plannedByEmail: String?
    let createdAt: Date

    var safetyColor: String {
        switch safetyStatus {
        case "collision": return "red"
        case "warning": return "orange"
        default: return "green"
        }
    }
}

struct APIImplantRef: Decodable {
    let manufacturer: String
    let system: String
    let diameterMm: Double
    let lengthMm: Double
}

struct APITadPlan: Decodable, Identifiable {
    let id: String
    let insertionSite: String
    let toothA: String
    let toothB: String?
    let angulationDeg: Double?
    let depthMm: Double?
    let rootCollisionRisk: String  // low | moderate | high
    let purpose: String?
    let createdAt: Date
}

struct APISurgicalGuide: Decodable, Identifiable {
    let id: String
    let guideType: String         // implant | tad | osteotomy
    let sleeveDiameterMm: Double?
    let guideThicknessMm: Double
    let ventHoles: Bool
    let offsetMm: Double
    let exportStatus: String      // pending | ready | exported
    let exportedAt: Date?
    let createdAt: Date
}

// MARK: - Notifications (Phase 18)

struct APINotification: Decodable, Identifiable {
    let id: String
    let type: String
    let title: String
    let body: String?
    let isRead: Bool
    let readAt: Date?
    let createdAt: Date

    var relativeTime: String {
        let diff = Date().timeIntervalSince(createdAt)
        if diff < 60 { return "just now" }
        if diff < 3600 { return "\(Int(diff/60))m ago" }
        if diff < 86400 { return "\(Int(diff/3600))h ago" }
        return "\(Int(diff/86400))d ago"
    }
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
