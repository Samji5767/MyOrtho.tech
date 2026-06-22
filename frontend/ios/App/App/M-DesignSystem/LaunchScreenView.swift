import SwiftUI

struct LaunchScreenView: View {
    @State private var opacity: Double = 0
    @State private var scale: Double = 0.92

    var body: some View {
        ZStack {
            Color.moBackground.ignoresSafeArea()

            VStack(spacing: 16) {
                ZStack {
                    RoundedRectangle(cornerRadius: 22)
                        .fill(
                            LinearGradient(
                                colors: [Color.moTeal, Color.moBlue],
                                startPoint: .topLeading,
                                endPoint: .bottomTrailing
                            )
                        )
                        .frame(width: 80, height: 80)

                    Image(systemName: "mouth.fill")
                        .resizable()
                        .scaledToFit()
                        .foregroundStyle(.white)
                        .padding(18)
                        .frame(width: 80, height: 80)
                }

                VStack(spacing: 6) {
                    (
                        Text("MyOrtho")
                            .font(.moDisplay)
                            .foregroundStyle(Color.moTextPrimary)
                        + Text(".tech")
                            .font(.moDisplay)
                            .foregroundStyle(Color.moTeal)
                    )

                    Text("From scan to smile.")
                        .font(.moCaption)
                        .foregroundStyle(Color.moTextSecondary)
                        .tracking(1.2)
                        .textCase(.uppercase)
                }
            }
            .scaleEffect(scale)
            .opacity(opacity)
            .onAppear {
                withAnimation(.easeOut(duration: 0.6)) {
                    opacity = 1
                    scale   = 1
                }
            }
        }
    }
}

#Preview {
    LaunchScreenView()
}
