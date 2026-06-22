import SwiftUI

// MARK: - Font.moXxx tokens (canonical design system)

extension Font {
    static var moDisplay: Font    { .system(size: 32, weight: .bold,     design: .rounded) }
    static var moTitle: Font      { .system(size: 24, weight: .bold,     design: .rounded) }
    static var moTitle2: Font     { .system(size: 20, weight: .semibold, design: .rounded) }
    static var moHeadline: Font   { .system(size: 17, weight: .semibold, design: .default) }
    static var moBody: Font       { .system(size: 15, weight: .regular,  design: .default) }
    static var moBodyMedium: Font { .system(size: 15, weight: .medium,   design: .default) }
    static var moCaption: Font    { .system(size: 13, weight: .regular,  design: .default) }
    static var moCaption2: Font   { .system(size: 11, weight: .medium,   design: .default) }
    static var moMono: Font       { .system(size: 13, weight: .medium,   design: .monospaced) }
}

// MARK: - AppFont (legacy wrappers — prefer Font.moXxx in new code)

enum AppFont {
    static func largeTitle()  -> Font { .largeTitle.weight(.bold) }
    static func title1()      -> Font { .title.weight(.semibold) }
    static func title2()      -> Font { .title2.weight(.semibold) }
    static func title3()      -> Font { .title3.weight(.semibold) }
    static func headline()    -> Font { .headline }
    static func body()        -> Font { .body }
    static func callout()     -> Font { .callout }
    static func subheadline() -> Font { .subheadline }
    static func footnote()    -> Font { .footnote }
    static func caption()     -> Font { .caption }
    static func caption2()    -> Font { .caption2 }
}

// MARK: - Bundle helpers

extension Bundle {
    var appVersion: String {
        let version = infoDictionary?["CFBundleShortVersionString"] as? String ?? "1.0"
        let build   = infoDictionary?["CFBundleVersion"] as? String ?? "1"
        return "\(version) (\(build))"
    }
}
