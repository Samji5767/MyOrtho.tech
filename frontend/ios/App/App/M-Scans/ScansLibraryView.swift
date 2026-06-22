import SwiftUI
import UniformTypeIdentifiers

// MARK: - Models

struct ScanEntry: Identifiable, Codable {
    let id: UUID
    var filename: String
    var importDate: Date
    var triangleCount: Int
    var note: String?

    init(filename: String, importDate: Date, triangleCount: Int, note: String?) {
        self.id            = UUID()
        self.filename      = filename
        self.importDate    = importDate
        self.triangleCount = triangleCount
        self.note          = note
    }
}

struct ScanSidecar: Codable {
    var note: String
}

// MARK: - Library

struct ScansLibraryView: View {
    @State private var scans:        [ScanEntry] = []
    @State private var showImporter: Bool        = false
    @State private var importError:  String?     = nil
    @State private var isImporting:  Bool        = false

    private let scansDir = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Scans")

    var body: some View {
        Group {
            if scans.isEmpty {
                emptyState
            } else {
                list
            }
        }
        .navigationTitle("Scans")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                if isImporting {
                    ProgressView().controlSize(.small)
                } else {
                    Button { showImporter = true } label: {
                        Image(systemName: "plus")
                            .accessibilityLabel("Import scan")
                    }
                }
            }
        }
        .fileImporter(
            isPresented: $showImporter,
            allowedContentTypes: [
                UTType(filenameExtension: "stl") ?? .data,
                UTType(filenameExtension: "obj") ?? .data
            ],
            allowsMultipleSelection: false
        ) { result in
            handleImport(result: result)
        }
        .alert("Import Error", isPresented: Binding(
            get: { importError != nil },
            set: { if !$0 { importError = nil } }
        )) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(importError ?? "")
        }
        .task { loadLibrary() }
    }

    // MARK: Empty state

    private var emptyState: some View {
        MOEmptyState(
            icon: "cube.transparent",
            title: "No Scans Yet",
            subtitle: "Upload an STL file to begin.",
            actionLabel: "Upload Scan",
            action: { showImporter = true }
        )
    }

    // MARK: List

    private var list: some View {
        List {
            ForEach(scans) { scan in
                NavigationLink {
                    ScanViewerView(scan: scan, scans: $scans)
                } label: {
                    rowView(scan)
                }
                .listRowBackground(AppColor.background)
                .listRowSeparatorTint(AppColor.divider)
            }
            .onDelete(perform: deleteScan)
        }
        .listStyle(.plain)
        .scrollContentBackground(.hidden)
        .background(AppColor.background)
    }

    private func rowView(_ scan: ScanEntry) -> some View {
        VStack(alignment: .leading, spacing: 4) {
            Text(scan.filename)
                .font(.moBody)
                .foregroundStyle(AppColor.textPrimary)
                .lineLimit(1)
            HStack(spacing: 8) {
                Text(scan.importDate.formatted(date: .abbreviated, time: .shortened))
                    .font(.moCaption)
                    .foregroundStyle(AppColor.textSecondary)
                if scan.triangleCount > 0 {
                    Text("·")
                        .foregroundStyle(AppColor.textTertiary)
                    Text("\(scan.triangleCount.formatted()) triangles")
                        .font(.moCaption)
                        .foregroundStyle(AppColor.textSecondary)
                }
            }
        }
        .padding(.vertical, 4)
    }

    // MARK: Import

    private func handleImport(result: Result<[URL], Error>) {
        switch result {
        case .failure(let error):
            importError = error.localizedDescription
        case .success(let urls):
            guard let source = urls.first else { return }
            isImporting = true
            Task.detached(priority: .userInitiated) {
                do {
                    let entry = try await copyAndParse(source: source)
                    await MainActor.run {
                        scans.insert(entry, at: 0)
                        saveLibrary()
                        isImporting = false
                    }
                } catch {
                    await MainActor.run {
                        importError = error.localizedDescription
                        isImporting = false
                    }
                }
            }
        }
    }

    private func copyAndParse(source: URL) async throws -> ScanEntry {
        let fm = FileManager.default
        try fm.createDirectory(at: scansDir, withIntermediateDirectories: true)

        let destName = source.lastPathComponent
        let dest     = scansDir.appendingPathComponent(destName)

        let accessed = source.startAccessingSecurityScopedResource()
        defer { if accessed { source.stopAccessingSecurityScopedResource() } }

        if fm.fileExists(atPath: dest.path) {
            try fm.removeItem(at: dest)
        }
        try fm.copyItem(at: source, to: dest)

        let loader = STLLoader()
        let result = try await loader.load(from: dest)
        // Store original (pre-decimation) triangle count for display
        let triangleCount = result.originalTriangles
        return ScanEntry(filename: destName,
                         importDate: .now,
                         triangleCount: triangleCount,
                         note: nil)
    }

    // MARK: Delete

    private func deleteScan(at offsets: IndexSet) {
        let fm = FileManager.default
        for idx in offsets {
            let scan     = scans[idx]
            let file     = scansDir.appendingPathComponent(scan.filename)
            let sidecar  = scansDir.appendingPathComponent(scan.filename + ".json")
            try? fm.removeItem(at: file)
            try? fm.removeItem(at: sidecar)
        }
        scans.remove(atOffsets: offsets)
        saveLibrary()
    }

    // MARK: Persistence (lightweight JSON index — no SwiftData)

    private var indexURL: URL {
        scansDir.appendingPathComponent("scans_index.json")
    }

    private func loadLibrary() {
        guard let data = try? Data(contentsOf: indexURL),
              let entries = try? JSONDecoder().decode([ScanEntry].self, from: data)
        else { return }
        scans = entries.map { entry in
            var e = entry
            let sidecar = scansDir.appendingPathComponent(entry.filename + ".json")
            if let sd = try? Data(contentsOf: sidecar),
               let s  = try? JSONDecoder().decode(ScanSidecar.self, from: sd) {
                e.note = s.note
            }
            return e
        }
    }

    private func saveLibrary() {
        let data = try? JSONEncoder().encode(scans)
        try? data?.write(to: indexURL, options: .atomic)
    }
}

// MARK: - Preview

#Preview {
    NavigationStack {
        ScansLibraryView()
    }
}
