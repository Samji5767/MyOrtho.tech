import SwiftUI

// MARK: - LiveCaseDetailView

struct LiveCaseDetailView: View {
    let caseId: String
    let patientName: String

    @State private var selectedTab: DetailTab = .scans
    @Environment(\.dismiss) private var dismiss

    enum DetailTab: String, CaseIterable {
        case scans  = "Scans"
        case plans  = "Plans"

        var icon: String {
            switch self {
            case .scans: return "cube.box"
            case .plans: return "list.clipboard"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker
                Picker("Tab", selection: $selectedTab) {
                    ForEach(DetailTab.allCases, id: \.self) { t in
                        Label(t.rawValue, systemImage: t.icon).tag(t)
                    }
                }
                .pickerStyle(.segmented)
                .padding(.horizontal)
                .padding(.vertical, 10)

                Divider()

                switch selectedTab {
                case .scans: LiveScansTab(caseId: caseId)
                case .plans: LivePlansTab(caseId: caseId)
                }
            }
            .navigationTitle(patientName)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
            }
        }
    }
}

// MARK: - LiveScansTab

private struct LiveScansTab: View {
    let caseId: String

    @State private var scans: [APIScan] = []
    @State private var loadState: LiveLoadState = .idle
    @State private var showFilePicker = false
    @State private var jawType: JawType = .maxillary
    @State private var uploadState: UploadState = .idle
    @State private var segJobs: [String: APISegJob] = [:]
    @State private var pollingTask: Task<Void, Never>?

    enum JawType: String, CaseIterable {
        case maxillary = "maxillary"
        case mandibular = "mandibular"
        case both = "both"

        var label: String {
            switch self {
            case .maxillary:  return "Upper"
            case .mandibular: return "Lower"
            case .both:       return "Both"
            }
        }
    }

    enum UploadState {
        case idle, uploading, success(APIScan), failed(String)
        var isUploading: Bool { if case .uploading = self { return true }; return false }
    }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                aiDisclaimer

                // Upload card
                uploadCard

                // Scans list
                if !scans.isEmpty {
                    scansSection
                }
            }
            .padding()
        }
        .task { await loadScans() }
        .onDisappear { pollingTask?.cancel() }
        .sheet(isPresented: $showFilePicker) {
            DocumentPicker(types: ["public.data"]) { url in
                Task { await upload(url: url) }
            }
        }
    }

    // MARK: - AI disclaimer

    private var aiDisclaimer: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.callout)
            Text("Not clinically validated. Segmentation and AI planning outputs are for informational purposes only. A licensed orthodontist must review and approve all clinical decisions.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.25), lineWidth: 1))
    }

    // MARK: - Upload card

    private var uploadCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Upload Scan")
                .font(.headline)

            // Jaw selector
            Picker("Jaw", selection: $jawType) {
                ForEach(JawType.allCases, id: \.self) { j in
                    Text(j.label).tag(j)
                }
            }
            .pickerStyle(.segmented)

            Button {
                showFilePicker = true
            } label: {
                Label("Select STL / OBJ / PLY", systemImage: "doc.badge.plus")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 10)
            }
            .buttonStyle(.bordered)
            .disabled(uploadState.isUploading)

            // Upload feedback
            switch uploadState {
            case .idle:
                EmptyView()
            case .uploading:
                HStack {
                    ProgressView().scaleEffect(0.8)
                    Text("Uploading…").font(.caption).foregroundStyle(.secondary)
                }
            case .success(let scan):
                HStack {
                    Image(systemName: "checkmark.circle.fill").foregroundStyle(.green)
                    Text("Uploaded: \(scan.originalFilename)").font(.caption)
                }
            case .failed(let msg):
                HStack {
                    Image(systemName: "exclamationmark.circle.fill").foregroundStyle(.red)
                    Text(msg).font(.caption).foregroundStyle(.red)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Scans section

    private var scansSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Text("Scans (\(scans.count))")
                    .font(.headline)
                Spacer()
                if loadState == .loading {
                    ProgressView().scaleEffect(0.7)
                }
            }

            ForEach(scans) { scan in
                ScanItemRow(scan: scan, caseId: caseId, job: segJobs[scan.id]) { job in
                    segJobs[scan.id] = job
                    if !job.isTerminal {
                        startPolling(jobId: job.jobId, scanId: scan.id)
                    }
                }
            }
        }
    }

    // MARK: - Load / upload

    private func loadScans() async {
        loadState = .loading
        do {
            scans = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/scans")
            loadState = .loaded
        } catch {
            loadState = .offline(error.localizedDescription)
        }
    }

    private func upload(url: URL) async {
        uploadState = .uploading
        do {
            let scan: APIScan = try await MyOrthoAPIClient.shared.uploadScan(
                "/api/cases/\(caseId)/scans",
                fileURL: url,
                jawType: jawType.rawValue
            )
            uploadState = .success(scan)
            scans.insert(scan, at: 0)
        } catch {
            uploadState = .failed(error.localizedDescription)
        }
    }

    // MARK: - Polling

    private func startPolling(jobId: String, scanId: String) {
        pollingTask?.cancel()
        pollingTask = Task {
            while !Task.isCancelled {
                try? await Task.sleep(nanoseconds: 3_000_000_000)
                guard !Task.isCancelled else { break }
                if let job: APISegJob = try? await MyOrthoAPIClient.shared.get("/api/segmentation/\(jobId)") {
                    await MainActor.run { segJobs[scanId] = job }
                    if job.isTerminal { break }
                }
            }
        }
    }
}

