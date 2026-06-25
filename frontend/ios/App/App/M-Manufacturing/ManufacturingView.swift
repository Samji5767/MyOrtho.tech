import SwiftUI
import SwiftData

// MARK: - MfgStage

enum MfgStage: String, CaseIterable, Codable {
    case queued     = "queued"
    case printing   = "printing"
    case qc         = "qc"
    case finishing  = "finishing"
    case shipped    = "shipped"
    case delivered  = "delivered"

    var displayName: String {
        switch self {
        case .queued:    return "Queued"
        case .printing:  return "Printing"
        case .qc:        return "QC"
        case .finishing: return "Finishing"
        case .shipped:   return "Shipped"
        case .delivered: return "Delivered"
        }
    }
}

// MARK: - ManufacturingView

struct ManufacturingView: View {
    @Query(sort: \CaseEvent.timestamp, order: .reverse) private var allEvents: [CaseEvent]
    @Environment(AppNavigation.self) private var navigation
    @State private var liveVM = LiveManufacturingViewModel()

    private var manufacturingEvents: [CaseEvent] {
        allEvents.filter { $0.kind == .manufacturing }
    }

    var body: some View {
        List {
            // MARK: Live section
            Section {
                switch liveVM.state {
                case .idle, .loading:
                    HStack {
                        ProgressView().scaleEffect(0.8)
                        Text("Loading live jobs…").font(.caption).foregroundStyle(.secondary)
                    }
                    .listRowBackground(Color.clear)

                case .loaded where liveVM.jobs.isEmpty && liveVM.printers.isEmpty:
                    Text("No live jobs or printers found on server.")
                        .font(.caption).foregroundStyle(.secondary)
                        .listRowBackground(Color.clear)

                case .loaded:
                    ForEach(liveVM.jobs) { job in
                        LiveJobRow(job: job)
                    }

                case .offline(let msg):
                    HStack(spacing: 8) {
                        Image(systemName: "wifi.slash").foregroundStyle(.secondary)
                        Text(msg).font(.caption).foregroundStyle(.secondary)
                    }
                    .listRowBackground(Color.clear)

                case .error(let msg):
                    HStack(spacing: 8) {
                        Image(systemName: "exclamationmark.triangle").foregroundStyle(.orange)
                        Text(msg).font(.caption).foregroundStyle(.orange)
                    }
                    .listRowBackground(Color.clear)
                }
            } header: {
                HStack {
                    Text("Live Print Jobs")
                    Spacer()
                    if liveVM.state == .loaded {
                        Text("\(liveVM.inQueue) queued · \(liveVM.printing) printing · \(liveVM.qcPending) QC")
                            .font(.caption2)
                    }
                }
            }

            // MARK: Printer registry (live)
            if liveVM.state == .loaded && !liveVM.printers.isEmpty {
                Section("Printer Registry") {
                    ForEach(liveVM.printers) { printer in
                        LivePrinterRow(printer: printer)
                    }
                }
            }

            // MARK: Local SwiftData jobs
            if !manufacturingEvents.isEmpty {
                ForEach(MfgStage.allCases, id: \.self) { stage in
                    let stageEvents = manufacturingEvents.filter {
                        $0.status?.rawValue == stage.rawValue
                    }
                    if !stageEvents.isEmpty {
                        Section(stage.displayName) {
                            ForEach(stageEvents, id: \.id) { event in
                                ManufacturingRowView(event: event)
                            }
                        }
                    }
                }
            } else if liveVM.state == .loaded && liveVM.jobs.isEmpty {
                Section("Local Jobs") {
                    Button {
                        navigation.selectedTab = .cases
                    } label: {
                        Label("Approve a treatment plan to create a job", systemImage: "arrow.right.circle")
                            .font(.caption)
                    }
                    .foregroundStyle(.secondary)
                }
            }
        }
        .listStyle(.insetGrouped)
        .scrollContentBackground(.hidden)
        .background(Color.moBackground)
        .navigationTitle("Manufacturing")
        .navigationBarTitleDisplayMode(.large)
        .task { await liveVM.load() }
        .refreshable { await liveVM.refresh() }
    }
}

// MARK: - LiveJobRow

private struct LiveJobRow: View {
    let job: APIPrintJob

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(job.patientName ?? "Unknown patient")
                    .font(.subheadline).fontWeight(.semibold)
                Spacer()
                Text(job.status.replacingOccurrences(of: "_", with: " ").capitalized)
                    .font(.caption)
                    .padding(.horizontal, 8).padding(.vertical, 3)
                    .background(statusColor(job.status).opacity(0.15))
                    .foregroundStyle(statusColor(job.status))
                    .clipShape(Capsule())
            }
            if let name = job.printerName {
                Text("Printer: \(name)").font(.caption).foregroundStyle(.secondary)
            }
            Text(job.createdAt, style: .date).font(.caption2).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }

    private func statusColor(_ s: String) -> Color {
        switch s {
        case "completed": return .green
        case "failed":    return .red
        case "qc_pending": return .orange
        case "printing", "nesting": return .blue
        default:          return .secondary
        }
    }
}

// MARK: - LivePrinterRow

private struct LivePrinterRow: View {
    let printer: APIPrinter

    var body: some View {
        VStack(alignment: .leading, spacing: 4) {
            HStack {
                Text(printer.name).font(.subheadline).fontWeight(.semibold)
                Spacer()
                Label("Connector required", systemImage: "wifi.slash")
                    .font(.caption2)
                    .foregroundStyle(.orange)
            }
            Text("\(printer.brand) \(printer.model)")
                .font(.caption).foregroundStyle(.secondary)
            Text(printer.connectorNote)
                .font(.caption2).foregroundStyle(.tertiary)
        }
        .padding(.vertical, 2)
    }
}

// MARK: - ManufacturingRowView

struct ManufacturingRowView: View {
    let event: CaseEvent

    var body: some View {
        if let meta = event.decodeMeta(ManufacturingEventMeta.self) {
            VStack(alignment: .leading, spacing: 6) {
                HStack {
                    Text(event.clinicalCase?.patientName ?? "Unknown patient")
                        .font(.moHeadline)
                        .foregroundStyle(Color.moTextPrimary)
                    Spacer()
                    Text(event.status?.rawValue.uppercased() ?? "")
                        .font(.moCaption2)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.moManufacturing.opacity(0.2))
                        .foregroundStyle(Color.moManufacturing)
                        .clipShape(Capsule())
                }
                Text(meta.stageCount > 0
                     ? "\(meta.vendor) · \(meta.stageCount) \(meta.stageCount == 1 ? "aligner" : "aligners")"
                     : meta.vendor)
                    .font(.moBody)
                    .foregroundStyle(Color.moTextSecondary)
                if let ref = meta.trackingRef ?? meta.orderRef {
                    Text("Ref: \(ref)")
                        .font(.moMono)
                        .foregroundStyle(Color.moTextTertiary)
                }
            }
            .padding(.vertical, 4)
        }
    }
}

#Preview {
    NavigationStack { ManufacturingView() }
        .environment(AppNavigation())
}
