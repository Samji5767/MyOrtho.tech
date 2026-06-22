import Foundation
import SwiftData

enum AppPersistence {
    static let container: ModelContainer = {
        let schema = Schema([ClinicalCase.self, CaseEvent.self])
        let config = ModelConfiguration(schema: schema, isStoredInMemoryOnly: false)
        do {
            return try ModelContainer(for: schema, configurations: [config])
        } catch {
            // Schema changed incompatibly (early build, no real patient data).
            // Wipe the store and recreate with a clean slate.
            let storeURL = config.url
            let fm = FileManager.default
            try? fm.removeItem(at: storeURL)
            try? fm.removeItem(at: storeURL.appendingPathExtension("shm"))
            try? fm.removeItem(at: storeURL.appendingPathExtension("wal"))
            do {
                return try ModelContainer(for: schema, configurations: [config])
            } catch {
                fatalError("ModelContainer creation failed after store wipe: \(error)")
            }
        }
    }()
}
