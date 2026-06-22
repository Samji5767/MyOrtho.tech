import Foundation

// MARK: - Currency

enum Currency: String, CaseIterable, Codable {
    case inr = "INR"
    case usd = "USD"

    var currencyCode: String { rawValue }

    var displayName: String {
        switch self {
        case .inr: return "INR — Indian Rupee"
        case .usd: return "USD — US Dollar"
        }
    }
}

// MARK: - AppConfig

@Observable
final class AppConfig {
    var practiceName: String {
        didSet { UserDefaults.standard.set(practiceName, forKey: "cfg_practiceName") }
    }

    var currency: Currency {
        didSet { UserDefaults.standard.set(currency.rawValue, forKey: "cfg_currency") }
    }

    func formatted(amount: Decimal) -> String {
        let fmt = NumberFormatter()
        fmt.numberStyle = .currency
        fmt.currencyCode = currency.currencyCode
        fmt.maximumFractionDigits = 0
        fmt.minimumFractionDigits = 0
        return fmt.string(from: amount as NSDecimalNumber) ?? "\(currency.currencyCode) \(amount)"
    }

    init() {
        self.practiceName = UserDefaults.standard.string(forKey: "cfg_practiceName") ?? "MyOrtho Clinic"
        let code = UserDefaults.standard.string(forKey: "cfg_currency") ?? "INR"
        self.currency = Currency(rawValue: code) ?? .inr
    }
}
