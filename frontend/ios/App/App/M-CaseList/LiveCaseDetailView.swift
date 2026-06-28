import SwiftUI

// MARK: - LiveCaseDetailView

struct LiveCaseDetailView: View {
    let caseId: String
    let patientName: String

    @State private var selectedTab: DetailTab = .scans
    @Environment(\.dismiss) private var dismiss

    enum DetailTab: String, CaseIterable {
        case scans    = "Scans"
        case plans    = "Plans"
        case analysis = "Analysis"
        case ceph     = "Ceph"
        case photos   = "Photos"
        case surgical = "Surgical"

        var icon: String {
            switch self {
            case .scans:    return "cube.box"
            case .plans:    return "list.clipboard"
            case .analysis: return "chart.bar.doc.horizontal"
            case .ceph:     return "scanner"
            case .photos:   return "camera"
            case .surgical: return "cross.case"
            }
        }
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Tab picker — scrollable to accommodate 4 tabs
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 4) {
                        ForEach(DetailTab.allCases, id: \.self) { t in
                            Button {
                                selectedTab = t
                            } label: {
                                Label(t.rawValue, systemImage: t.icon)
                                    .font(.caption)
                                    .padding(.horizontal, 12)
                                    .padding(.vertical, 7)
                                    .background(selectedTab == t ? Color.accentColor : Color(.systemGray5))
                                    .foregroundColor(selectedTab == t ? .white : .primary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                }

                Divider()

                switch selectedTab {
                case .scans:    LiveScansTab(caseId: caseId)
                case .plans:    LivePlansTab(caseId: caseId)
                case .analysis: LiveAnalysisTab(caseId: caseId)
                case .ceph:     LiveCephTab(caseId: caseId)
                case .photos:   LivePhotosTab(caseId: caseId)
                case .surgical: LiveSurgicalTab(caseId: caseId)
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
            // Phase 15F: hydrate persisted segmentation jobs (survives backend restart)
            let persistedJobs: [APISegJob] = (try? await MyOrthoAPIClient.shared.get(
                "/api/cases/\(caseId)/scans/segmentation-jobs"
            )) ?? []
            for job in persistedJobs {
                guard let scanId = job.scanId else { continue }
                if segJobs[scanId] == nil {
                    segJobs[scanId] = job
                    if !job.isTerminal {
                        startPolling(jobId: job.jobId, scanId: scanId)
                    }
                }
            }
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
                if let job: APISegJob = try? await MyOrthoAPIClient.shared.get("/api/segment-jobs/\(jobId)") {
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
                scanFilename: scan.originalFilename,
                scanJawType: scan.jawType,
                teethDetected: nil,
                missingTeeth: nil,
                failureReason: nil,
                modelName: nil,
                modelVersion: nil,
                validationStatus: nil,
                queuedAt: nil,
                startedAt: nil,
                completedAt: nil,
                createdAt: nil,
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
            plans = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/plans")
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
                "/api/cases/\(caseId)/plans",
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
        struct Body: Encodable { let signature: String }
        do {
            let updated: APITreatmentPlan = try await MyOrthoAPIClient.shared.post(
                "/api/cases/\(caseId)/plans/\(plan.id)/approve",
                body: Body(signature: sigInput)
            )
            approveState = .idle
            sigInput = ""
            onApproved(updated)
        } catch {
            approveState = .failed(error.localizedDescription)
        }
    }
}

// MARK: - LiveAnalysisTab

private struct LiveAnalysisTab: View {
    let caseId: String

    @State private var analysis: APICaseAnalysis? = nil
    @State private var loadState: LiveLoadState = .idle

    var body: some View {
        ScrollView {
            VStack(spacing: 16) {
                // Disclaimer
                HStack(alignment: .top, spacing: 10) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .foregroundStyle(.orange)
                        .font(.callout)
                    Text("Clinical analysis indices are for workflow reference only. Not diagnostically validated. A licensed orthodontist must review all values before clinical use.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
                .padding(12)
                .background(.orange.opacity(0.08), in: RoundedRectangle(cornerRadius: 10))
                .overlay(RoundedRectangle(cornerRadius: 10).stroke(.orange.opacity(0.25), lineWidth: 1))

                switch loadState {
                case .loading:
                    ProgressView("Loading analysis…").padding()

                case .offline(let msg), .error(let msg):
                    ContentUnavailableView(
                        "Analysis unavailable",
                        systemImage: "chart.bar.xmark",
                        description: Text(msg)
                    )

                case .idle, .loaded:
                    if let a = analysis {
                        analysisCard(a)
                    } else {
                        ContentUnavailableView(
                            "No analysis yet",
                            systemImage: "chart.bar.doc.horizontal",
                            description: Text("Open this case in the web app to run Bolton analysis and save clinical measurements.")
                        )
                    }
                }
            }
            .padding()
        }
        .task { await loadAnalysis() }
    }

    @ViewBuilder
    private func analysisCard(_ a: APICaseAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            // Bolton ratios
            VStack(alignment: .leading, spacing: 10) {
                Text("Bolton Analysis")
                    .font(.headline)

                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("Overall (12:12)")
                            .font(.caption).foregroundStyle(.secondary)
                        Text(a.boltonOverallFormatted)
                            .font(.title2).fontWeight(.black)
                            .foregroundStyle(boltonColor(a.boltonOverall, low: 87.5, high: 95.1))
                        Text("norm 87.5–95.1%").font(.caption2).foregroundStyle(.tertiary)
                    }
                    Spacer()
                    VStack(alignment: .trailing, spacing: 4) {
                        Text("Anterior (6:6)")
                            .font(.caption).foregroundStyle(.secondary)
                        Text(a.boltonAnteriorFormatted)
                            .font(.title2).fontWeight(.black)
                            .foregroundStyle(boltonColor(a.boltonAnterior, low: 73.9, high: 80.5))
                        Text("norm 73.9–80.5%").font(.caption2).foregroundStyle(.tertiary)
                    }
                }
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))

            // Classification + measurements
            VStack(alignment: .leading, spacing: 8) {
                Text("Clinical Measurements")
                    .font(.headline)

                Group {
                    measureRow("Angle Classification", value: a.angleClass ?? "—")
                    measureRow("Overjet", value: a.overjetMm.map { String(format: "%.1f mm", $0) } ?? "—")
                    measureRow("Overbite", value: a.overbiteM.map  { String(format: "%.1f mm", $0) } ?? "—")
                    measureRow("Crowding / Spacing", value: a.crowdingLabel)
                    measureRow("Complexity Score", value: a.complexityScore.map { "\($0)/100" } ?? "—")
                }
            }
            .padding()
            .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))

            // IPR schedule
            if !a.iprSchedule.isEmpty {
                VStack(alignment: .leading, spacing: 8) {
                    Text("IPR Schedule (\(a.iprSchedule.count) events)")
                        .font(.headline)
                    ForEach(a.iprSchedule, id: \.stage) { ipr in
                        HStack {
                            Text("Stage \(ipr.stage)")
                                .font(.caption).foregroundStyle(.secondary)
                            Spacer()
                            Text("\(ipr.toothA) × \(ipr.toothB)")
                                .font(.caption).fontWeight(.semibold)
                            Text(String(format: "%.2f mm", ipr.amountMm))
                                .font(.caption).foregroundStyle(.teal)
                        }
                        Divider()
                    }
                }
                .padding()
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }

            // Notes
            if let notes = a.notes, !notes.isEmpty {
                VStack(alignment: .leading, spacing: 6) {
                    Text("Clinical Notes").font(.headline)
                    Text(notes).font(.callout).foregroundStyle(.secondary)
                }
                .padding()
                .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 12))
            }

            // Meta
            if let email = a.createdByEmail {
                Text("Saved by \(email) on \(a.createdAt.formatted(date: .abbreviated, time: .shortened))")
                    .font(.caption2).foregroundStyle(.tertiary)
            }
        }
    }

    private func measureRow(_ label: String, value: String) -> some View {
        HStack {
            Text(label).font(.subheadline).foregroundStyle(.secondary)
            Spacer()
            Text(value).font(.subheadline).fontWeight(.semibold)
        }
    }

    private func boltonColor(_ value: Double?, low: Double, high: Double) -> Color {
        guard let v = value else { return .secondary }
        return (v >= low && v <= high) ? .green : .orange
    }

    private func loadAnalysis() async {
        loadState = .loading
        do {
            analysis = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/analysis/latest")
            loadState = .loaded
        } catch let err as APIClientError {
            if case .httpError(404, _) = err {
                analysis = nil
                loadState = .loaded
            } else {
                loadState = .offline(err.localizedDescription)
            }
        } catch {
            loadState = .offline(error.localizedDescription)
        }
    }
}

