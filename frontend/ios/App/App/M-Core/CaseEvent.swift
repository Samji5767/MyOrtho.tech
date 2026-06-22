import Foundation
import SwiftData

// MARK: - EventKind

enum EventKind: String, Codable, CaseIterable, Hashable {
    case note
    case scan
    case segmentation
    case treatmentPlan
    case manufacturing
    case appointment
    case systemEvent

    var displayName: String {
        switch self {
        case .note:          return "Note"
        case .scan:          return "Scan"
        case .segmentation:  return "Segmentation"
        case .treatmentPlan: return "Treatment Plan"
        case .manufacturing: return "Manufacturing"
        case .appointment:   return "Appointment"
        case .systemEvent:   return "System"
        }
    }

    var systemImage: String {
        switch self {
        case .note:          return "text.bubble"
        case .scan:          return "camera"
        case .segmentation:  return "waveform.path"
        case .treatmentPlan: return "list.clipboard"
        case .manufacturing: return "gearshape.2"
        case .appointment:   return "calendar"
        case .systemEvent:   return "info.circle"
        }
    }
}

// MARK: - EventStatus

enum EventStatus: String, Codable, Hashable {
    // Generic lifecycle
    case queued, processing, complete, failed, reviewed
    // Manufacturing stages
    case printing, qc, finishing, shipped, delivered
    // Appointment states
    case scheduled, noShow, cancelled
}

// MARK: - TeamRole

enum TeamRole: String, Codable, Hashable {
    case orthodontist, assistant, labTech, system
}

// MARK: - CaseEvent

@Model
final class CaseEvent {
    var id: UUID
    var kindRaw: String
    var timestamp: Date
    var scheduledAt: Date?
    var statusRaw: String?
    var authorName: String
    var authorRoleRaw: String
    var note: String?
    var isPinned: Bool
    var replyToEventID: UUID?
    var metadataJSON: String?
    var clinicalCase: ClinicalCase?

    var kind: EventKind {
        get { EventKind(rawValue: kindRaw) ?? .systemEvent }
        set { kindRaw = newValue.rawValue }
    }

    var status: EventStatus? {
        get { statusRaw.flatMap { EventStatus(rawValue: $0) } }
        set { statusRaw = newValue?.rawValue }
    }

    var authorRole: TeamRole {
        get { TeamRole(rawValue: authorRoleRaw) ?? .orthodontist }
        set { authorRoleRaw = newValue.rawValue }
    }

    init(
        kind: EventKind,
        timestamp: Date = .now,
        scheduledAt: Date? = nil,
        status: EventStatus? = nil,
        authorName: String = "Dr. Admin",
        authorRole: TeamRole = .orthodontist,
        note: String? = nil,
        isPinned: Bool = false
    ) {
        self.id            = UUID()
        self.kindRaw       = kind.rawValue
        self.timestamp     = timestamp
        self.scheduledAt   = scheduledAt
        self.statusRaw     = status?.rawValue
        self.authorName    = authorName
        self.authorRoleRaw = authorRole.rawValue
        self.note          = note
        self.isPinned      = isPinned
    }
}

// MARK: - Event metadata types

struct ScanEventMeta: Codable {
    var filename: String
    var triangleCount: Int
}

struct SegmentationEventMeta: Codable {
    var teethDetected: Int
    var confidence: Double
    var approved: Int
    var pending: Int
}

struct TreatmentPlanEventMeta: Codable {
    var version: Int
    var stageCount: Int
    var durationMonths: Int?
}

struct ManufacturingEventMeta: Codable {
    var vendor: String
    var stageCount: Int
    var material: String
    var etaDays: Int?
    var trackingRef: String?
    var orderRef: String?
}

// MARK: - CaseEvent metadata helpers

extension CaseEvent {
    func decodeMeta<T: Decodable>(_ type: T.Type) -> T? {
        guard let json = metadataJSON,
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(type, from: data)
    }

    func encodeMeta<T: Encodable>(_ value: T) {
        guard let data = try? JSONEncoder().encode(value),
              let json = String(data: data, encoding: .utf8) else { return }
        metadataJSON = json
    }
}
