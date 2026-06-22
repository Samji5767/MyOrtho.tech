import SwiftUI

struct PlaceholderSectionView: View {
    let title: String
    let systemImage: String
    let message: String
    var tierNote: String? = nil

    var body: some View {
        VStack(spacing: AppSpacing.lg) {
            Image(systemName: systemImage)
                .font(.system(size: 56, weight: .thin))
                .foregroundStyle(AppColor.textSecondary)

            VStack(spacing: AppSpacing.sm) {
                Text(title)
                    .font(AppFont.headline())
                    .foregroundStyle(AppColor.textPrimary)

                Text(message)
                    .font(AppFont.subheadline())
                    .foregroundStyle(AppColor.textSecondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, AppSpacing.xxl)

                if let tierNote {
                    Text(tierNote)
                        .font(AppFont.caption())
                        .fontWeight(.semibold)
                        .padding(.horizontal, AppSpacing.sm)
                        .padding(.vertical, AppSpacing.xxs)
                        .background(AppColor.accentLight)
                        .foregroundStyle(AppColor.accent)
                        .clipShape(Capsule())
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(AppColor.groupedBackground)
    }
}

#Preview {
    PlaceholderSectionView(
        title: "Schedule",
        systemImage: "calendar",
        message: "Appointments and aligner-change reminders will appear here."
    )
}
