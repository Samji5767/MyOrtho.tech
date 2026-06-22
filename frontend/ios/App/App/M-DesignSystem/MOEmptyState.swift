import SwiftUI

struct MOEmptyState: View {
    let icon: String
    let title: String
    let subtitle: String
    let actionLabel: String
    let action: () -> Void

    var body: some View {
        VStack(spacing: 20) {
            ZStack {
                Circle()
                    .fill(Color.moTealDim)
                    .frame(width: 80, height: 80)
                Image(systemName: icon)
                    .font(.system(size: 32, weight: .light))
                    .foregroundStyle(Color.moTeal)
            }

            VStack(spacing: 6) {
                Text(title)
                    .font(.moTitle2)
                    .foregroundStyle(Color.moTextPrimary)
                Text(subtitle)
                    .font(.moBody)
                    .foregroundStyle(Color.moTextSecondary)
                    .multilineTextAlignment(.center)
            }

            Button(action: action) {
                Text(actionLabel)
                    .font(.moBodyMedium)
                    .foregroundStyle(.black)
                    .padding(.horizontal, 24)
                    .padding(.vertical, 12)
                    .background(Color.moTeal)
                    .clipShape(Capsule())
            }
        }
        .padding(40)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.moBackground)
    }
}

#Preview {
    MOEmptyState(
        icon: "folder.badge.plus",
        title: "No Cases Yet",
        subtitle: "Start by creating your first patient case.",
        actionLabel: "New Case",
        action: {}
    )
}
