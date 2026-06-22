import Foundation
import os

enum Log {
    private static let subsystem = Bundle.main.bundleIdentifier ?? "tech.myortho"

    static func info(_ message: String, category: String = "App") {
        Logger(subsystem: subsystem, category: category).info("\(message, privacy: .public)")
    }

    static func error(_ message: String, category: String = "App") {
        Logger(subsystem: subsystem, category: category).error("\(message, privacy: .public)")
    }

    static func debug(_ message: String, category: String = "App") {
        Logger(subsystem: subsystem, category: category).debug("\(message, privacy: .public)")
    }
}
