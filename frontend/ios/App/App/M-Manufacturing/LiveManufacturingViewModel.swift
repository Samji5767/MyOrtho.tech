import Foundation

@Observable
@MainActor
final class LiveManufacturingViewModel {
    var jobs: [APIPrintJob] = []
    var printers: [APIPrinter] = []
    var state: LiveLoadState = .idle

    func load() async {
        guard state != .loading else { return }
        state = .loading
        do {
            // Backend returns arrays directly (not wrapped)
            async let jobsArr: [APIPrintJob]  = MyOrthoAPIClient.shared.get("/api/manufacturing/jobs")
            async let printersArr: [APIPrinter] = MyOrthoAPIClient.shared.get("/api/printers")
            let (j, p) = try await (jobsArr, printersArr)
            jobs     = j
            printers = p
            state    = .loaded
        } catch let err as APIClientError {
            state = .offline(err.localizedDescription ?? "Could not reach server.")
        } catch {
            let msg = (error as? URLError)?.localizedDescription ?? error.localizedDescription
            state = .offline(msg)
        }
    }

    func refresh() async {
        state = .idle
        await load()
    }

    var inQueue: Int   { jobs.filter { $0.status == "queued" || $0.status == "nesting" }.count }
    var printing: Int  { jobs.filter { $0.status == "printing" }.count }
    var qcPending: Int { jobs.filter { $0.status == "qc_pending" }.count }
}
