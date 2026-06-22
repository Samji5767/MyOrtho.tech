import SwiftUI
import SwiftData

// MARK: - AppTab

enum AppTab: Int, CaseIterable, Hashable {
    case cases, scans, workspace, manufacturing, settings
}

// MARK: - AppNavigation

@Observable
final class AppNavigation {
    var selectedTab: AppTab = .cases
    /// Set to a URL already inside the app's documents directory to auto-load it in Workspace.
    var workspaceURLToLoad: URL? = nil
}

// MARK: - MainTabView

struct MainTabView: View {
    @Environment(AppNavigation.self) private var navigation

    var body: some View {
        @Bindable var nav = navigation
        TabView(selection: $nav.selectedTab) {
            CaseListRootView()
                .tabItem { Label("Cases", systemImage: "tray.full") }
                .tag(AppTab.cases)

            NavigationStack { ScansLibraryView() }
                .tabItem { Label("Scans", systemImage: "cube") }
                .tag(AppTab.scans)

            NavigationStack { WorkspaceView() }
                .tabItem { Label("Workspace", systemImage: "wand.and.stars") }
                .tag(AppTab.workspace)

            NavigationStack { ManufacturingView() }
                .tabItem { Label("Manufacturing", systemImage: "gearshape.2") }
                .tag(AppTab.manufacturing)

            NavigationStack { SettingsView() }
                .tabItem { Label("Settings", systemImage: "gearshape") }
                .tag(AppTab.settings)
        }
        .tint(Color.moTeal)
    }
}

#Preview {
    let config = ModelConfiguration(isStoredInMemoryOnly: true)
    let container = try! ModelContainer(for: ClinicalCase.self, CaseEvent.self, configurations: config)
    let appConfig = AppConfig()
    let store = CaseEventStore(context: container.mainContext)
    try? SeedData.populateIfNeeded(store: store)
    return MainTabView()
        .modelContainer(container)
        .environment(appConfig)
        .environment(store)
        .environment(AppNavigation())
}
