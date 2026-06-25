import SwiftUI
import SwiftData

struct CaseListView: View {
    @Binding var selectedCaseID: UUID?
    @Query(sort: \ClinicalCase.lastActivityAt, order: .reverse) private var allCases: [ClinicalCase]
    @Environment(\.modelContext) private var modelContext

    @State private var searchText = ""
    @State private var activeTypeFilter: CaseType? = nil
    @State private var activeStateFilter: CaseState? = nil
    @State private var showingNewCase = false
    @State private var showDeleteError = false
    @State private var deleteErrorMessage = ""
    @State private var showingServerCases = false

    @Environment(AppConfig.self) private var config

    private var activeCases: [ClinicalCase] {
        allCases.filter { !$0.isArchived }
    }

    private var filteredCases: [ClinicalCase] {
        activeCases
            .filter { c in
                searchText.isEmpty ||
                c.patientName.localizedCaseInsensitiveContains(searchText)
            }
            .filter { c in activeTypeFilter == nil || c.caseType == activeTypeFilter }
            .filter { c in activeStateFilter == nil || c.state == activeStateFilter }
    }

    var body: some View {
        VStack(spacing: 0) {
            brandedHeader
            if !activeCases.isEmpty {
                filterStrip
            }
            caseList
        }
        .searchable(text: $searchText, prompt: "Search patients")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar { toolbar }
        .overlay {
            if activeCases.isEmpty {
                CaseListEmptyStateView(onNewCase: { showingNewCase = true })
            }
        }
        .sheet(isPresented: $showingNewCase) {
            NewCaseView { id in selectedCaseID = id }
        }
        .sheet(isPresented: $showingServerCases) {
            LiveCasesView()
        }
        .alert("Delete Failed", isPresented: $showDeleteError) {
            Button("OK") {}
        } message: {
            Text(deleteErrorMessage)
        }
        .background(AppColor.background)
    }

    // MARK: - Branded header

    private var brandedHeader: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 0) {
                    Text("MyOrtho")
                        .font(.moTitle)
                        .foregroundStyle(Color.moTextPrimary)
                    Text(".tech")
                        .font(.moTitle)
                        .foregroundStyle(Color.moTeal)
                }
                Text("Active Cases")
                    .font(.moCaption)
                    .foregroundStyle(Color.moTextSecondary)
                    .tracking(1.0)
                    .textCase(.uppercase)
            }
            Spacer()
            Circle()
                .fill(Color.moSurfaceElevated)
                .frame(width: 36, height: 36)
                .overlay(
                    Text(String(config.practiceName.prefix(1)))
                        .font(.moBodyMedium)
                        .foregroundStyle(Color.moTeal)
                )
        }
        .padding(.horizontal, AppSpacing.base)
        .padding(.vertical, AppSpacing.sm)
        .background(Color.moBackground)
    }

    // MARK: - Filter strip

    private var filterStrip: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: AppSpacing.xs) {
                ForEach(CaseType.allCases, id: \.self) { type in
                    FilterChip(
                        label: type.rawValue,
                        isActive: activeTypeFilter == type,
                        color: AppColor.accentSecondary
                    ) {
                        activeTypeFilter = activeTypeFilter == type ? nil : type
                    }
                }

                Rectangle()
                    .fill(AppColor.divider)
                    .frame(width: 1, height: 18)
                    .padding(.horizontal, AppSpacing.xxs)

                ForEach([CaseState.active, .inProgress, .inManufacturing, .complete], id: \.self) { state in
                    FilterChip(
                        label: state.rawValue,
                        isActive: activeStateFilter == state,
                        color: stateColor(state)
                    ) {
                        activeStateFilter = activeStateFilter == state ? nil : state
                    }
                }
            }
            .padding(.horizontal, AppSpacing.base)
            .padding(.vertical, AppSpacing.sm)
        }
        .background(AppColor.surface)
    }

    // MARK: - Case list

    private var caseList: some View {
        Group {
            if !searchText.isEmpty && filteredCases.isEmpty {
                ContentUnavailableView.search(text: searchText)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(AppColor.background)
            } else {
                List(selection: $selectedCaseID) {
                    ForEach(filteredCases) { c in
                        CaseRowView(clinicalCase: c)
                            .tag(c.id)
                            .listRowBackground(AppColor.background)
                            .listRowSeparatorTint(AppColor.divider)
                            .listRowInsets(EdgeInsets(
                                top: 0,
                                leading: AppSpacing.base,
                                bottom: 0,
                                trailing: AppSpacing.base
                            ))
                    }
                    .onDelete(perform: deleteCases)
                }
                .listStyle(.plain)
                .scrollContentBackground(.hidden)
                .background(AppColor.background)
            }
        }
    }

    // MARK: - Toolbar

    @ToolbarContentBuilder
    private var toolbar: some ToolbarContent {
        ToolbarItem(placement: .primaryAction) {
            Button {
                showingNewCase = true
            } label: {
                Image(systemName: "square.and.pencil")
                    .accessibilityLabel("New case")
            }
        }
        ToolbarItem(placement: .navigationBarLeading) {
            Button {
                showingServerCases = true
            } label: {
                Label("Server Cases", systemImage: "cloud")
                    .labelStyle(.iconOnly)
            }
            .accessibilityLabel("View server cases")
        }
    }

    // MARK: - Delete

    @MainActor
    private func deleteCases(at offsets: IndexSet) {
        for index in offsets {
            if filteredCases[index].id == selectedCaseID { selectedCaseID = nil }
            modelContext.delete(filteredCases[index])
        }
        do {
            try modelContext.save()
        } catch {
            deleteErrorMessage = error.localizedDescription
            showDeleteError = true
        }
    }

    private func stateColor(_ state: CaseState) -> Color {
        switch state {
        case .active:          return AppColor.approved
        case .inProgress:      return AppColor.accentSecondary
        case .inManufacturing: return AppColor.manufacturing
        case .complete:        return AppColor.textSecondary
        case .archived:        return AppColor.textTertiary
        }
    }
}

