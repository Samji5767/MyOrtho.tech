import SceneKit

@Observable
class WorkspaceViewModel {

    enum LoadState: Equatable {
        case idle
        case loading
        case loaded
        case failed(String)

        static func == (lhs: LoadState, rhs: LoadState) -> Bool {
            switch (lhs, rhs) {
            case (.idle, .idle), (.loading, .loading), (.loaded, .loaded): return true
            case (.failed(let a), .failed(let b)): return a == b
            default: return false
            }
        }
    }

    var loadState:         LoadState = .idle
    var scene:             SCNScene?
    var triangleCount:     Int       = 0
    var wasDecimated:      Bool      = false
    var originalTriangles: Int       = 0
    var currentFileName:   String    = ""

    private let loader = STLLoader()

    func load(url: URL) {
        currentFileName = url.lastPathComponent
        loadState       = .loading
        scene           = nil

        Task.detached(priority: .userInitiated) { [weak self] in
            guard let self else { return }
            do {
                let result = try await self.loader.load(from: url)

                let newScene = SCNScene()
                newScene.rootNode.addChildNode(result.node)
                Self.addLighting(to: newScene)

                await MainActor.run {
                    self.scene             = newScene
                    self.triangleCount     = result.triangleCount
                    self.wasDecimated      = result.wasDecimated
                    self.originalTriangles = result.originalTriangles
                    self.loadState         = .loaded
                }
            } catch {
                await MainActor.run {
                    self.loadState = .failed(error.localizedDescription)
                }
            }
        }
    }

    private static func addLighting(to scene: SCNScene) {
        let ambient       = SCNNode()
        ambient.light     = SCNLight()
        ambient.light?.type      = .ambient
        ambient.light?.intensity = 500
        scene.rootNode.addChildNode(ambient)

        let key           = SCNNode()
        key.light         = SCNLight()
        key.light?.type         = .directional
        key.light?.intensity    = 900
        key.light?.castsShadow  = false
        key.eulerAngles   = SCNVector3(-Float.pi / 4, Float.pi / 4, 0)
        scene.rootNode.addChildNode(key)

        let fill          = SCNNode()
        fill.light        = SCNLight()
        fill.light?.type        = .directional
        fill.light?.intensity   = 400
        fill.eulerAngles  = SCNVector3(Float.pi / 6, -Float.pi / 3, 0)
        scene.rootNode.addChildNode(fill)
    }
}