// MARK: - ScanItemRow

private struct ScanItemRow: View {
    let scan: APIScan
    let caseId: String
    let job: APISegJob?
    let onJobStarted: (APISegJob) -> Void

    @State private var triggerState: TriggerState = .idle

    enum TriggerState: Equatable { case idle, working, done, failed(String) }

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            HStack {
                Image(systemName: "cube.box.fill")
                    .foregroundStyle(.teal)
                    .font(.callout)
                VStack(alignment: .leading, spacing: 2) {
                    Text(scan.originalFilename).font(.subheadline).lineLimit(1)
                    Text("\(scan.jawType.capitalized) · \(formattedSize(scan.fileSizeBytes))")
                        .font(.caption).foregroundStyle(.secondary)
                }
                Spacer()
                segButton
            }

            // Job status
            if let job {
                HStack(spacing: 6) {
                    jobStatusIcon(job.status)
                    Text(jobStatusLabel(job))
                        .font(.caption).foregroundStyle(.secondary)
                }
                if job.status == "completed", let count = job.teethDetected {
                    Text("Teeth detected: \(count)")
                        .font(.caption2).foregroundStyle(.teal)
                }
                if let disclaimer = job.disclaimer, !disclaimer.isEmpty {
                    Text(disclaimer)
                        .font(.caption2).foregroundStyle(.orange)
                }
            }
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private var segButton: some View {
        let isTerminalOrActive = job?.isTerminal == true || job != nil
        if !isTerminalOrActive {
            Button {
                Task { await triggerSeg() }
            } label: {
                switch triggerState {
                case .idle:
                    Label("Segment", systemImage: "wand.and.stars").font(.caption)
                case .working:
                    ProgressView().scaleEffect(0.7)
                case .done:
                    Label("Started", systemImage: "checkmark").font(.caption)
                case .failed:
                    Label("Retry", systemImage: "arrow.clockwise").font(.caption)
                }
            }
            .buttonStyle(.bordered)
            .disabled(triggerState == .working || triggerState == .done)
        }
    }

    private func triggerSeg() async {
        triggerState = .working
        do {
            let response: APISegTriggerResponse = try await MyOrthoAPIClient.shared.postEmpty(
                "/api/cases/\(caseId)/scans/\(scan.id)/segment"
            )
            let fakeJob = APISegJob(
                jobId: response.jobId,
                status: response.status,
                caseId: caseId,
                scanId: scan.id,
                teethDetected: nil,
                missingTeeth: nil,
                completedAt: nil,
                error: nil,
                disclaimer: response.disclaimer
            )
            triggerState = .done
            onJobStarted(fakeJob)
        } catch {
            triggerState = .failed(error.localizedDescription)
        }
    }

