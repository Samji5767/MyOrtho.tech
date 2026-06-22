import UIKit

// Lifecycle delegate retained for future push-notification and deep-link hooks.
// App entry point is MyOrthoApp (@main in MyOrthoApp.swift).
class AppDelegate: UIResponder, UIApplicationDelegate {
    func application(
        _ application: UIApplication,
        didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]?
    ) -> Bool {
        return true
    }
}
