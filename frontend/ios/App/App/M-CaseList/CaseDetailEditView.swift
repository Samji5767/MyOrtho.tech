import SwiftUI

struct CaseDetailEditView: View {
    @Binding var draft: CaseEditDraft

    var body: some View {
        Form {
            patientSection
            treatmentSection
            clinicalSection
        }
        .scrollContentBackground(.hidden)
        .background(Color.moBackground)
    }

    private var patientSection: some View {
        Section("Patient") {
            LabeledContent("Name") {
                TextField("Full name", text: $draft.patientName)
                    .multilineTextAlignment(.trailing)
            }
            LabeledContent("Contact") {
                TextField("Phone or email", text: $draft.contactInfo)
                    .multilineTextAlignment(.trailing)
            }
            if let dob = draft.dateOfBirth {
                DatePicker(
                    "Date of Birth",
                    selection: Binding(get: { dob }, set: { draft.dateOfBirth = $0 }),
                    displayedComponents: .date
                )
            } else {
                Button("Add Date of Birth") {
                    draft.dateOfBirth = Calendar.current.date(byAdding: .year, value: -25, to: .now)
                }
            }
        }
    }

    private var treatmentSection: some View {
        Section("Treatment") {
            Picker("Type", selection: $draft.caseType) {
                ForEach(CaseType.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            Picker("Status", selection: $draft.caseStatus) {
                ForEach(CaseStatus.allCases, id: \.self) { Text($0.rawValue).tag($0) }
            }
            DatePicker("Start Date", selection: $draft.startDate, displayedComponents: .date)
            if let estEnd = draft.estimatedEndDate {
                DatePicker(
                    "Est. End Date",
                    selection: Binding(get: { estEnd }, set: { draft.estimatedEndDate = $0 }),
                    displayedComponents: .date
                )
                Button("Remove Est. End Date", role: .destructive) {
                    draft.estimatedEndDate = nil
                }
            } else {
                Button("Add Estimated End Date") {
                    draft.estimatedEndDate = Calendar.current.date(byAdding: .year, value: 1, to: draft.startDate)
                }
            }
        }
    }

    private var clinicalSection: some View {
        Section("Clinical Notes") {
            TextEditor(text: $draft.notes)
                .frame(minHeight: 100)
                .font(AppFont.body())
        }
    }
}
