import SwiftUI

// MARK: - Color.moXxx tokens (canonical design system)

extension Color {
    // Backgrounds
    static var moBackground: Color      { Color(hex: "#0A0C10") }
    static var moSurface: Color         { Color(hex: "#12151B") }
    static var moSurfaceElevated: Color { Color(hex: "#1A1E27") }
    static var moSurfaceBorder: Color   { Color(hex: "#252A35") }

    // Brand
    static var moTeal: Color    { Color(hex: "#00D4C2") }
    static var moTealDim: Color { Color(hex: "#00D4C2").opacity(0.15) }
    static var moBlue: Color    { Color(hex: "#3B8BFF") }
    static var moBlueDim: Color { Color(hex: "#3B8BFF").opacity(0.15) }

    // Semantic states
    static var moApproved: Color      { Color(hex: "#22C55E") }
    static var moPending: Color       { Color(hex: "#F59E0B") }
    static var moRejected: Color      { Color(hex: "#EF4444") }
    static var moManufacturing: Color { Color(hex: "#A855F7") }
    static var moSegmentation: Color  { Color(hex: "#06B6D4") }

    // Text
    static var moTextPrimary: Color   { Color(hex: "#F1F5F9") }
    static var moTextSecondary: Color { Color(hex: "#8B95A8") }
    static var moTextTertiary: Color  { Color(hex: "#4B5563") }

    init(hex: String) {
        let hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        let r = Double((int >> 16) & 0xFF) / 255
        let g = Double((int >>  8) & 0xFF) / 255
        let b = Double(int         & 0xFF) / 255
        self.init(red: r, green: g, blue: b)
    }
}

// MARK: - AppColor (legacy aliases — prefer Color.moXxx in new code)

enum AppColor {
    static let background        = Color.moBackground
    static let surface           = Color.moSurface
    static let surfaceElevated   = Color.moSurfaceElevated
    static let groupedBackground = Color.moBackground

    static let accent          = Color.moTeal
    static let accentSecondary = Color.moBlue
    static let accentLight     = Color.moTealDim

    static let approved      = Color.moApproved
    static let pending       = Color.moPending
    static let rejected      = Color.moRejected
    static let manufacturing = Color.moManufacturing
    static let urgent        = Color.moRejected

    static let textPrimary   = Color.moTextPrimary
    static let textSecondary = Color.moTextSecondary
    static let textTertiary  = Color.moTextTertiary

    static let selfBubble  = Color.moTeal.opacity(0.15)
    static let otherBubble = Color.moSurfaceElevated
    static let divider     = Color.moSurfaceBorder
}
