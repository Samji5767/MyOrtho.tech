import SwiftUI

struct SettingsView: View {
    @Environment(AppConfig.self) private var config
    @Environment(AppLockManager.self) private var lockManager

    var body: some View {
        Form {
            brandSection
            practiceSection
            currencySection
            securitySection
            appSection
        }
        .scrollContentBackground(.hidden)
        .background(Color.moBackground)
        .navigationTitle("Settings")
    }

    // MARK: - Brand header

    private var brandSection: some View {
        Section {
            brandHeader
                .listRowBackground(Color.clear)
        }
        .listSectionSeparator(.hidden)
    }

    private var brandHeader: some View {
        VStack(spacing: 8) {
            ZStack {
                RoundedRectangle(cornerRadius: 16)
                    .fill(
                        LinearGradient(
                            colors: [Color.moTeal, Color.moBlue],
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 60, height: 60)
                Image(systemName: "mouth.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.white)
                    .padding(14)
                    .frame(width: 60, height: 60)
            }

            HStack(spacing: 0) {
                Text("MyOrtho")
                    .font(.moTitle2)
                    .foregroundStyle(Color.moTextPrimary)
                Text(".tech")
                    .font(.moTitle2)
                    .foregroundStyle(Color.moTeal)
            }

            Text("Version \(Bundle.main.appVersion)")
                .font(.moCaption)
                .foregroundStyle(Color.moTextTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 24)
    }

    // MARK: - Settings sections

    @ViewBuilder
    private var practiceSection: some View {
        @Bindable var config = config
        Section("Practice") {
            LabeledContent("Practice Name") {
                TextField("e.g. SmileCare Orthodontics", text: $config.practiceName)
                    .multilineTextAlignment(.trailing)
            }
        }
    }

    @ViewBuilder
    private var currencySection: some View {
        @Bindable var config = config
        Section("Currency") {
            Picker("Practice Currency", selection: $config.currency) {
                ForEach(Currency.allCases, id: \.self) { c in
                    Text(c.displayName).tag(c)
                }
            }
        }
    }

    @ViewBuilder
    private var securitySection: some View {
        @Bindable var lockManager = lockManager
        Section("Security") {
            Toggle("App Lock (Face ID / Passcode)", isOn: $lockManager.isEnabled)
                .tint(Color.moTeal)
            if lockManager.isEnabled {
                Text("MyOrtho.tech will lock when it goes to the background.")
                    .font(.moCaption)
                    .foregroundStyle(Color.moTextSecondary)
            }
        }
    }

    private var appSection: some View {
        Section("About") {
            LabeledContent("Contact", value: "hello@myortho.tech")
        }
    }
}

#Preview {
    NavigationStack { SettingsView() }
        .environment(AppConfig())
        .environment(AppLockManager())
}
