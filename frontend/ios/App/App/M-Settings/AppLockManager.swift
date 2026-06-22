import Foundation
import LocalAuthentication

@Observable
final class AppLockManager {
    var isLocked: Bool = false
    var isEnabled: Bool {
        didSet { UserDefaults.standard.set(isEnabled, forKey: "mo_appLockEnabled") }
    }

    init() {
        self.isEnabled = UserDefaults.standard.bool(forKey: "mo_appLockEnabled")
    }

    func lockIfEnabled() {
        if isEnabled { isLocked = true }
    }

    func authenticate() async {
        let context = LAContext()
        var error: NSError?
        guard context.canEvaluatePolicy(.deviceOwnerAuthenticationWithBiometrics, error: &error) else {
            // No biometrics available — unlock gracefully (simulator, devices without Face ID)
            await MainActor.run { isLocked = false }
            return
        }
        do {
            let success = try await context.evaluatePolicy(
                .deviceOwnerAuthentication,
                localizedReason: "Unlock MyOrtho.tech to access patient data"
            )
            await MainActor.run { isLocked = !success }
        } catch {
            await MainActor.run { isLocked = true }
        }
    }
}
