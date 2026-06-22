import SwiftUI
import SwiftData
import UniformTypeIdentifiers

// MARK: - CaseThreadView

struct CaseThreadView: View {
    let caseID: UUID

    @Query private var cases: [ClinicalCase]
    @Environment(CaseEventStore.self) private var store
    @Environment(\.modelContext) private var modelContext
    @Environment(AppNavigation.self) private var navigation

    @State private var noteText           = ""
    @State private var showingCaseEdit    = false
    @State private var showingActionMenu  = false
    @State private var showingScanPicker  = false
    @State private var showingAppointment = false
    @State private var scanImportError: String? = nil
    @State private var isImportingScan    = false

    init(caseID: UUID) {
        self.caseID = caseID
        _cases = Query(filter: #Predicate<ClinicalCase> { $0.id == caseID })
    }

    private var clinicalCase: ClinicalCase? { cases.first }

    private var sortedEvents: [CaseEvent] {
        (clinicalCase?.events ?? []).sorted { $0.timestamp < $1.timestamp }
    }

    private var eventsByDay: [(day: Date, events: [CaseEvent])] {
        let cal = Calendar.current
        let grouped = Dictionary(grouping: sortedEvents) { cal.startOfDay(for: $0.timestamp) }
        return grouped.keys.sorted().map { day in
            (day: day, events: (grouped[day] ?? []).sorted { $0.timestamp < $1.timestamp })
        }
    }

    var body: some View {
        VStack(spacing: 0) {
            scrollArea
            Divider().overlay(AppColor.divider)
            composerBar
        }
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { threadToolbar }
        .sheet(isPresented: $showingCaseEdit) {
            if let c = clinicalCase { CaseEditSheet(clinicalCase: c) }
        }
        .sheet(isPresented: $showingAppointment) {
            AppointmentSheet { date in scheduleAppointment(at: date) }
        }
        .fileImporter(
            isPresented: $showingScanPicker,
            allowedContentTypes: [
                UTType(filenameExtension: "stl") ?? .data,
                UTType(filenameExtension: "obj") ?? .data
            ],
            allowsMultipleSelection: false
        ) { result in
            importScan(result: result)
        }
        .alert("Scan Import Failed", isPresented: Binding(
            get: { scanImportError != nil },
            set: { if !$0 { scanImportError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(scanImportError ?? "")
        }
        .background(AppColor.background)
    }

    // MARK: - Scroll area

    private var scrollArea: some View {
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: 0) {
                    if sortedEvents.isEmpty {
                        emptyThreadState
                    } else {
                        ForEach(eventsByDay, id: \.day) { group in
                            DaySeparatorView(date: group.day)
                            ForEach(group.events) { event in
                                EventBubbleView(
                                    event: event,
                                    onSendToManufacturing: sendToManufacturing
                                )
                                .id(event.id)
                                .transition(.asymmetric(
                                    insertion: .move(edge: .bottom).combined(with: .opacity),
                                    removal: .opacity
                                ))
                            }
                        }
                    }
                    Color.clear.frame(height: 1).id("threadBottom")
                }
                .padding(.horizontal, AppSpacing.base)
                .padding(.top, AppSpacing.base)
                .padding(.bottom, AppSpacing.sm)
                .animation(.spring(response: 0.35, dampingFraction: 0.75), value: sortedEvents.count)
            }
            .onAppear {
                DispatchQueue.main.async {
                    proxy.scrollTo("threadBottom", anchor: .bottom)
                }
            }
            .onChange(of: sortedEvents.count) { _, _ in
                withAnimation(.spring(response: 0.35, dampingFraction: 0.75)) {
                    proxy.scrollTo("threadBottom", anchor: .bottom)
                }
            }
        }
    }

    private var emptyThreadState: some View {
        VStack(spacing: AppSpacing.lg) {
            Spacer(minLength: 100)
            Image(systemName: "text.bubble")
                .font(.system(size: 56, weight: .thin))
                .foregroundStyle(AppColor.accent.opacity(0.25))
            VStack(spacing: AppSpacing.xs) {
                Text("No events yet")
                    .font(AppFont.headline())
                    .foregroundStyle(AppColor.textPrimary)
                Text("Add a note, upload a scan, or record an appointment.")
                    .font(AppFont.body())
                    .foregroundStyle(AppColor.textSecondary)
                    .multilineTextAlignment(.center)
            }
            Spacer(minLength: 80)
        }
        .frame(maxWidth: .infinity)
    }

    // MARK: - Composer bar

    private var composerBar: some View {
        HStack(alignment: .bottom, spacing: AppSpacing.sm) {
            Button { showingActionMenu = true } label: {
                if isImportingScan {
                    ProgressView().controlSize(.small).tint(AppColor.accent)
                } else {
                    Image(systemName: "plus.circle.fill")
                        .font(.system(size: 30))
                        .foregroundStyle(AppColor.accent)
                }
            }
            .disabled(isImportingScan)
            .confirmationDialog("Add to case", isPresented: $showingActionMenu, titleVisibility: .visible) {
                Button("Upload Scan") { showingScanPicker = true }
                Button("Open in Workspace") { navigation.selectedTab = .workspace }
                Button("Schedule Appointment") { showingAppointment = true }
                Button("Send to Manufacturing") { sendToManufacturing() }
                Button("Cancel", role: .cancel) {}
            }

            TextField("Add a note…", text: $noteText, axis: .vertical)
                .font(AppFont.body())
                .foregroundStyle(AppColor.textPrimary)
                .tint(AppColor.accent)
                .lineLimit(1...6)
                .padding(.horizontal, AppSpacing.sm)
                .padding(.vertical, AppSpacing.sm)
                .background(AppColor.surfaceElevated,
                            in: RoundedRectangle(cornerRadius: AppRadius.bubble, style: .continuous))

            Button(action: sendNote) {
                Image(systemName: "arrow.up.circle.fill")
                    .font(.system(size: 30))
                    .foregroundStyle(
                        noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty
                            ? AppColor.textTertiary : AppColor.accent
                    )
            }
            .disabled(noteText.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)
        }
        .padding(.horizontal, AppSpacing.base)
        .padding(.vertical, AppSpacing.sm)
        .padding(.bottom, AppSpacing.xs)
        .background(AppColor.surface)
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var threadToolbar: some ToolbarContent {
        ToolbarItem(placement: .principal) {
            if let c = clinicalCase {
                VStack(spacing: 1) {
                    Text(c.patientName)
                        .font(AppFont.headline())
                        .foregroundStyle(AppColor.textPrimary)
                    Text(c.caseType.rawValue)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textSecondary)
                }
            }
        }
        ToolbarItem(placement: .primaryAction) {
            Button { showingCaseEdit = true } label: {
                Image(systemName: "info.circle")
                    .foregroundStyle(AppColor.accent)
            }
        }
    }

    // MARK: - Actions

    @MainActor
    private func sendNote() {
        let text = noteText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !text.isEmpty, let c = clinicalCase else { return }
        noteText = ""
        let event = CaseEvent(kind: .note, note: text)
        try? store.append(event, to: c)
    }

    // MARK: - Upload Scan

    private func importScan(result: Result<[URL], Error>) {
        guard case .success(let urls) = result,
              let source = urls.first,
              let c = clinicalCase else { return }
        isImportingScan = true

        Task.detached(priority: .userInitiated) {
            do {
                let (entry, dest) = try await copyScanAndIndex(source: source)
                let filename = entry.filename
                let triangleCount = entry.triangleCount
                await MainActor.run {
                    let event = CaseEvent(kind: .scan, note: "\(filename) · \(triangleCount.formatted()) triangles")
                    event.encodeMeta(ScanEventMeta(filename: filename, triangleCount: triangleCount))
                    try? store.append(event, to: c)
                    navigation.workspaceURLToLoad = dest
                    isImportingScan = false
                }
            } catch {
                await MainActor.run {
                    scanImportError = error.localizedDescription
                    isImportingScan = false
                }
            }
        }
    }

    private func copyScanAndIndex(source: URL) async throws -> (ScanEntry, URL) {
        let fm = FileManager.default
        let scansDir = fm.urls(for: .documentDirectory, in: .userDomainMask)[0]
            .appendingPathComponent("Scans")
        try fm.createDirectory(at: scansDir, withIntermediateDirectories: true)

        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }

        let destName = source.lastPathComponent
        let dest = scansDir.appendingPathComponent(destName)
        if fm.fileExists(atPath: dest.path) { try fm.removeItem(at: dest) }
        try fm.copyItem(at: source, to: dest)

        let loader = STLLoader()
        let result = try await loader.load(from: dest)
        let entry = ScanEntry(filename: destName, importDate: .now, triangleCount: result.originalTriangles, note: nil)

        let indexURL = scansDir.appendingPathComponent("scans_index.json")
        var existing: [ScanEntry] = []
        if let data = try? Data(contentsOf: indexURL) {
            existing = (try? JSONDecoder().decode([ScanEntry].self, from: data)) ?? []
        }
        existing.insert(entry, at: 0)
        if let data = try? JSONEncoder().encode(existing) {
            try? data.write(to: indexURL, options: .atomic)
        }

        return (entry, dest)
    }

