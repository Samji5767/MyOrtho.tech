import SwiftUI
import SceneKit

// MARK: - Measure state

private enum MeasureState {
    case idle
    case pointA(SCNVector3, SCNNode)
    case complete(a: SCNVector3, b: SCNVector3, line: SCNNode, labelNode: SCNNode, dotA: SCNNode, dotB: SCNNode)
}

// MARK: - SceneKit bridge

struct ScanSceneView: UIViewRepresentable {
    let scene:         SCNScene
    @Binding var wireframe:    Bool
    @Binding var measureMode:  Bool
    @Binding var measureLabel: String?
    var onResetCamera: (() -> Void)?

    func makeCoordinator() -> Coordinator {
        Coordinator(wireframe: wireframe, measureMode: measureMode,
                    measureLabel: $measureLabel)
    }

    func makeUIView(context: Context) -> SCNView {
        let view = SCNView()
        view.scene = scene
        view.allowsCameraControl    = true
        view.autoenablesDefaultLighting = false
        view.backgroundColor        = UIColor(Color.moBackground)
        view.antialiasingMode       = .multisampling4X

        context.coordinator.scnView = view
        setupLighting(scene: scene)

        let tap = UITapGestureRecognizer(
            target: context.coordinator,
            action: #selector(Coordinator.handleTap(_:))
        )
        view.addGestureRecognizer(tap)
        return view
    }

    func updateUIView(_ view: SCNView, context: Context) {
        context.coordinator.wireframe   = wireframe
        context.coordinator.measureMode = measureMode
        applyWireframe(scene: scene, on: wireframe)
    }

    // MARK: Lighting

    private func setupLighting(scene: SCNScene) {
        let ambientLight = SCNLight()
        ambientLight.type      = .ambient
        ambientLight.intensity = 400
        ambientLight.color     = UIColor.white
        let ambient = SCNNode()
        ambient.light = ambientLight
        scene.rootNode.addChildNode(ambient)

        let omniLight = SCNLight()
        omniLight.type      = .omni
        omniLight.intensity = 800
        let omni = SCNNode()
        omni.light    = omniLight
        omni.position = SCNVector3(5, 10, 5)
        scene.rootNode.addChildNode(omni)
    }

    private func applyWireframe(scene: SCNScene, on: Bool) {
        scene.rootNode.enumerateChildNodes { node, _ in
            node.geometry?.firstMaterial?.fillMode = on ? .lines : .fill
        }
    }

    // MARK: Coordinator

    final class Coordinator: NSObject {
        weak var scnView: SCNView?
        var wireframe:   Bool
        var measureMode: Bool
        @Binding var measureLabel: String?
        private var measureState: MeasureState = .idle

        init(wireframe: Bool, measureMode: Bool, measureLabel: Binding<String?>) {
            self.wireframe    = wireframe
            self.measureMode  = measureMode
            self._measureLabel = measureLabel
        }

        @objc func handleTap(_ recognizer: UITapGestureRecognizer) {
            guard measureMode, let view = scnView else { return }
            let location = recognizer.location(in: view)
            let hits = view.hitTest(location, options: [
                .searchMode: SCNHitTestSearchMode.closest.rawValue,
                .ignoreHiddenNodes: true
            ])
            guard let hit = hits.first else { return }
            let worldPoint = hit.worldCoordinates

            switch measureState {
            case .idle:
                let dot = makeDot(at: worldPoint, color: .systemTeal)
                view.scene?.rootNode.addChildNode(dot)
                measureState = .pointA(worldPoint, dot)
                measureLabel = "Tap a second point…"

            case .pointA(let a, let dotA):
                let dotB   = makeDot(at: worldPoint, color: .systemOrange)
                let line   = makeLine(from: a, to: worldPoint)
                let dist   = distance(a, worldPoint)
                let label  = makeLabel(at: midpoint(a, worldPoint),
                                       text: String(format: "%.2f mm", dist))
                view.scene?.rootNode.addChildNode(dotB)
                view.scene?.rootNode.addChildNode(line)
                view.scene?.rootNode.addChildNode(label)
                measureState = .complete(a: a, b: worldPoint, line: line,
                                         labelNode: label, dotA: dotA, dotB: dotB)
                measureLabel = String(format: "%.2f mm", dist)

            case .complete(_, _, let line, let lbl, let dA, let dB):
                [line, lbl, dA, dB].forEach { $0.removeFromParentNode() }
                let dot = makeDot(at: worldPoint, color: .systemTeal)
                view.scene?.rootNode.addChildNode(dot)
                measureState = .pointA(worldPoint, dot)
                measureLabel = "Tap a second point…"
            }
        }

