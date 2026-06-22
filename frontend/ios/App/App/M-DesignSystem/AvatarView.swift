import SwiftUI

struct AvatarView: View {
    let initials: String
    let colorSeed: Int
    var size: CGFloat = 40

    private static let palette: [Color] = [
        Color(red: 0.11, green: 0.51, blue: 0.58),
        Color(red: 0.20, green: 0.47, blue: 0.75),
        Color(red: 0.55, green: 0.27, blue: 0.68),
        Color(red: 0.80, green: 0.35, blue: 0.25),
        Color(red: 0.20, green: 0.60, blue: 0.40),
        Color(red: 0.85, green: 0.50, blue: 0.10),
    ]

    private var backgroundColor: Color {
        AvatarView.palette[abs(colorSeed) % AvatarView.palette.count]
    }

    var body: some View {
        ZStack {
            Circle()
                .fill(backgroundColor)
                .frame(width: size, height: size)
            Text(initials)
                .font(.system(size: size * 0.36, weight: .semibold, design: .rounded))
                .foregroundStyle(.white)
        }
        .accessibilityLabel("\(initials) avatar")
    }
}

extension String {
    /// Returns up to 2 uppercase initials from a space-separated full name.
    var initials: String {
        split(separator: " ")
            .prefix(2)
            .compactMap { $0.first.map { String($0).uppercased() } }
            .joined()
    }
}

#Preview {
    HStack(spacing: AppSpacing.md) {
        ForEach(0..<6, id: \.self) { i in
            AvatarView(
                initials: ["SA", "JD", "MK", "RP", "LN", "TW"][i],
                colorSeed: i,
                size: 44
            )
        }
    }
    .padding()
}