    // MARK: - Schedule Appointment

    @MainActor
    private func scheduleAppointment(at date: Date) {
        guard let c = clinicalCase else { return }
        let fmt = date.formatted(date: .abbreviated, time: .shortened)
        let event = CaseEvent(kind: .appointment, scheduledAt: date, status: .scheduled,
                              note: "Appointment scheduled for \(fmt)")
        try? store.append(event, to: c)
    }

    // MARK: - Send to Manufacturing

    @MainActor
    private func sendToManufacturing() {
        guard let c = clinicalCase else { return }
        let event = CaseEvent(kind: .manufacturing, status: .queued,
                              note: "Case queued for manufacturing — Spring Ray")
        event.encodeMeta(ManufacturingEventMeta(vendor: "Spring Ray", stageCount: 0, material: "Clear 0.75mm"))
        try? store.append(event, to: c)
    }
}

// MARK: - Appointment sheet

private struct AppointmentSheet: View {
    let onSchedule: (Date) -> Void
    @Environment(\.dismiss) private var dismiss
    @State private var appointmentDate = Calendar.current.date(
        byAdding: .day, value: 1, to: .now) ?? .now

    var body: some View {
        NavigationStack {
            Form {
                DatePicker(
                    "Date & Time",
                    selection: $appointmentDate,
                    in: Date.now...,
                    displayedComponents: [.date, .hourAndMinute]
                )
            }
            .scrollContentBackground(.hidden)
            .background(Color.moBackground)
            .navigationTitle("Schedule Appointment")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button("Schedule") {
                        onSchedule(appointmentDate)
                        dismiss()
                    }
                }
            }
        }
    }
}

