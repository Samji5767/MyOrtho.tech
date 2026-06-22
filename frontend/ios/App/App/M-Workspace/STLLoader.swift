import SceneKit
import simd

actor STLLoader {

    // MARK: - Public entry point

    func load(from url: URL) async throws -> LoadResult {
        let data = try Data(contentsOf: url, options: .mappedIfSafe)
        guard data.count >= 84 else { throw STLError.tooShort }

        // Reliable binary detection: compare file size against the expected
        // binary layout (84-byte header + N × 50-byte triangles).
        let possibleCount = data.withUnsafeBytes {
            $0.loadUnaligned(fromByteOffset: 80, as: UInt32.self)
        }
        let expectedBinarySize = 84 + Int(possibleCount) * 50
        let isBinary = (data.count == expectedBinarySize) && possibleCount > 0

        if isBinary {
            return try parseBinary(data, triangleCount: Int(possibleCount))
        } else {
            return try parseASCII(data)
        }
    }

    // MARK: - Result type

    struct LoadResult {
        let node: SCNNode
        let triangleCount: Int
        let wasDecimated: Bool
        let originalTriangles: Int
    }

    // MARK: - Binary parser (triangle soup — no dedup dictionary)

    private func parseBinary(_ data: Data, triangleCount: Int) throws -> LoadResult {
        guard triangleCount > 0 else { throw STLError.emptyMesh }

        // Cap at 150k triangles using uniform stride decimation.
        // 150k gives smooth dental visualisation at fast load time; no
        // dictionary dedup means no O(n) hash-collision hang on large files.
        let maxTriangles = 150_000
        let wasDecimated = triangleCount > maxTriangles
        let step         = wasDecimated ? triangleCount / maxTriangles : 1
        let outputCount  = wasDecimated ? maxTriangles : triangleCount

        var vertices = [SCNVector3](repeating: SCNVector3Zero, count: outputCount * 3)
        var normals  = [SCNVector3](repeating: SCNVector3Zero, count: outputCount * 3)
        // Triangle soup: index i maps to vertex i — no dictionary, no hash work.
        let indices  = Array(Int32(0)..<Int32(outputCount * 3))

        var outIdx = 0
        data.withUnsafeBytes { ptr in
            for i in stride(from: 0, to: triangleCount, by: step) {
                guard outIdx < outputCount else { break }
                let base = 84 + i * 50

                let nx = ptr.loadUnaligned(fromByteOffset: base,      as: Float.self)
                let ny = ptr.loadUnaligned(fromByteOffset: base + 4,  as: Float.self)
                let nz = ptr.loadUnaligned(fromByteOffset: base + 8,  as: Float.self)
                let n  = SCNVector3(nx, ny, nz)

                for v in 0..<3 {
                    let vo  = base + 12 + v * 12
                    let x   = ptr.loadUnaligned(fromByteOffset: vo,     as: Float.self)
                    let y   = ptr.loadUnaligned(fromByteOffset: vo + 4, as: Float.self)
                    let z   = ptr.loadUnaligned(fromByteOffset: vo + 8, as: Float.self)
                    let idx = outIdx * 3 + v
                    vertices[idx] = SCNVector3(x, y, z)
                    normals[idx]  = n
                }
                outIdx += 1
            }
        }

        let node = buildNode(vertices: vertices, normals: normals, indices: indices)
        return LoadResult(
            node: node,
            triangleCount: outputCount,
            wasDecimated: wasDecimated,
            originalTriangles: triangleCount
        )
    }

    // MARK: - ASCII parser

    private func parseASCII(_ data: Data) throws -> LoadResult {
        guard let text = String(data: data, encoding: .utf8) else {
            throw STLError.encodingError
        }

        var vertices = [SCNVector3]()
        var normals  = [SCNVector3]()
        vertices.reserveCapacity(50_000)
        normals.reserveCapacity(50_000)

        var currentNormal = SCNVector3Zero

        for line in text.components(separatedBy: .newlines) {
            let t = line.trimmingCharacters(in: .whitespaces)
            if t.hasPrefix("facet normal ") {
                let p = t.split(separator: " ")
                if p.count == 5,
                   let x = Float(p[2]), let y = Float(p[3]), let z = Float(p[4]) {
                    currentNormal = SCNVector3(x, y, z)
                }
            } else if t.hasPrefix("vertex ") {
                let p = t.split(separator: " ")
                if p.count == 4,
                   let x = Float(p[1]), let y = Float(p[2]), let z = Float(p[3]) {
                    vertices.append(SCNVector3(x, y, z))
                    normals.append(currentNormal)
                }
            }
            // Cap ASCII at 150k triangles = 450k vertices
            if vertices.count >= 450_000 { break }
        }

        guard !vertices.isEmpty else { throw STLError.emptyMesh }

        let indices  = Array(Int32(0)..<Int32(vertices.count))
        let original = vertices.count / 3
        let capped   = vertices.count >= 450_000
        let node     = buildNode(vertices: vertices, normals: normals, indices: indices)
        return LoadResult(
            node: node,
            triangleCount: original,
            wasDecimated: capped,
            originalTriangles: original
        )
    }

    // MARK: - SCNGeometry builder

    private func buildNode(
        vertices: [SCNVector3],
        normals:  [SCNVector3],
        indices:  [Int32]
    ) -> SCNNode {
        let vertexSource = SCNGeometrySource(vertices: vertices)
        let normalSource = SCNGeometrySource(normals: normals)
        let element      = SCNGeometryElement(indices: indices, primitiveType: .triangles)
        let geometry     = SCNGeometry(sources: [vertexSource, normalSource], elements: [element])

        let material = SCNMaterial()
        material.diffuse.contents  = UIColor(red: 0.73, green: 0.94, blue: 0.93, alpha: 1)
        material.specular.contents = UIColor.white
        material.shininess         = 0.3
        material.isDoubleSided     = true
        material.lightingModel     = .phong
        geometry.firstMaterial     = material

        let node = SCNNode(geometry: geometry)
        let (minB, maxB) = node.boundingBox
        let cx = (minB.x + maxB.x) / 2
        let cy = (minB.y + maxB.y) / 2
        let cz = (minB.z + maxB.z) / 2
        node.pivot = SCNMatrix4MakeTranslation(cx, cy, cz)

        return node
    }
}

// MARK: - Errors

enum STLError: Error, LocalizedError {
    case tooShort
    case emptyMesh
    case truncated
    case encodingError

    var errorDescription: String? {
        switch self {
        case .tooShort:      return "File is too small to be a valid STL."
        case .emptyMesh:     return "STL file contains no geometry."
        case .truncated:     return "STL file appears truncated or corrupted."
        case .encodingError: return "Could not decode ASCII STL text."
        }
    }
}
