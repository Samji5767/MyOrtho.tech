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
            async let jobsRes: APIPrintJobsResponse  = MyOrthoAPIClient.shared.get("/api/manufacturing/jobs")
            async let printersRes: APIPrintersResponse = MyOrthoAPIClient.shared.get("/api/manufacturing/printers")
            let (j, p) = try await (jobsRes, printersRes)
            jobs     = j.jobs
            printers = p.printers
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
