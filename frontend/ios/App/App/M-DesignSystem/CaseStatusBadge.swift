import SwiftUI

struct CaseStatusBadge: View {
    let status: CaseStatus

    private var color: Color {
        switch status {
        case .active:    return AppColor.approved
        case .onHold:    return AppColor.pending
        case .completed: return AppColor.manufacturing
        }
    }

    var body: some View {
        Text(status.rawValue)
            .font(AppFont.caption())
            .fontWeight(.semibold)
            .padding(.horizontal, AppSpacing.sm)
            .padding(.vertical, AppSpacing.xxs)
            .background(color.opacity(0.15))
            .foregroundStyle(color)
            .clipShape(Capsule())
    }
}

#Preview {
    HStack(spacing: AppSpacing.sm) {
        CaseStatusBadge(status: .active)
        CaseStatusBadge(status: .onHold)
        CaseStatusBadge(status: .completed)
    }
    .padding()
}
