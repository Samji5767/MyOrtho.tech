import Foundation

@Observable
@MainActor
final class LiveCasesViewModel {
    var cases: [APICaseListItem] = []
    var state: LiveLoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            let result: [APICaseListItem] = try await MyOrthoAPIClient.shared.get("/api/cases")
            cases = result
            state = .loaded
        } catch let err as APIClientError {
            switch err {
            case .notAuthenticated:
                state = .error("Not signed in.")
            default:
                state = .offline(err.localizedDescription ?? "Could not reach server.")
            }
        } catch {
            let msg = (error as? URLError)?.localizedDescription ?? error.localizedDescription
            state = .offline(msg)
        }
    }

    func refresh() async {
        state = .idle
        await load()
    }
}