        func clearMeasurements() {
            if case .complete(_, _, let line, let lbl, let dA, let dB) = measureState {
                [line, lbl, dA, dB].forEach { $0.removeFromParentNode() }
            }
            if case .pointA(_, let dot) = measureState {
                dot.removeFromParentNode()
            }
            measureState = .idle
            measureLabel = nil
        }

        // MARK: Geometry helpers

        private func makeDot(at pos: SCNVector3, color: UIColor) -> SCNNode {
            let sphere = SCNSphere(radius: 0.25)
            sphere.firstMaterial?.diffuse.contents  = color
            sphere.firstMaterial?.lightingModel      = .constant
            let node = SCNNode(geometry: sphere)
            node.position = pos
            return node
        }

        private func makeLine(from a: SCNVector3, to b: SCNVector3) -> SCNNode {
            let dx = b.x - a.x; let dy = b.y - a.y; let dz = b.z - a.z
            let len = sqrt(dx*dx + dy*dy + dz*dz)
            let cylinder = SCNCylinder(radius: 0.08, height: CGFloat(len))
            cylinder.firstMaterial?.diffuse.contents = UIColor.systemYellow
            cylinder.firstMaterial?.lightingModel    = .constant

            let node = SCNNode(geometry: cylinder)
            node.position = midpoint(a, b)

            let up    = SCNVector3(0, 1, 0)
            let dir   = SCNVector3(dx/len, dy/len, dz/len)
            let cross = SCNVector3(up.y*dir.z - up.z*dir.y,
                                   up.z*dir.x - up.x*dir.z,
                                   up.x*dir.y - up.y*dir.x)
            let dot   = up.x*dir.x + up.y*dir.y + up.z*dir.z
            if simd_length(simd_float3(cross.x, cross.y, cross.z)) > 0.0001 {
                node.rotation = SCNVector4(cross.x, cross.y, cross.z, acos(dot))
            }
            return node
        }

        private func makeLabel(at pos: SCNVector3, text: String) -> SCNNode {
            let txt = SCNText(string: text, extrusionDepth: 0)
            txt.font                        = UIFont.boldSystemFont(ofSize: 3)
            txt.firstMaterial?.diffuse.contents = UIColor.white
            txt.firstMaterial?.lightingModel    = .constant
            let node = SCNNode(geometry: txt)
            node.position = pos
            node.scale    = SCNVector3(0.3, 0.3, 0.3)
            return node
        }

        private func distance(_ a: SCNVector3, _ b: SCNVector3) -> Float {
            let dx = b.x-a.x; let dy = b.y-a.y; let dz = b.z-a.z
            return sqrt(dx*dx + dy*dy + dz*dz)
        }

        private func midpoint(_ a: SCNVector3, _ b: SCNVector3) -> SCNVector3 {
            SCNVector3((a.x+b.x)/2, (a.y+b.y)/2, (a.z+b.z)/2)
        }
    }
}

// MARK: - Main viewer

struct ScanViewerView: View {
    let scan: ScanEntry

    @State private var scene:        SCNScene?   = nil
    @State private var isLoading:    Bool        = true
    @State private var loadError:    String?     = nil
    @State private var wireframe:    Bool        = false
    @State private var measureMode:  Bool        = false
    @State private var measureLabel: String?     = nil
    @State private var showNotes:    Bool        = false
    @State private var noteText:     String      = ""
    @Binding var scans: [ScanEntry]