// MARK: - Day separator

private struct DaySeparatorView: View {
    let date: Date

    private var label: String {
        let cal = Calendar.current
        if cal.isDateInToday(date)     { return "Today" }
        if cal.isDateInYesterday(date) { return "Yesterday" }
        return date.formatted(date: .abbreviated, time: .omitted)
    }

    var body: some View {
        HStack(spacing: AppSpacing.sm) {
            Rectangle().fill(AppColor.divider).frame(height: 1)
            Text(label)
                .font(AppFont.caption())
                .foregroundStyle(AppColor.textTertiary)
                .fixedSize()
            Rectangle().fill(AppColor.divider).frame(height: 1)
        }
        .padding(.vertical, AppSpacing.base)
    }
}

// MARK: - Event bubble dispatcher

struct EventBubbleView: View {
    let event: CaseEvent
    var onSendToManufacturing: (() -> Void)? = nil

    var body: some View {
        switch event.kind {
        case .note:          NoteBubble(event: event)
        case .systemEvent:   SystemPill(event: event)
        case .scan:          ScanCard(event: event)
        case .segmentation:  SegmentationCard(event: event)
        case .treatmentPlan: TreatmentPlanCard(event: event, onSendToMfg: onSendToManufacturing)
        case .manufacturing: ManufacturingCard(event: event)
        case .appointment:   AppointmentCard(event: event)
        }
    }
}

// MARK: - Note bubble (trailing — doctor authored)

private struct NoteBubble: View {
    let event: CaseEvent

    var body: some View {
        HStack(alignment: .bottom) {
            Spacer(minLength: 64)
            VStack(alignment: .trailing, spacing: AppSpacing.xxs) {
                Text(event.note ?? "")
                    .font(AppFont.body())
                    .foregroundStyle(AppColor.textPrimary)
                    .multilineTextAlignment(.leading)
                    .padding(.horizontal, AppSpacing.md)
                    .padding(.vertical, AppSpacing.sm)
                    .background(AppColor.selfBubble,
                                in: RoundedRectangle(cornerRadius: AppRadius.bubble, style: .continuous))

                HStack(spacing: AppSpacing.xs) {
                    Text(event.authorName)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textTertiary)
                    Text("·")
                        .foregroundStyle(AppColor.textTertiary)
                    Text(event.timestamp, style: .relative)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textTertiary)
                }
            }
        }
        .padding(.bottom, AppSpacing.sm)
    }
}

