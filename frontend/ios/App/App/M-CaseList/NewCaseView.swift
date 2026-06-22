import SwiftUI
import SwiftData

struct NewCaseView: View {
    let onCreate: (UUID) -> Void

    @Environment(\.dismiss) private var dismiss
    @Environment(CaseEventStore.self) private var store

    @State private var patientName = ""
    @State private var caseType: CaseType = .aligner
    @State private var startDate = Date.now
    @State private var showSaveError = false
    @State private var saveErrorMessage = ""

    private var canCreate: Bool {
        !patientName.trimmingCharacters(in: .whitespaces).isEmpty
    }

    var body: some View {
        NavigationStack {
            Form {
                Section("Patient") {
                    TextField("Full name", text: $patientName)
                }
                Section("Treatment") {
                    Picker("Type", selection: $caseType) {
                        ForEach(CaseType.allCases, id: \.self) { type in
                            Text(type.rawValue).tag(type)
                        }
                    }
                    DatePicker("Start Date", selection: $startDate, displayedComponents: .date)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.moBackground)
            .navigationTitle("New Case")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Create", action: create).disabled(!canCreate)
                }
            }
            .alert("Save Failed", isPresented: $showSaveError) {
                Button("OK") {}
            } message: {
                Text(saveErrorMessage)
            }
        }
    }

    @MainActor
    private func create() {
        let name = patientName.trimmingCharacters(in: .whitespaces)
        let patientID = "ORT-\(UUID().uuidString.prefix(6).uppercased())"
        let newCase = ClinicalCase(
            patientName: name,
            patientID: patientID,
            caseType: caseType,
            startDate: startDate
        )
        do {
            try store.insertCase(newCase)
            onCreate(newCase.id)
            dismiss()
        } catch {
            saveErrorMessage = error.localizedDescription
            showSaveError = true
        }
    }
}
