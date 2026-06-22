import Foundation
import SwiftData

// MARK: - CaseState

enum CaseState: String, Codable, CaseIterable, Hashable {
    case active          = "Active"
    case inProgress      = "In Progress"
    case inManufacturing = "In Manufacturing"
    case complete        = "Complete"
    case archived        = "Archived"
}

// MARK: - CaseType

enum CaseType: String, CaseIterable, Codable {
    case aligner      = "Aligner"
    case braces       = "Braces"
    case retainer     = "Retainer"
    case consultation = "Consultation"
    case other        = "Other"
}

// MARK: - CaseStatus (clinical lifecycle)

enum CaseStatus: String, CaseIterable, Codable {
    case active    = "Active"
    case onHold    = "On Hold"
    case completed = "Completed"
}

// MARK: - ClinicalCase

@Model
final class ClinicalCase {

    // MARK: Identity
    var id: UUID
    var patientID: String
    var createdAt: Date
    var lastActivityAt: Date

    // MARK: Patient
    var patientName: String
    var contactInfo: String
    var dateOfBirth: Date?

    // MARK: Case
    var caseTypeRaw: String
    var stateRaw: String
    var caseStatusRaw: String
    var startDate: Date
    var estimatedEndDate: Date?
    var notes: String
    var isArchived: Bool

    // MARK: Relationships
    @Relationship(deleteRule: .cascade, inverse: \CaseEvent.clinicalCase)
    var events: [CaseEvent] = []

    // MARK: Computed

    var caseType: CaseType {
        get { CaseType(rawValue: caseTypeRaw) ?? .aligner }
        set { caseTypeRaw = newValue.rawValue }
    }

    var state: CaseState {
        get { CaseState(rawValue: stateRaw) ?? .active }
        set { stateRaw = newValue.rawValue }
    }

    var caseStatus: CaseStatus {
        get { CaseStatus(rawValue: caseStatusRaw) ?? .active }
        set { caseStatusRaw = newValue.rawValue }
    }

    // MARK: Init

    init(
        patientName: String,
        patientID: String,
        state: CaseState = .active,
        caseType: CaseType = .aligner,
        caseStatus: CaseStatus = .active,
        contactInfo: String = "",
        dateOfBirth: Date? = nil,
        startDate: Date? = nil,
        estimatedEndDate: Date? = nil,
        notes: String = "",
        isArchived: Bool = false,
        createdAt: Date = .now
    ) {
        self.id            = UUID()
        self.patientName   = patientName
        self.patientID     = patientID
        self.stateRaw      = state.rawValue
        self.caseTypeRaw   = caseType.rawValue
        self.caseStatusRaw = caseStatus.rawValue
        self.contactInfo   = contactInfo
        self.dateOfBirth   = dateOfBirth
        self.startDate     = startDate ?? createdAt
        self.estimatedEndDate = estimatedEndDate
        self.notes         = notes
        self.isArchived    = isArchived
        self.createdAt     = createdAt
        self.lastActivityAt = createdAt
    }
}
