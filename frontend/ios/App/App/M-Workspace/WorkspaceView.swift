import SwiftUI
import SceneKit
import UniformTypeIdentifiers

// MARK: - Workspace root

struct WorkspaceView: View {
    @State private var viewModel      = WorkspaceViewModel()
    @State private var showFilePicker = false
    @Environment(AppNavigation.self) private var navigation

    private let allowedTypes: [UTType] = [
        UTType(filenameExtension: "stl") ?? .data,
        UTType(filenameExtension: "obj") ?? .data
    ]

    var body: some View {
        ZStack {
            Color(hex: "#0A0C10").ignoresSafeArea()

            switch viewModel.loadState {
            case .idle:
                MOEmptyState(
                    icon: "waveform.path.ecg",
                    title: "Open a Scan",
                    subtitle: "Upload an STL file from the Scans tab or tap below.",
                    actionLabel: "Upload STL",
                    action: { showFilePicker = true }
                )

            case .loading:
                VStack(spacing: 16) {
                    ProgressView()
                        .progressViewStyle(.circular)
                        .tint(Color(hex: "#00D4C2"))
                        .scaleEffect(1.4)
                    Text("Loading \(viewModel.currentFileName)…")
                        .font(.moBody)
                        .foregroundStyle(Color(hex: "#8B95A8"))
                    Text("Large scans may take a moment")
                        .font(.moCaption)
                        .foregroundStyle(Color(hex: "#4B5563"))
                }

            case .loaded:
                if let scene = viewModel.scene {
                    ZStack(alignment: .top) {
                        SceneView(
                            scene: scene,
                            options: [
                                .allowsCameraControl,
                                .autoenablesDefaultLighting,
                                .temporalAntialiasingEnabled
                            ]
                        )
                        .frame(maxWidth: .infinity, maxHeight: .infinity)
                        .ignoresSafeArea()

                        if viewModel.wasDecimated {
                            HStack(spacing: 6) {
                                Image(systemName: "info.circle.fill")
                                    .font(.moCaption)
                                Text("Optimised: showing 150k of \(viewModel.originalTriangles.formatted()) triangles")
                                    .font(.moCaption)
                            }
                            .foregroundStyle(Color(hex: "#F1F5F9"))
                            .padding(.horizontal, 14)
                            .padding(.vertical, 8)
                            .background(.ultraThinMaterial)
                            .clipShape(Capsule())
                            .padding(.top, 12)
                        }
                    }
                }

            case .failed(let message):
                VStack(spacing: 20) {
                    Image(systemName: "exclamationmark.triangle.fill")
                        .font(.system(size: 40))
                        .foregroundStyle(Color(hex: "#EF4444"))
                    Text("Could Not Load Scan")
                        .font(.moTitle2)
                        .foregroundStyle(Color(hex: "#F1F5F9"))
                    Text(message)
                        .font(.moBody)
                        .foregroundStyle(Color(hex: "#8B95A8"))
                        .multilineTextAlignment(.center)
                    Button("Try Again") { viewModel.loadState = .idle }
                        .buttonStyle(.bordered)
                        .tint(Color(hex: "#00D4C2"))
                }
                .padding(40)
            }
        }
        .navigationTitle(viewModel.loadState == .loaded ? viewModel.currentFileName : "Workspace")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    showFilePicker = true
                } label: {
                    Image(systemName: "square.and.arrow.up")
                        .tint(Color(hex: "#00D4C2"))
                }
            }
        }
        .fileImporter(
            isPresented: $showFilePicker,
            allowedContentTypes: allowedTypes,
            allowsMultipleSelection: false,
            onCompletion: importFile
        )
        .onChange(of: navigation.workspaceURLToLoad) { _, url in
            guard let url else { return }
            navigation.workspaceURLToLoad = nil
            viewModel.load(url: url)
        }
    }

    // MARK: - File import (security-scoped, copies to container)

    private func importFile(_ result: Result<[URL], Error>) {
        guard case .success(let urls) = result,
              let source = urls.first else { return }

        guard source.startAccessingSecurityScopedResource() else {
            viewModel.loadState = .failed("Could not access the selected file.")
            return
        }
        defer { source.stopAccessingSecurityScopedResource() }

        do {
            let scansDir = FileManager.default
                .urls(for: .documentDirectory, in: .userDomainMask)[0]
                .appendingPathComponent("Scans", isDirectory: true)

            try FileManager.default.createDirectory(
                at: scansDir,
                withIntermediateDirectories: true
            )

            let dest = scansDir.appendingPathComponent(source.lastPathComponent)
            if FileManager.default.fileExists(atPath: dest.path) {
                try FileManager.default.removeItem(at: dest)
            }
            try FileManager.default.copyItem(at: source, to: dest)

            viewModel.load(url: dest)
        } catch {
            viewModel.loadState = .failed("Could not copy file: \(error.localizedDescription)")
        }
    }
}

// MARK: - Preview

#Preview {
    NavigationStack { WorkspaceView() }
        .environment(AppNavigation())
}
