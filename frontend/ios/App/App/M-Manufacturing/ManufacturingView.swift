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

    private var manufacturingEvents: [CaseEvent] {
        allEvents.filter { $0.kind == .manufacturing }
    }

    var body: some View {
        Group {
            if manufacturingEvents.isEmpty {
                MOEmptyState(
                    icon: "printer",
                    title: "No Manufacturing Jobs",
                    subtitle: "Approve a treatment plan in a case to create a job.",
                    actionLabel: "View Cases",
                    action: { navigation.selectedTab = .cases }
                )
            } else {
                List {
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
                }
                .listStyle(.insetGrouped)
                .scrollContentBackground(.hidden)
                .background(Color.moBackground)
            }
        }
        .navigationTitle("Manufacturing")
        .navigationBarTitleDisplayMode(.large)
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
                Text("\(meta.vendor) · \(meta.stageCount) \(meta.stageCount == 1 ? "aligner" : "aligners")")
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
