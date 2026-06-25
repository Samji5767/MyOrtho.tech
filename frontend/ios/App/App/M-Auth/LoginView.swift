import SwiftUI

struct LoginView: View {
    let authSession: AuthSession

    @State private var email       = ""
    @State private var password    = ""
    @State private var showPwd     = false
    @State private var showAppInfo = false
    @FocusState private var focused: Field?

    private enum Field { case email, password }

    private let haptic = UINotificationFeedbackGenerator()

    var body: some View {
        ScrollView {
            VStack(spacing: 0) {
                Spacer(minLength: 60)
                logoBlock
                Spacer(minLength: 40)
                card
                Spacer(minLength: 32)
                footer
                Spacer(minLength: 32)
            }
            .padding(.horizontal, 24)
            .frame(maxWidth: 460)
            .frame(maxWidth: .infinity)
        }
        .background(Color.moBackground.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        .sheet(isPresented: $showAppInfo) { appInfoSheet }
        .onChange(of: authSession.errorMessage) { _, msg in
            if msg != nil { haptic.notificationOccurred(.error) }
        }
    }

    // MARK: - App info sheet (App Store reviewer context)

    private var appInfoSheet: some View {
        NavigationStack {
            List {
                Section("About MyOrtho.tech") {
                    Text("MyOrtho.tech is an orthodontic practice management system. It provides patient case management, 3D dental scan viewing, treatment planning workflows, and manufacturing tracking.")
                        .font(.moBody)
                        .foregroundStyle(Color.moTextSecondary)
                        .listRowBackground(Color.moSurface)
                }
                Section("App Store Review") {
                    VStack(alignment: .leading, spacing: 8) {
                        Text("Demo credentials are provided in the App Review Notes section of App Store Connect.")
                            .font(.moBody)
                            .foregroundStyle(Color.moTextSecondary)
                        Text("The app includes pre-populated demo cases (fictional patient data) visible after login.")
                            .font(.moCaption)
                            .foregroundStyle(Color.moTextTertiary)
                    }
                    .listRowBackground(Color.moSurface)
                }
                Section("Features") {
                    Label("Patient case management", systemImage: "tray.full")
                    Label("3D scan viewer (STL)", systemImage: "cube")
                    Label("Treatment workflow timeline", systemImage: "list.clipboard")
                    Label("Manufacturing job tracker", systemImage: "gearshape.2")
                    Label("Clinical AI analysis (demo)", systemImage: "waveform.path.ecg")
                }
                .foregroundStyle(Color.moTextSecondary)
                .font(.moBody)
                .listRowBackground(Color.moSurface)

                Section {
                    Text("Clinical AI features use simulated data for demonstration purposes only. Not for diagnostic use.")
                        .font(.moCaption)
                        .foregroundStyle(Color.moTextTertiary)
                        .listRowBackground(Color.moSurface)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color.moBackground)
            .navigationTitle("About the App")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Done") { showAppInfo = false }
                        .foregroundStyle(Color.moTeal)
                }
            }
        }
    }

    // MARK: - Logo

    private var logoBlock: some View {
        VStack(spacing: 14) {
            ZStack {
                RoundedRectangle(cornerRadius: 22)
                    .fill(LinearGradient(
                        colors: [Color.moTeal, Color.moBlue],
                        startPoint: .topLeading,
                        endPoint: .bottomTrailing
                    ))
                    .frame(width: 72, height: 72)
                    .shadow(color: Color.moTeal.opacity(0.35), radius: 16, y: 6)
                Image(systemName: "mouth.fill")
                    .resizable()
                    .scaledToFit()
                    .foregroundStyle(.white)
                    .padding(14)
                    .frame(width: 72, height: 72)
            }
            VStack(spacing: 2) {
                Text("MY ORTHO")
                    .font(.system(size: 10, weight: .semibold))
                    .tracking(4)
                    .foregroundStyle(Color.moTextSecondary)
                Text("Clinical Workspace")
                    .font(.moTitle2)
                    .foregroundStyle(Color.moTextPrimary)
            }
        }
    }

    // MARK: - Card

