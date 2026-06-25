import SwiftUI

// MARK: - LiveCasesView (sheet)

struct LiveCasesView: View {
    @State private var vm = LiveCasesViewModel()
    @State private var selectedCase: APICaseListItem?
    @Environment(\.dismiss) private var dismiss

    var body: some View {
        NavigationStack {
            Group {
                switch vm.state {
                case .idle:
                    Color.clear.onAppear { Task { await vm.load() } }

                case .loading:
                    ProgressView("Loading cases…")
                        .frame(maxWidth: .infinity, maxHeight: .infinity)

                case .loaded where vm.cases.isEmpty:
                    ContentUnavailableView(
                        "No cases on server",
                        systemImage: "folder.badge.questionmark",
                        description: Text("Cases created on the server will appear here.")
                    )

                case .loaded:
                    caseList

                case .offline(let msg):
                    offlineBanner(msg)

                case .error(let msg):
                    errorBanner(msg)
                }
            }
            .navigationTitle("Server Cases")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Close") { dismiss() }
                }
                ToolbarItem(placement: .primaryAction) {
                    Button {
                        Task { await vm.refresh() }
                    } label: {
                        Image(systemName: "arrow.clockwise")
                    }
                    .disabled(vm.state == .loading)
                }
            }
        }
    }

    // MARK: - Case list

    private var caseList: some View {
        List {
            // Demo disclaimer header
            Section {
                HStack(spacing: 8) {
                    Image(systemName: "info.circle")
                        .foregroundStyle(.blue)
                    Text("Live data from myortho.tech backend. Not a demo.")
                        .font(.caption)
                        .foregroundStyle(.secondary)
                }
            }

            Section {
                ForEach(vm.cases) { item in
                    Button {
                        selectedCase = item
                    } label: {
                        LiveCaseRow(item: item)
                    }
                    .buttonStyle(.plain)
                }
            } header: {
                Text("\(vm.cases.count) case\(vm.cases.count == 1 ? "" : "s")")
            }
        }
        .listStyle(.insetGrouped)
        .refreshable { await vm.refresh() }
        .sheet(item: $selectedCase) { c in
            LiveCaseDetailView(caseId: c.id, patientName: c.patient.fullName)
        }
    }

    // MARK: - State views

    private func offlineBanner(_ msg: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "wifi.slash")
                .font(.largeTitle)
                .foregroundStyle(.secondary)
            Text("Server unreachable")
                .font(.headline)
            Text(msg)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Retry") { Task { await vm.refresh() } }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }

    private func errorBanner(_ msg: String) -> some View {
        VStack(spacing: 20) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundStyle(.orange)
            Text("Error")
                .font(.headline)
            Text(msg)
                .font(.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)
            Button("Retry") { Task { await vm.refresh() } }
                .buttonStyle(.borderedProminent)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
}

// MARK: - LiveCaseRow

struct LiveCaseRow: View {
    let item: APICaseListItem

    private static let relFmt: RelativeDateTimeFormatter = {
        let f = RelativeDateTimeFormatter()
        f.unitsStyle = .short
        return f
    }()

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            Circle()
                .fill(statusColor.opacity(0.15))
                .overlay(
                    Text(item.patient.fullName.prefix(1))
                        .font(.system(size: 17, weight: .semibold))
                        .foregroundStyle(statusColor)
                )
                .frame(width: 44, height: 44)

            VStack(alignment: .leading, spacing: 3) {
                HStack(alignment: .firstTextBaseline) {
                    Text(item.patient.fullName)
                        .font(.headline)
                        .lineLimit(1)
                    Spacer(minLength: 4)
                    Text(Self.relFmt.localizedString(for: item.updatedAt, relativeTo: Date()))
                        .font(.caption2)
                        .foregroundStyle(.tertiary)
                }

                HStack(spacing: 6) {
                    Text(item.status.replacingOccurrences(of: "_", with: " ").capitalized)
                        .font(.caption)
                        .foregroundStyle(statusColor)
                    if let cc = item.chiefComplaint, !cc.isEmpty {
                        Text("·")
                            .foregroundStyle(.tertiary)
                        Text(cc)
                            .font(.caption)
                            .foregroundStyle(.secondary)
                            .lineLimit(1)
                    }
                }
            }
        }
        .padding(.vertical, 4)
    }

    private var statusColor: Color {
        switch item.status {
        case "completed":                       return .green
        case "canceled":                        return .red
        case "manufacturing", "staging":        return .orange
        case "planning", "pending_approval",
             "approved":                        return .blue
        default:                                return .teal
        }
    }
}
