import Foundation

@Observable
@MainActor
final class AuthSession {
    var isAuthenticated = false
    var isLoading       = true
    var currentUser: AuthUser?
    var errorMessage: String?

    func validateOnLaunch() async {
        isLoading = true
        do {
            let user = try await AuthService.shared.fetchSession()
            currentUser     = user
            isAuthenticated = true
        } catch {
            await AuthService.shared.clearToken()
            currentUser     = nil
            isAuthenticated = false
        }
        isLoading = false
    }

    func login(email: String, password: String) async {
        errorMessage = nil
        isLoading    = true
        do {
            let user = try await AuthService.shared.login(email: email, password: password)
            currentUser     = user
            isAuthenticated = true
        } catch let err as AuthError {
            errorMessage    = err.errorDescription
            isAuthenticated = false
        } catch {
            errorMessage    = "Network error — check your connection and try again."
            isAuthenticated = false
        }
        isLoading = false
    }

    func logout() async {
        isLoading = true
        await AuthService.shared.logout()
        currentUser     = nil
        isAuthenticated = false
        errorMessage    = nil
        isLoading       = false
    }
}
