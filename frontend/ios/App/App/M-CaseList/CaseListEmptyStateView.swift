import SwiftUI

struct CaseListEmptyStateView: View {
    let onNewCase: () -> Void

    var body: some View {
        MOEmptyState(
            icon: "folder.badge.plus",
            title: "No Cases Yet",
            subtitle: "Start by creating your first patient case.",
            actionLabel: "New Case",
            action: onNewCase
        )
    }
}

#Preview {
    CaseListEmptyStateView(onNewCase: {})
}