    private var card: some View {
        VStack(spacing: 20) {
            VStack(alignment: .leading, spacing: 4) {
                Text("Sign in to your account")
                    .font(.moBodyMedium)
                    .foregroundStyle(Color.moTextPrimary)
                Text("Enter your credentials to access the platform.")
                    .font(.moCaption)
                    .foregroundStyle(Color.moTextSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            if let msg = authSession.errorMessage {
                HStack(alignment: .top, spacing: 8) {
                    Image(systemName: "exclamationmark.circle.fill")
                        .foregroundStyle(.red)
                        .padding(.top, 1)
                    Text(msg)
                        .font(.moCaption)
                        .foregroundStyle(.red)
                }
                .padding(12)
                .frame(maxWidth: .infinity, alignment: .leading)
                .background(Color.red.opacity(0.08))
                .clipShape(RoundedRectangle(cornerRadius: 10))
            }

            emailField
            passwordField
            signInButton
        }
        .padding(24)
        .background(Color(.secondarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 20))
        .shadow(color: .black.opacity(0.06), radius: 16, y: 4)
    }

    private var emailField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Email address")
                .font(.moCaption)
                .fontWeight(.semibold)
                .foregroundStyle(Color.moTextPrimary)
            HStack(spacing: 10) {
                Image(systemName: "envelope")
                    .foregroundStyle(Color.moTextSecondary)
                    .frame(width: 18)
                TextField("you@clinic.com", text: $email)
                    .keyboardType(.emailAddress)
                    .textContentType(.emailAddress)
                    .autocapitalization(.none)
                    .autocorrectionDisabled()
                    .focused($focused, equals: .email)
                    .submitLabel(.next)
                    .onSubmit { focused = .password }
                    .disabled(authSession.isLoading)
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color.moBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12).stroke(
                    focused == .email ? Color.moTeal : Color.moTextTertiary.opacity(0.4),
                    lineWidth: focused == .email ? 1.5 : 1
                )
            )
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Password")
                .font(.moCaption)
                .fontWeight(.semibold)
                .foregroundStyle(Color.moTextPrimary)
            HStack(spacing: 10) {
                Image(systemName: "lock")
                    .foregroundStyle(Color.moTextSecondary)
                    .frame(width: 18)
                Group {
                    if showPwd {
                        TextField("••••••••", text: $password)
                    } else {
                        SecureField("••••••••", text: $password)
                    }
                }
                .textContentType(.password)
                .focused($focused, equals: .password)
                .submitLabel(.go)
                .onSubmit { submitIfReady() }
                .disabled(authSession.isLoading)

                Button { showPwd.toggle() } label: {
                    Image(systemName: showPwd ? "eye.slash" : "eye")
                        .foregroundStyle(Color.moTextSecondary)
                }
                .buttonStyle(.plain)
            }
            .padding(.horizontal, 14)
            .frame(height: 48)
            .background(Color.moBackground)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12).stroke(
                    focused == .password ? Color.moTeal : Color.moTextTertiary.opacity(0.4),
                    lineWidth: focused == .password ? 1.5 : 1
                )
            )
        }
    }

    private var signInButton: some View {
        Button { submitIfReady() } label: {
            ZStack {
                if authSession.isLoading {
                    ProgressView().tint(.white)
                } else {
                    Text("Sign In").font(.moBodyMedium)
                }
            }
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .background(canSubmit ? Color.moTeal : Color.moTextTertiary)
            .foregroundStyle(.white)
            .clipShape(RoundedRectangle(cornerRadius: 14))
        }
        .disabled(!canSubmit || authSession.isLoading)
        .animation(.easeInOut(duration: 0.15), value: authSession.isLoading)
    }

    // MARK: - Footer

    private var footer: some View {
        VStack(spacing: 8) {
            Text("Need access? Contact your administrator")
                .font(.moCaption)
                .foregroundStyle(Color.moTextSecondary)
            Button {
                showAppInfo = true
            } label: {
                HStack(spacing: 4) {
                    Image(systemName: "info.circle")
                        .font(.system(size: 11))
                    Text("About this App")
                        .font(.system(size: 11))
                }
                .foregroundStyle(Color.moTextTertiary)
            }
            .buttonStyle(.plain)
        }
    }

    // MARK: - Helpers

    private var canSubmit: Bool {
        !email.trimmingCharacters(in: .whitespaces).isEmpty && !password.isEmpty
    }

    private func submitIfReady() {
        guard canSubmit, !authSession.isLoading else { return }
        focused = nil
        Task { await authSession.login(
            email: email.trimmingCharacters(in: .whitespaces),
            password: password
        )}
    }
}