// MARK: - Filter chip

private struct FilterChip: View {
    let label: String
    let isActive: Bool
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Text(label)
                .font(AppFont.caption())
                .fontWeight(isActive ? .semibold : .regular)
                .foregroundStyle(isActive ? color : AppColor.textSecondary)
                .padding(.horizontal, AppSpacing.sm)
                .padding(.vertical, AppSpacing.xs)
                .background(
                    isActive ? color.opacity(0.15) : AppColor.surfaceElevated,
                    in: Capsule()
                )
                .overlay(Capsule().strokeBorder(isActive ? color.opacity(0.4) : Color.clear, lineWidth: 1))
        }
        .buttonStyle(.plain)
    }
}

// MARK: - Case row

private struct CaseRowView: View {
    let clinicalCase: ClinicalCase

    private var lastEventPreview: String? {
        guard let event = clinicalCase.events.max(by: { $0.timestamp < $1.timestamp }) else { return nil }
        if let note = event.note, !note.isEmpty { return note }
        return event.kind.displayName
    }

    var body: some View {
        HStack(alignment: .top, spacing: AppSpacing.sm) {
            AvatarView(
                initials: clinicalCase.patientName.initials,
                colorSeed: abs(clinicalCase.patientName.hashValue),
                size: 44
            )

            VStack(alignment: .leading, spacing: AppSpacing.xxs) {
                HStack(alignment: .firstTextBaseline) {
                    Text(clinicalCase.patientName)
                        .font(AppFont.body())
                        .fontWeight(.semibold)
                        .foregroundStyle(AppColor.textPrimary)
                        .lineLimit(1)
                    Spacer(minLength: 8)
                    Text(clinicalCase.lastActivityAt, style: .relative)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textTertiary)
                }

                HStack(spacing: AppSpacing.xs) {
                    Text(clinicalCase.caseType.rawValue)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textSecondary)
                    CaseStateChip(state: clinicalCase.state)
                }

                if let preview = lastEventPreview {
                    Text(preview)
                        .font(AppFont.caption())
                        .foregroundStyle(AppColor.textTertiary)
                        .lineLimit(1)
                }
            }
        }
        .padding(.vertical, AppSpacing.sm)
        .contentShape(Rectangle())
    }
}

// MARK: - Case state chip

struct CaseStateChip: View {
    let state: CaseState

    var body: some View {
        HStack(spacing: 4) {
            Circle().fill(color).frame(width: 6, height: 6)
            Text(state.rawValue)
                .font(AppFont.caption())
                .foregroundStyle(color)
        }
    }

    private var color: Color {
        switch state {
        case .active:          return AppColor.approved
        case .inProgress:      return AppColor.accentSecondary
        case .inManufacturing: return AppColor.manufacturing
        case .complete:        return AppColor.textSecondary
        case .archived:        return AppColor.textTertiary
        }
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var selectedID: UUID? = nil
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: ClinicalCase.self, CaseEvent.self, configurations: config)
    let store = CaseEventStore(context: container.mainContext)
    try? SeedData.populateIfNeeded(store: store)
    return NavigationSplitView {
        CaseListView(selectedCaseID: $selectedID)
    } detail: {
        Text("Select a case").foregroundStyle(.secondary)
    }
    .modelContainer(container)
    .environment(store)
    .environment(AppConfig())
}