    @ViewBuilder
    private func jobStatusIcon(_ status: String) -> some View {
        switch status {
        case "completed": Image(systemName: "checkmark.circle.fill").foregroundStyle(Color.green)
        case "failed":    Image(systemName: "xmark.circle.fill").foregroundStyle(Color.red)
        case "queued":    Image(systemName: "clock").foregroundStyle(Color.secondary)
        default:          Image(systemName: "arrow.trianglehead.2.clockwise").foregroundStyle(Color.blue)
        }
    }

    private func jobStatusLabel(_ job: APISegJob) -> String {
        switch job.status {
        case "completed": return "Segmentation complete"
        case "failed":    return "Failed: \(job.error ?? "unknown")"
        case "queued":    return "Queued for segmentation"
        case "processing": return "Segmenting…"
        default:          return job.status.capitalized
        }
    }

    private func formattedSize(_ bytes: Int) -> String {
        let mb = Double(bytes) / 1_048_576
        return mb >= 1 ? String(format: "%.1f MB", mb) : "\(bytes / 1024) KB"
    }
}

// MARK: - LivePlansTab

private struct LivePlansTab: View {
    let caseId: String

    @State private var plans: [APITreatmentPlan] = []
    @State private var loadState: LiveLoadState = .idle
    @State private var showCreate = false
    @State private var stages: Int = 14
    @State private var notes: String = ""
    @State private var createState: CreateState = .idle

    enum CreateState: Equatable { case idle, working, failed(String) }

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                aiDisclaimer

                // Create card
                createCard

                // Plans list
                if !plans.isEmpty {
                    plansSection
                } else if loadState == .loaded {
                    Text("No treatment plans yet.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                        .frame(maxWidth: .infinity)
                        .padding()
                }

                if loadState == .loading {
                    ProgressView().padding()
                }
            }
            .padding()
        }
        .task { await loadPlans() }
    }

    // MARK: - AI disclaimer

    private var aiDisclaimer: some View {
        HStack(alignment: .top, spacing: 10) {
            Image(systemName: "exclamationmark.triangle.fill")
                .foregroundStyle(.orange)
                .font(.callout)
            Text("Not clinically validated. AI-generated treatment plan recommendations require review and written approval by a licensed orthodontist before clinical use.")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .padding(12)
        .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
        .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.25), lineWidth: 1))
    }

    // MARK: - Create card

    private var createCard: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text("New Treatment Plan")
                    .font(.headline)
                Spacer()
                Button(showCreate ? "Cancel" : "New Plan") { showCreate.toggle() }
                    .font(.subheadline)
            }

            if showCreate {
                Divider()

                HStack {
                    Text("Estimated stages:")
                        .font(.subheadline)
                    Spacer()
                    Stepper("\(stages)", value: $stages, in: 1...60)
                        .fixedSize()
                }

                TextField("AI recommendation notes (optional)", text: $notes, axis: .vertical)
                    .font(.callout)
                    .lineLimit(2...4)
                    .textFieldStyle(.roundedBorder)

                Button {
                    Task { await createPlan() }
                } label: {
                    Group {
                        if createState == .working {
                            ProgressView().scaleEffect(0.8)
                        } else {
                            Text("Create Plan")
                        }
                    }
                    .frame(maxWidth: .infinity)
                }
                .buttonStyle(.borderedProminent)
                .disabled(createState == .working)

                if case .failed(let msg) = createState {
                    Text(msg).font(.caption).foregroundStyle(.red)
                }
            }
        }
        .padding()
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
    }

    // MARK: - Plans list

    private var plansSection: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text("Plans (\(plans.count))")
                .font(.headline)

            ForEach(plans) { plan in
                PlanRow(plan: plan, caseId: caseId) { updated in
                    if let idx = plans.firstIndex(where: { $0.id == updated.id }) {
                        plans[idx] = updated
                    }
                }
            }
        }
    }

    // MARK: - Actions

    private func loadPlans() async {
        loadState = .loading
        do {
            plans = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/treatment-plans")
            loadState = .loaded
        } catch {
            loadState = .offline(error.localizedDescription)
        }
    }

    private func createPlan() async {
        createState = .working
        struct Body: Encodable {
            let estimatedStages: Int
            let aiRecommendationNotes: String?
        }
        do {
            let plan: APITreatmentPlan = try await MyOrthoAPIClient.shared.post(
                "/api/cases/\(caseId)/treatment-plans",
                body: Body(estimatedStages: stages, aiRecommendationNotes: notes.isEmpty ? nil : notes)
            )
            plans.insert(plan, at: 0)
            showCreate = false
            createState = .idle
            notes = ""
        } catch {
            createState = .failed(error.localizedDescription)
        }
    }
}

