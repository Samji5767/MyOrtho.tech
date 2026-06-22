import SwiftUI
import SwiftData

struct CaseListRootView: View {
    @State private var selectedCaseID: UUID? = nil

    var body: some View {
        NavigationSplitView {
            CaseListView(selectedCaseID: $selectedCaseID)
        } detail: {
            if let id = selectedCaseID {
                CaseThreadView(caseID: id)
                    .id(id)
            } else {
                EmptyThreadPlaceholder()
            }
        }
        .navigationSplitViewStyle(.balanced)
    }
}

private struct EmptyThreadPlaceholder: View {
    var body: some View {
        ZStack {
            AppColor.background.ignoresSafeArea()
            VStack(spacing: AppSpacing.base) {
                Image(systemName: "tray.full")
                    .font(.system(size: 56, weight: .thin))
                    .foregroundStyle(AppColor.accent.opacity(0.25))
                Text("Select a case")
                    .font(AppFont.subheadline())
                    .foregroundStyle(AppColor.textSecondary)
                Text("Choose a patient from the list to open the case thread.")
                    .font(AppFont.caption())
                    .foregroundStyle(AppColor.textTertiary)
                    .multilineTextAlignment(.center)
            }
            .padding(.horizontal, AppSpacing.xxl)
        }
        .accessibilityLabel("No case selected. Choose one from the list.")
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: ClinicalCase.self, CaseEvent.self, configurations: config)
    let store = CaseEventStore(context: container.mainContext)
    try? SeedData.populateIfNeeded(store: store)
    return CaseListRootView()
        .modelContainer(container)
        .environment(store)
        .environment(AppConfig())
}