// MARK: - System pill (centered)

private struct SystemPill: View {
    let event: CaseEvent

    var body: some View {
        HStack {
            Spacer()
            Text(event.note ?? event.kind.displayName)
                .font(AppFont.caption())
                .foregroundStyle(AppColor.textTertiary)
                .padding(.horizontal, AppSpacing.md)
                .padding(.vertical, AppSpacing.xs)
                .background(AppColor.surfaceElevated, in: Capsule())
            Spacer()
        }
        .padding(.bottom, AppSpacing.sm)
    }
}











// MARK: - Event status badge

struct EventStatusBadge: View {
    let status: EventStatus

    var body: some View {
        Text(label)
            .font(.system(size: 11, weight: .medium))
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, 3)
            .background(color.opacity(0.15), in: Capsule())
            .foregroundStyle(color)
    }

    var label: String {
        switch status {
        case .queued:     return "Queued"
        case .processing: return "Processing"
        case .complete:   return "Complete"
        case .failed:     return "Failed"
        case .reviewed:   return "Reviewed"
        case .printing:   return "Printing"
        case .qc:         return "QC"
        case .finishing:  return "Finishing"
        case .shipped:    return "Shipped"
        case .delivered:  return "Delivered"
        case .scheduled:  return "Scheduled"
        case .noShow:     return "No Show"
        case .cancelled:  return "Cancelled"
        }
    }

    var color: Color {
        switch status {
        case .complete, .delivered, .reviewed:         return AppColor.approved
        case .processing, .printing, .qc, .finishing:  return AppColor.manufacturing
        case .queued:                                   return AppColor.pending
        case .failed, .noShow, .cancelled:             return AppColor.rejected
        case .shipped:                                  return AppColor.accent
        case .scheduled:                               return AppColor.accentSecondary
        }
    }
}

// MARK: - Preview

#Preview {
    let config    = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: ClinicalCase.self, CaseEvent.self,
                                        configurations: config)
    let store = CaseEventStore(context: container.mainContext)
    let cal   = Calendar.current

    let sample = ClinicalCase(
        patientName: "Priya Sharma",
        patientID:   "ORT-001",
        caseType:    .aligner,
        startDate:   cal.date(byAdding: .month, value: -2, to: .now)!
    )
    container.mainContext.insert(sample)

    try? store.append(CaseEvent(
        kind:      .scan,
        timestamp: cal.date(byAdding: .day, value: -14, to: .now)!,
        note:      "Scan imported: upper_arch.stl (317,425 triangles)"
    ), to: sample)
    try? store.append(CaseEvent(
        kind:      .scan,
        timestamp: cal.date(byAdding: .day, value: -14, to: .now)!,
        note:      "Lower arch scan imported"
    ), to: sample)
    try? store.append(CaseEvent(
        kind:      .segmentation,
        timestamp: cal.date(byAdding: .day, value: -13, to: .now)!,
        status:    .complete,
        note:      "14 teeth detected, confidence 94%"
    ), to: sample)
    try? store.append(CaseEvent(
        kind:      .treatmentPlan,
        timestamp: cal.date(byAdding: .day, value: -10, to: .now)!,
        status:    .complete,
        note:      "12 aligner stages approved by Dr. Sharma"
    ), to: sample)
    try? store.append(CaseEvent(
        kind:      .manufacturing,
        timestamp: cal.date(byAdding: .day, value: -5, to: .now)!,
        status:    .printing,
        note:      "Stages 1–6 sent to Spring Ray"
    ), to: sample)
    try? store.append(CaseEvent(
        kind:        .appointment,
        timestamp:   cal.date(byAdding: .day, value: -3, to: .now)!,
        scheduledAt: cal.date(byAdding: .day, value: 4, to: .now)!,
        status:      .scheduled,
        note:        "Initial scan review"
    ), to: sample)
    try? store.append(CaseEvent(
        kind: .note,
        note: "Patient tolerating aligners well. Next check-in in 3 weeks."
    ), to: sample)

    return NavigationStack {
        CaseThreadView(caseID: sample.id)
    }
    .modelContainer(container)
    .environment(store)
    .environment(AppConfig())
    .environment(AppNavigation())
}
