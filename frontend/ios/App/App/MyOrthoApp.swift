import SwiftUI

@main
struct MyOrthoApp: App {
    @UIApplicationDelegateAdaptor(AppDelegate.self) private var appDelegate

    @State private var config         = AppConfig()
    @State private var store          = CaseEventStore(context: AppPersistence.container.mainContext)
    @State private var navigation     = AppNavigation()
    @State private var lockManager    = AppLockManager()
    @State private var authSession    = AuthSession()
    @State private var isInBackground = false

    init() {
        let navAppearance = UINavigationBarAppearance()
        navAppearance.configureWithOpaqueBackground()
        navAppearance.backgroundColor        = UIColor(Color.moBackground)
        navAppearance.titleTextAttributes    = [
            .foregroundColor: UIColor(Color.moTextPrimary),
            .font: UIFont.systemFont(ofSize: 17, weight: .semibold)
        ]
        navAppearance.largeTitleTextAttributes = [
            .foregroundColor: UIColor(Color.moTextPrimary),
            .font: UIFont.systemFont(ofSize: 32, weight: .bold)
        ]
        navAppearance.shadowColor = .clear
        UINavigationBar.appearance().standardAppearance   = navAppearance
        UINavigationBar.appearance().scrollEdgeAppearance = navAppearance
        UINavigationBar.appearance().tintColor            = UIColor(Color.moTeal)

        let tabAppearance = UITabBarAppearance()
        tabAppearance.configureWithOpaqueBackground()
        tabAppearance.backgroundColor = UIColor(Color.moBackground)
        tabAppearance.stackedLayoutAppearance.selected.iconColor = UIColor(Color.moTeal)
        tabAppearance.stackedLayoutAppearance.selected.titleTextAttributes = [
            .foregroundColor: UIColor(Color.moTeal)
        ]
        tabAppearance.stackedLayoutAppearance.normal.iconColor = UIColor(Color.moTextTertiary)
        tabAppearance.stackedLayoutAppearance.normal.titleTextAttributes = [
            .foregroundColor: UIColor(Color.moTextTertiary)
        ]
        UITabBar.appearance().standardAppearance   = tabAppearance
        UITabBar.appearance().scrollEdgeAppearance = tabAppearance
    }

    var body: some Scene {
        WindowGroup {
            ZStack {
                if authSession.isLoading {
                    LaunchScreenView()

                } else if authSession.isAuthenticated {
                    MainTabView()
                        .environment(store)
                        .environment(config)
                        .environment(navigation)
                        .environment(lockManager)
                        .environment(authSession)
                        .onAppear {
                            try? SeedData.populateIfNeeded(store: store)
                            lockManager.lockIfEnabled()
                        }
                        .transition(.opacity)

                } else {
                    LoginView(authSession: authSession)
                        .transition(.opacity)
                }

                // Face ID lock screen — only shown when already authenticated
                if authSession.isAuthenticated && lockManager.isLocked {
                    LockScreenView(lockManager: lockManager)
                        .zIndex(2)
                        .transition(.opacity)
                        .onAppear { Task { await lockManager.authenticate() } }
                }

                // App-switcher privacy overlay — hides patient data in task switcher
                if isInBackground {
                    appSwitcherOverlay
                        .zIndex(3)
                }
            }
            .animation(.easeInOut(duration: 0.3), value: authSession.isAuthenticated)
            .animation(.easeInOut(duration: 0.3), value: authSession.isLoading)
            .task { await authSession.validateOnLaunch() }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.willResignActiveNotification)) { _ in
                isInBackground = true
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
                isInBackground = false
            }
            .onReceive(NotificationCenter.default.publisher(for: UIApplication.didEnterBackgroundNotification)) { _ in
                lockManager.lockIfEnabled()
            }
        }
        .modelContainer(AppPersistence.container)
    }

    private var appSwitcherOverlay: some View {
        ZStack {
            Color.moBackground.ignoresSafeArea()
            VStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 20)
                        .fill(LinearGradient(
                            colors: [Color.moTeal, Color.moBlue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 64, height: 64)
                    Image(systemName: "mouth.fill")
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(.white)
                        .padding(12)
                        .frame(width: 64, height: 64)
                }
                HStack(spacing: 0) {
                    Text("MyOrtho")
                        .font(.moTitle2)
                        .foregroundStyle(Color.moTextPrimary)
                    Text(".tech")
                        .font(.moTitle2)
                        .foregroundStyle(Color.moTeal)
                }
            }
        }
    }
}