// MARK: - LivePhotosTab

private struct LivePhotosTab: View {
    let caseId: String

    @State private var photos: [APIPatientPhoto] = []
    @State private var loadState: LiveLoadState = .idle

    private let groups = ["Facial", "Intraoral", "Radiographic", "Other"]

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                switch loadState {
                case .loading:
                    ProgressView("Loading photos…").padding()

                case .offline(let msg), .error(let msg):
                    ContentUnavailableView(
                        "Photos unavailable",
                        systemImage: "camera.fill",
                        description: Text(msg)
                    )

                case .idle, .loaded:
                    if photos.isEmpty {
                        ContentUnavailableView(
                            "No Photos Yet",
                            systemImage: "camera",
                            description: Text("Add patient photos from the web portal.")
                        )
                    } else {
                        ForEach(groups, id: \.self) { group in
                            let groupPhotos = photos.filter { $0.groupLabel == group }
                            if !groupPhotos.isEmpty {
                                VStack(alignment: .leading, spacing: 8) {
                                    HStack(spacing: 6) {
                                        Image(systemName: groupPhotos.first?.systemIconName ?? "photo")
                                            .foregroundColor(.accentColor)
                                            .font(.caption)
                                        Text(group)
                                            .font(.headline)
                                        Text("(\(groupPhotos.count))")
                                            .font(.caption)
                                            .foregroundColor(.secondary)
                                    }
                                    LazyVGrid(columns: [GridItem(.adaptive(minimum: 100))], spacing: 8) {
                                        ForEach(groupPhotos) { photo in
                                            photoCard(photo)
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
            .padding()
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func photoCard(_ photo: APIPatientPhoto) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            RoundedRectangle(cornerRadius: 8)
                .fill(Color(.systemGray5))
                .frame(height: 80)
                .overlay {
                    Image(systemName: photo.systemIconName)
                        .foregroundColor(.secondary)
                }

            Text(photo.typeLabel)
                .font(.caption2)
                .foregroundColor(.secondary)
                .lineLimit(1)

            if let taken = photo.takenAt {
                Text(taken, style: .date)
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
        }
    }

    private func load() async {
        loadState = .loading
        do {
            let result: [APIPatientPhoto] = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/photos")
            photos = result
            loadState = .loaded
        } catch APIClientError.httpError(404, _) {
            photos = []
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}

// MARK: - LiveCephTab

private struct LiveCephTab: View {
    let caseId: String

    @State private var analyses: [APICephAnalysis] = []
    @State private var loadState: LiveLoadState = .idle

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 16) {
                switch loadState {
                case .loading:
                    ProgressView("Loading cephalometric analyses…").padding()

                case .offline(let msg), .error(let msg):
                    ContentUnavailableView(
                        "Ceph unavailable",
                        systemImage: "scanner",
                        description: Text(msg)
                    )

                case .idle, .loaded:
                    if analyses.isEmpty {
                        ContentUnavailableView(
                            "No Ceph Analyses",
                            systemImage: "scanner",
                            description: Text("Add cephalometric analyses from the web portal.")
                        )
                    } else {
                        ForEach(analyses) { a in
                            cephCard(a)
                        }
                    }
                }
            }
            .padding()
        }
        .task { await load() }
        .refreshable { await load() }
    }

    @ViewBuilder
    private func cephCard(_ a: APICephAnalysis) -> some View {
        VStack(alignment: .leading, spacing: 10) {
            HStack {
                VStack(alignment: .leading, spacing: 2) {
                    Text("Cephalometric Analysis")
                        .font(.subheadline).bold()
                    Text(a.createdAt, style: .date)
                        .font(.caption).foregroundColor(.secondary)
                }
                Spacer()
                if let cls = a.skeletalClass {
                    Text("Class \(cls)")
                        .font(.caption).bold()
                        .padding(.horizontal, 8).padding(.vertical, 3)
                        .background(cls == "I" ? Color.green.opacity(0.15) : cls == "II" ? Color.orange.opacity(0.15) : Color.red.opacity(0.15))
                        .foregroundColor(cls == "I" ? .green : cls == "II" ? .orange : .red)
                        .clipShape(Capsule())
                }
            }

            // Key measurements grid
            LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 8) {
                measureCell("SNA", a.snaDeg, min: 80, max: 84, unit: "°")
                measureCell("SNB", a.snbDeg, min: 78, max: 82, unit: "°")
                measureCell("ANB", a.anbDeg, min: 0,  max: 4,  unit: "°")
                measureCell("FMA", a.fmaDeg, min: 22, max: 28, unit: "°")
                measureCell("IMPA", a.impaDeg, min: 87, max: 95, unit: "°")
                measureCell("Wits", a.witsMm, min: -1, max: 3,  unit: "mm")
            }

            if let vp = a.verticalPattern {
                HStack(spacing: 4) {
                    Text("Vertical:")
                        .font(.caption2).foregroundColor(.secondary)
                    Text(vp.capitalized.replacingOccurrences(of: "_", with: " "))
                        .font(.caption2).bold()
                }
            }

            if let notes = a.aiNotes {
                Text(notes)
                    .font(.caption)
                    .foregroundColor(.secondary)
                    .lineLimit(3)
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }

    @ViewBuilder
    private func measureCell(_ label: String, _ value: Double?, min minV: Double, max maxV: Double, unit: String) -> some View {
        VStack(spacing: 2) {
            Text(label)
                .font(.caption2).foregroundColor(.secondary)
            if let v = value {
                let isNormal = v >= minV && v <= maxV
                Text(String(format: "%.1f\(unit)", v))
                    .font(.caption).bold()
                    .foregroundColor(isNormal ? .green : .orange)
            } else {
                Text("—")
                    .font(.caption)
                    .foregroundColor(.secondary)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 6)
        .background(Color(.systemGray5))
        .clipShape(RoundedRectangle(cornerRadius: 8))
    }

    private func load() async {
        loadState = .loading
        do {
            let result: [APICephAnalysis] = try await MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/ceph")
            analyses = result
            loadState = .loaded
        } catch APIClientError.httpError(404, _) {
            analyses = []
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
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

// MARK: - LiveSurgicalTab

private struct LiveSurgicalTab: View {
    let caseId: String

    @State private var placements: [APIImplantPlacement] = []
    @State private var tads: [APITadPlan] = []
    @State private var guides: [APISurgicalGuide] = []
    @State private var loadState: LiveLoadState = .idle

    var body: some View {
        ScrollView {
            LazyVStack(alignment: .leading, spacing: 20) {
                switch loadState {
                case .loading:
                    ProgressView("Loading surgical plan…").padding()

                case .offline(let msg), .error(let msg):
                    ContentUnavailableView(
                        "Surgical data unavailable",
                        systemImage: "cross.case.fill",
                        description: Text(msg)
                    )

                case .idle, .loaded:
                    // Implant Placements
                    sectionHeader("Implant Placements", count: placements.count, icon: "cross.case")
                    if placements.isEmpty {
                        emptyRow("No implant placements planned")
                    } else {
                        ForEach(placements) { p in
                            placementRow(p)
                        }
                    }

                    // TAD Plans
                    sectionHeader("TAD Plans", count: tads.count, icon: "staple")
                    if tads.isEmpty {
                        emptyRow("No TAD plans recorded")
                    } else {
                        ForEach(tads) { t in
                            tadRow(t)
                        }
                    }

                    // Surgical Guides
                    sectionHeader("Surgical Guides", count: guides.count, icon: "printer")
                    if guides.isEmpty {
                        emptyRow("No surgical guides designed")
                    } else {
                        ForEach(guides) { g in
                            guideRow(g)
                        }
                    }
                }
            }
            .padding()
        }
        .task { await load() }
        .refreshable { await load() }
    }

    // ── Sub-views ────────────────────────────────────────────────────────────

    @ViewBuilder
    private func sectionHeader(_ title: String, count: Int, icon: String) -> some View {
        HStack(spacing: 6) {
            Image(systemName: icon).foregroundColor(.accentColor)
            Text(title).font(.headline)
            Text("(\(count))").font(.subheadline).foregroundColor(.secondary)
        }
    }

    @ViewBuilder
    private func emptyRow(_ text: String) -> some View {
        Text(text).font(.subheadline).foregroundColor(.secondary)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, 4)
    }

    @ViewBuilder
    private func placementRow(_ p: APIImplantPlacement) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text("FDI #\(p.toothNumber)").font(.subheadline).bold()
                Spacer()
                Text(p.safetyStatus.capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(safetyBg(p.safetyStatus))
                    .foregroundColor(safetyFg(p.safetyStatus))
                    .clipShape(Capsule())
            }
            if let impl = p.implant {
                Text("\(impl.manufacturer) Ø\(String(format:"%.1f",impl.diameterMm))×\(String(format:"%.0f",impl.lengthMm))mm")
                    .font(.caption).foregroundColor(.secondary)
            }
            if let pitch = p.pitchDeg, let roll = p.rollDeg {
                Text("Pitch \(String(format:"%.1f",pitch))°  Roll \(String(format:"%.1f",roll))°  Bone \(p.boneDensity ?? "—")")
                    .font(.caption).foregroundColor(.secondary)
            }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func tadRow(_ t: APITadPlan) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(t.insertionSite).font(.subheadline).bold()
                Spacer()
                Text(t.rootCollisionRisk.capitalized + " risk")
                    .font(.caption)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(riskBg(t.rootCollisionRisk))
                    .foregroundColor(riskFg(t.rootCollisionRisk))
                    .clipShape(Capsule())
            }
            Text("Root: \(t.toothA)\(t.toothB.map { " / \($0)" } ?? "")  ·  \(t.angulationDeg.map { "\(Int($0))°" } ?? "—")  ·  \(t.depthMm.map { String(format:"%.1fmm depth",$0) } ?? "—")")
                .font(.caption).foregroundColor(.secondary)
            if let p = t.purpose { Text(p).font(.caption).foregroundColor(.secondary) }
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    @ViewBuilder
    private func guideRow(_ g: APISurgicalGuide) -> some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text(g.guideType.capitalized + " Guide").font(.subheadline).bold()
                Text("Sleeve Ø\(g.sleeveDiameterMm.map { String(format:"%.1f",$0) } ?? "—")mm  ·  Thickness \(String(format:"%.1f",g.guideThicknessMm))mm\(g.ventHoles ? "  ·  Vents" : "")")
                    .font(.caption).foregroundColor(.secondary)
            }
            Spacer()
            Text(g.exportStatus.capitalized)
                .font(.caption2).bold()
                .padding(.horizontal, 8).padding(.vertical, 3)
                .background(g.exportStatus == "exported" ? Color.green.opacity(0.15) : Color(.systemGray5))
                .foregroundColor(g.exportStatus == "exported" ? .green : .secondary)
                .clipShape(Capsule())
        }
        .padding(12)
        .background(Color(.systemGray6))
        .clipShape(RoundedRectangle(cornerRadius: 10))
    }

    // ── Helpers ──────────────────────────────────────────────────────────────

    private func safetyBg(_ s: String) -> Color {
        switch s { case "collision": return .red.opacity(0.15); case "warning": return .orange.opacity(0.15); default: return .green.opacity(0.15) }
    }
    private func safetyFg(_ s: String) -> Color {
        switch s { case "collision": return .red; case "warning": return .orange; default: return .green }
    }
    private func riskBg(_ r: String) -> Color {
        switch r { case "high": return .red.opacity(0.15); case "moderate": return .orange.opacity(0.15); default: return .green.opacity(0.15) }
    }
    private func riskFg(_ r: String) -> Color {
        switch r { case "high": return .red; case "moderate": return .orange; default: return .green }
    }

    private func load() async {
        loadState = .loading
        do {
            async let pReq: [APIImplantPlacement] = MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/surgical/placements")
            async let tReq: [APITadPlan]           = MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/surgical/tads")
            async let gReq: [APISurgicalGuide]     = MyOrthoAPIClient.shared.get("/api/cases/\(caseId)/surgical/guides")
            placements = try await pReq
            tads       = try await tReq
            guides     = try await gReq
            loadState  = .loaded
        } catch APIClientError.httpError(404, _) {
            placements = []; tads = []; guides = []
            loadState = .loaded
        } catch {
            loadState = .error(error.localizedDescription)
        }
    }
}
