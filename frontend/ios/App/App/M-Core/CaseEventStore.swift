import Foundation
import SwiftData

/// Single write gateway for all CaseEvent mutations.
/// Views read directly via @Query; every write flows through here
/// so lastActivityAt and context.save() stay consistent.
@Observable
final class CaseEventStore {
    let context: ModelContext

    init(context: ModelContext) {
        self.context = context
    }

    @MainActor
    func append(_ event: CaseEvent, to clinicalCase: ClinicalCase) throws {
        clinicalCase.lastActivityAt = event.timestamp
        context.insert(event)
        event.clinicalCase = clinicalCase
        try context.save()
    }

    @MainActor
    func insertCase(_ clinicalCase: ClinicalCase) throws {
        context.insert(clinicalCase)
        try context.save()
    }

    @MainActor
    func updateState(_ clinicalCase: ClinicalCase, to newState: CaseState) throws {
        clinicalCase.state = newState
        clinicalCase.lastActivityAt = .now
        let event = CaseEvent(kind: .systemEvent, note: "State → \(newState.rawValue)")
        try append(event, to: clinicalCase)
    }

    @MainActor
    func archiveCase(_ clinicalCase: ClinicalCase) throws {
        clinicalCase.isArchived = true
        clinicalCase.lastActivityAt = .now
        try context.save()
    }

    @MainActor
    func restoreCase(_ clinicalCase: ClinicalCase) throws {
        clinicalCase.isArchived = false
        clinicalCase.lastActivityAt = .now
        try context.save()
    }

    /// Permanently removes the case and all cascaded relationships.
    /// Only call after explicit, confirmed user intent — this cannot be undone.
    @MainActor
    func hardDeleteCase(_ clinicalCase: ClinicalCase) throws {
        context.delete(clinicalCase)
        try context.save()
    }
}
