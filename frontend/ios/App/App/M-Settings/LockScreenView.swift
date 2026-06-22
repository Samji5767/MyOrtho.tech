import SwiftUI

struct LockScreenView: View {
    let lockManager: AppLockManager

    var body: some View {
        ZStack {
            Color.moBackground.ignoresSafeArea()

            VStack(spacing: 32) {
                ZStack {
                    RoundedRectangle(cornerRadius: 24)
                        .fill(LinearGradient(
                            colors: [Color.moTeal, Color.moBlue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        ))
                        .frame(width: 80, height: 80)
                    Image(systemName: "mouth.fill")
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(.white)
                        .padding(16)
                        .frame(width: 80, height: 80)
                }

                VStack(spacing: 6) {
                    HStack(spacing: 0) {
                        Text("MyOrtho")
                            .font(.moTitle)
                            .foregroundStyle(Color.moTextPrimary)
                        Text(".tech")
                            .font(.moTitle)
                            .foregroundStyle(Color.moTeal)
                    }
                    Text("Locked")
                        .font(.moBody)
                        .foregroundStyle(Color.moTextSecondary)
                }

                Button {
                    Task { await lockManager.authenticate() }
                } label: {
                    Label("Unlock with Face ID", systemImage: "faceid")
                        .font(.moBodyMedium)
                        .foregroundStyle(.black)
                        .padding(.horizontal, 28)
                        .padding(.vertical, 14)
                        .background(Color.moTeal)
                        .clipShape(Capsule())
                }
            }
        }
    }
}