    private let scansDir = FileManager.default
        .urls(for: .documentDirectory, in: .userDomainMask)[0]
        .appendingPathComponent("Scans")

    var body: some View {
        ZStack {
            if let scene {
                ScanSceneView(
                    scene: scene,
                    wireframe: $wireframe,
                    measureMode: $measureMode,
                    measureLabel: $measureLabel
                )
                .ignoresSafeArea()

                overlayControls
            } else if let error = loadError {
                VStack(spacing: AppSpacing.lg) {
                    Image(systemName: "exclamationmark.triangle")
                        .font(.system(size: 48, weight: .light))
                        .foregroundStyle(AppColor.rejected)
                    Text("Could Not Load Scan")
                        .font(.moTitle2)
                        .foregroundStyle(AppColor.textPrimary)
                    Text(error)
                        .font(.moBody)
                        .foregroundStyle(AppColor.textSecondary)
                        .multilineTextAlignment(.center)
                        .padding(.horizontal, AppSpacing.xxl)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppColor.background)
            } else {
                VStack(spacing: AppSpacing.base) {
                    ProgressView()
                        .tint(AppColor.accent)
                    Text(scan.triangleCount > 750_000 ? "Large file, loading…" : "Loading scan…")
                        .font(.moBody)
                        .foregroundStyle(AppColor.textSecondary)
                }
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .background(AppColor.background)
            }
        }
        .navigationTitle(scan.filename)
        .navigationBarTitleDisplayMode(.inline)
        .sheet(isPresented: $showNotes) { notesSheet }
        .task { await loadScan() }
    }

    // MARK: Controls overlay

    private var overlayControls: some View {
        VStack {
            Spacer()
            HStack(spacing: 12) {
                toolButton(icon: "arrow.counterclockwise", label: "Reset") {
                    resetCamera()
                }
                toolButton(icon: wireframe ? "square.fill" : "square.dashed",
                           label: wireframe ? "Solid" : "Wire") {
                    wireframe.toggle()
                }
                toolButton(icon: "ruler",
                           label: "Measure",
                           active: measureMode) {
                    measureMode.toggle()
                    if !measureMode { measureLabel = nil }
                }
                toolButton(icon: "note.text", label: "Notes") {
                    noteText = scan.note ?? ""
                    showNotes = true
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 12)
            .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
            .padding(.bottom, 20)

            if let label = measureLabel {
                Text(label)
                    .font(.headline)
                    .padding(.horizontal, 16).padding(.vertical, 8)
                    .background(.ultraThinMaterial, in: Capsule())
                    .padding(.bottom, 8)
            }
        }
    }

    private func toolButton(icon: String, label: String,
                            active: Bool = false, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            VStack(spacing: 4) {
                Image(systemName: icon)
                    .font(.system(size: 20, weight: .medium))
                Text(label)
                    .font(.caption2)
            }
            .frame(width: 56, height: 52)
            .foregroundStyle(active ? AppColor.accent : .primary)
        }
    }

    // MARK: Notes sheet

