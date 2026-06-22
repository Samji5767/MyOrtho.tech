import SwiftUI
import SwiftData

// MARK: - CaseEditDraft

struct CaseEditDraft {
    var patientName: String = ""
    var contactInfo: String = ""
    var dateOfBirth: Date? = nil
    var caseType: CaseType = .aligner
    var caseStatus: CaseStatus = .active
    var startDate: Date = .now
    var estimatedEndDate: Date? = nil
    var notes: String = ""

    init() {}

    init(from clinicalCase: ClinicalCase) {
        patientName      = clinicalCase.patientName
        contactInfo      = clinicalCase.contactInfo
        dateOfBirth      = clinicalCase.dateOfBirth
        caseType         = clinicalCase.caseType
        caseStatus       = clinicalCase.caseStatus
        startDate        = clinicalCase.startDate
        estimatedEndDate = clinicalCase.estimatedEndDate
        notes            = clinicalCase.notes
    }
}

// MARK: - CaseEditSheet

struct CaseEditSheet: View {
    let clinicalCase: ClinicalCase

    @Environment(\.dismiss) private var dismiss
    @Environment(\.modelContext) private var modelContext
    @State private var draft: CaseEditDraft
    @State private var showNameError = false

    init(clinicalCase: ClinicalCase) {
        self.clinicalCase = clinicalCase
        _draft = State(initialValue: CaseEditDraft(from: clinicalCase))
    }

    var body: some View {
        NavigationStack {
            CaseDetailEditView(draft: $draft)
                .navigationTitle("Case Info")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { dismiss() }
                    }
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { save() }
                    }
                }
        }
        .alert("Name Required", isPresented: $showNameError) {
            Button("OK") {}
        } message: {
            Text("Patient name cannot be empty.")
        }
    }

    @MainActor
    private func save() {
        let name = draft.patientName.trimmingCharacters(in: .whitespaces)
        guard !name.isEmpty else { showNameError = true; return }
        clinicalCase.patientName      = name
        clinicalCase.contactInfo      = draft.contactInfo
        clinicalCase.dateOfBirth      = draft.dateOfBirth
        clinicalCase.caseType         = draft.caseType
        clinicalCase.caseStatus       = draft.caseStatus
        clinicalCase.startDate        = draft.startDate
        clinicalCase.estimatedEndDate = draft.estimatedEndDate
        clinicalCase.notes            = draft.notes
        clinicalCase.lastActivityAt   = .now
        try? modelContext.save()
        dismiss()
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: ClinicalCase.self, CaseEvent.self, configurations: config)
    let sample = ClinicalCase(patientName: "Priya Sharma", patientID: "ORT-001", caseType: .aligner)
    container.mainContext.insert(sample)
    return CaseEditSheet(clinicalCase: sample)
        .modelContainer(container)
}
