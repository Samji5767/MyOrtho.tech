import Foundation

// MARK: - Decimal rounding

extension Decimal {
    /// Round to `scale` decimal places using the specified mode.
    func rounded(scale: Int, mode: NSDecimalNumber.RoundingMode = .bankers) -> Decimal {
        var result = Decimal()
        var copy   = self
        NSDecimalRound(&result, &copy, scale, mode)
        return result
    }

    /// Convert a Double to Decimal without going through string representation.
    /// Uses NSDecimalNumber to preserve the value as entered; never applies
    /// floating-point arithmetic to money amounts.
    init(money double: Double) {
        self = NSDecimalNumber(value: double).decimalValue
    }
}

// MARK: - NumberFormatter for Decimal amounts

extension NumberFormatter {
    /// A formatter suitable for displaying a Decimal as a currency amount.
    static func currencyFormatter(code: String, fractionDigits: Int? = nil) -> NumberFormatter {
        let f = NumberFormatter()
        f.numberStyle = .currency
        f.currencyCode = code
        if let fd = fractionDigits {
            f.minimumFractionDigits = fd
            f.maximumFractionDigits = fd
        }
        return f
    }
}