// MARK: - PlanRow

private struct PlanRow: View {
    let plan: APITreatmentPlan
    let caseId: String
    let onApproved: (APITreatmentPlan) -> Void

    @State private var sigInput = ""
    @State private var showApproveAlert = false
    @State private var approveState: ApproveState = .idle

    enum ApproveState: Equatable { case idle, working, failed(String) }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack(alignment: .firstTextBaseline) {
                Text("Plan · \(plan.estimatedStages) stages")
                    .font(.subheadline).fontWeight(.semibold)
                Spacer()
                if plan.doctorApproval {
                    Label("Approved", systemImage: "checkmark.seal.fill")
                        .font(.caption).foregroundStyle(.green)
                } else {
                    Button("Approve") { showApproveAlert = true }
                        .font(.caption)
                        .buttonStyle(.bordered)
                        .disabled(approveState == .working)
                }
            }

            if let notes = plan.aiRecommendationNotes, !notes.isEmpty {
                Text(notes).font(.caption).foregroundStyle(.secondary).lineLimit(3)
            }
            if let sig = plan.doctorSignature {
                Text("Signed by: \(sig)").font(.caption2).foregroundStyle(.secondary)
            }
            if let disc = plan.aiDisclaimer, !disc.isEmpty {
                Text(disc).font(.caption2).foregroundStyle(.orange)
            }
            if case .failed(let msg) = approveState {
                Text(msg).font(.caption2).foregroundStyle(.red)
            }

            Text(plan.createdAt, style: .date)
                .font(.caption2).foregroundStyle(.tertiary)
        }
        .padding(12)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 10))
        .alert("Doctor Signature Required", isPresented: $showApproveAlert) {
            TextField("Your name / signature", text: $sigInput)
            Button("Approve", role: .destructive) {
                Task { await approvePlan() }
            }
            Button("Cancel", role: .cancel) { sigInput = "" }
        } message: {
            Text("By approving, you confirm this treatment plan is clinically appropriate for this patient.")
        }
    }

    private func approvePlan() async {
        approveState = .working
        struct Body: Encodable { let doctorSignature: String }
        do {
            let updated: APITreatmentPlan = try await MyOrthoAPIClient.shared.post(
                "/api/cases/\(caseId)/treatment-plans/\(plan.id)/approve",
                body: Body(doctorSignature: sigInput)
            )
            approveState = .idle
            sigInput = ""
            onApproved(updated)
        } catch {
            approveState = .failed(error.localizedDescription)
        }
    }
}

// MARK: - DocumentPicker

private struct DocumentPicker: UIViewControllerRepresentable {
    let types: [String]
    let onPick: (URL) -> Void

    func makeUIViewController(context: Context) -> UIDocumentPickerViewController {
        let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.item])
        picker.delegate = context.coordinator
        picker.allowsMultipleSelection = false
        return picker
    }

    func updateUIViewController(_ uiViewController: UIDocumentPickerViewController, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator(onPick: onPick) }

    class Coordinator: NSObject, UIDocumentPickerDelegate {
        let onPick: (URL) -> Void
        init(onPick: @escaping (URL) -> Void) { self.onPick = onPick }
        func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
            guard let url = urls.first else { return }
            onPick(url)
        }
    }
}