    private var notesSheet: some View {
        NavigationStack {
            TextEditor(text: $noteText)
                .padding()
                .navigationTitle("Notes")
                .navigationBarTitleDisplayMode(.inline)
                .toolbar {
                    ToolbarItem(placement: .confirmationAction) {
                        Button("Save") { saveNote(); showNotes = false }
                    }
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Cancel") { showNotes = false }
                    }
                }
        }
    }

    // MARK: Load

    @MainActor
    private func loadScan() async {
        isLoading = true
        let url = scansDir.appendingPathComponent(scan.filename)
        do {
            let loader = STLLoader()
            let result = try await loader.load(from: url)
            let node = result.node

            // Override with the scan viewer's material style
            let mat = SCNMaterial()
            mat.diffuse.contents  = UIColor(white: 0.88, alpha: 1)
            mat.specular.contents = UIColor(white: 0.4, alpha: 1)
            mat.lightingModel     = .phong
            node.geometry?.firstMaterial = mat

            let newScene = SCNScene()
            newScene.rootNode.addChildNode(node)
            let bbox = node.boundingBox
            fitCamera(scene: newScene, bbox: (bbox.min, bbox.max))
            self.scene     = newScene
            self.isLoading = false
        } catch {
            self.loadError = error.localizedDescription
            self.isLoading = false
        }
    }

    private func fitCamera(scene: SCNScene, bbox: (min: SCNVector3, max: SCNVector3)) {
        let cx = (bbox.min.x + bbox.max.x) / 2
        let cy = (bbox.min.y + bbox.max.y) / 2
        let cz = (bbox.min.z + bbox.max.z) / 2
        let dx = bbox.max.x - bbox.min.x
        let dy = bbox.max.y - bbox.min.y
        let dz = bbox.max.z - bbox.min.z
        let extent = sqrt(dx*dx + dy*dy + dz*dz)

        let camera      = SCNCamera()
        camera.zFar     = Double(extent) * 10
        camera.zNear    = Double(extent) * 0.001
        let camNode     = SCNNode()
        camNode.camera  = camera
        camNode.position = SCNVector3(cx, cy, cz + extent * 1.5)
        scene.rootNode.addChildNode(camNode)
    }

    private func resetCamera() {
        guard let scene else { return }
        // Collect camera nodes before mutating the hierarchy
        let cameraNodesToRemove = scene.rootNode.childNodes.filter { $0.camera != nil }
        cameraNodesToRemove.forEach { $0.removeFromParentNode() }
        if let geo = scene.rootNode.childNodes.first(where: { $0.geometry != nil })?.geometry {
            let bb = geo.boundingBox
            fitCamera(scene: scene, bbox: (bb.min, bb.max))
        }
    }

    private func saveNote() {
        let sidecar = scansDir.appendingPathComponent(scan.filename + ".json")
        let data = try? JSONEncoder().encode(ScanSidecar(note: noteText))
        try? data?.write(to: sidecar, options: .atomic)
        if let idx = scans.firstIndex(where: { $0.id == scan.id }) {
            scans[idx].note = noteText
        }
    }
}

// MARK: - Cube preview helper

extension SCNScene {
    static func cubeSample() -> SCNScene {
        let scene = SCNScene()
        let box   = SCNBox(width: 10, height: 10, length: 10, chamferRadius: 0)
        let mat   = SCNMaterial()
        mat.diffuse.contents  = UIColor(white: 0.88, alpha: 1)
        mat.lightingModel     = .phong
        box.firstMaterial     = mat
        let node  = SCNNode(geometry: box)
        scene.rootNode.addChildNode(node)

        let ambientLight = SCNLight()
        ambientLight.type      = .ambient
        ambientLight.intensity = 400
        let ambient = SCNNode()
        ambient.light = ambientLight
        scene.rootNode.addChildNode(ambient)

        let omniLight = SCNLight()
        omniLight.type      = .omni
        omniLight.intensity = 800
        let omni = SCNNode()
        omni.light    = omniLight
        omni.position = SCNVector3(15, 20, 15)
        scene.rootNode.addChildNode(omni)

        let camNode     = SCNNode()
        camNode.camera  = SCNCamera()
        camNode.position = SCNVector3(0, 0, 25)
        scene.rootNode.addChildNode(camNode)
        return scene
    }
}

// MARK: - Preview

#Preview {
    @Previewable @State var scans: [ScanEntry] = [
        ScanEntry(filename: "sample_cube.stl", importDate: .now, triangleCount: 12, note: nil)
    ]
    return NavigationStack {
        ZStack {
            ScanSceneView(
                scene: .cubeSample(),
                wireframe: .constant(false),
                measureMode: .constant(false),
                measureLabel: .constant(nil)
            )
            .ignoresSafeArea()
            Text("Sample cube preview")
                .font(.caption)
                .padding(8)
                .background(.ultraThinMaterial, in: Capsule())
                .padding()
                .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
        .navigationTitle("sample_cube.stl")
        .navigationBarTitleDisplayMode(.inline)
    }
}
