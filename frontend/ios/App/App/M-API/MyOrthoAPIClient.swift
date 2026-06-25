import Foundation

// MARK: - Error

enum APIClientError: LocalizedError {
    case notAuthenticated
    case invalidResponse
    case httpError(Int, String?)
    case decodingFailed(String)

    var errorDescription: String? {
        switch self {
        case .notAuthenticated:
            return "Not signed in. Please log in again."
        case .invalidResponse:
            return "Unexpected server response."
        case .httpError(let code, let msg):
            return msg ?? "Server error \(code)."
        case .decodingFailed(let msg):
            return "Response parse error: \(msg)"
        }
    }
}

// MARK: - Load state

enum LiveLoadState: Equatable {
    case idle
    case loading
    case loaded
    case offline(String)
    case error(String)
}

// MARK: - MyOrthoAPIClient

/// Shared API client for all live backend calls.
/// Reads the Bearer token from Keychain (same key as AuthService).
actor MyOrthoAPIClient {
    static let shared = MyOrthoAPIClient()

    private let base: URL
    private let session: URLSession
    private let decoder: JSONDecoder

    private static let tokenKey = "mo_bearer_token"

    private init() {
        base = URL(string: "https://myortho.tech")!

        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 90
        session = URLSession(configuration: config)

        let dec = JSONDecoder()
        dec.dateDecodingStrategy = .custom { decoder in
            let str = try decoder.singleValueContainer().decode(String.self)
            let withFrac  = ISO8601DateFormatter()
            withFrac.formatOptions  = [.withInternetDateTime, .withFractionalSeconds]
            let plain = ISO8601DateFormatter()
            plain.formatOptions = [.withInternetDateTime]
            if let d = withFrac.date(from: str) { return d }
            if let d = plain.date(from: str)     { return d }
            throw DecodingError.dataCorruptedError(
                in: try decoder.singleValueContainer(),
                debugDescription: "Cannot decode date: \(str)")
        }
        decoder = dec
    }

    // MARK: - Token

    private func requireToken() throws -> String {
        guard let t = KeychainStore.load(key: Self.tokenKey) else {
            throw APIClientError.notAuthenticated
        }
        return t
    }

    // MARK: - Request builder

    private func request(path: String, method: String = "GET") throws -> URLRequest {
        let url = base.appendingPathComponent(path)
        var req = URLRequest(url: url)
        req.httpMethod = method
        req.setValue("Bearer \(try requireToken())", forHTTPHeaderField: "Authorization")
        return req
    }

    // MARK: - GET

    func get<T: Decodable>(_ path: String) async throws -> T {
        let req = try request(path: path)
        let (data, response) = try await session.data(for: req)
        try validate(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: - POST JSON body

    func post<B: Encodable, T: Decodable>(_ path: String, body: B) async throws -> T {
        var req = try request(path: path, method: "POST")
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(body)
        let (data, response) = try await session.data(for: req)
        try validate(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: - POST empty body

    func postEmpty<T: Decodable>(_ path: String) async throws -> T {
        try await post(path, body: [String: String]())
    }

    // MARK: - Multipart scan upload

    func uploadScan<T: Decodable>(_ path: String, fileURL: URL, jawType: String) async throws -> T {
        var req = try request(path: path, method: "POST")
        let boundary = "MO15C\(UUID().uuidString.replacingOccurrences(of: "-", with: ""))"
        req.setValue("multipart/form-data; boundary=\(boundary)", forHTTPHeaderField: "Content-Type")

        // Build body
        var body = Data()
        body += part(name: "jawType", value: jawType, boundary: boundary)

        let accessed = fileURL.startAccessingSecurityScopedResource()
        defer { if accessed { fileURL.stopAccessingSecurityScopedResource() } }

        let fileData = try Data(contentsOf: fileURL)
        let mime     = Self.mimeType(ext: fileURL.pathExtension)
        body += filePart(name: "file", filename: fileURL.lastPathComponent,
                         mime: mime, data: fileData, boundary: boundary)
        body += "--\(boundary)--\r\n".utf8Data

        req.httpBody = body
        let (data, response) = try await session.data(for: req)
        try validate(response, data: data)
        return try decode(T.self, from: data)
    }

    // MARK: - Validation / decoding helpers

    private func validate(_ response: URLResponse, data: Data) throws {
        guard let http = response as? HTTPURLResponse else {
            throw APIClientError.invalidResponse
        }
        guard (200..<300).contains(http.statusCode) else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["message"]
            throw APIClientError.httpError(http.statusCode, msg)
        }
    }

    private func decode<T: Decodable>(_ type: T.Type, from data: Data) throws -> T {
        do {
            return try decoder.decode(type, from: data)
        } catch {
            throw APIClientError.decodingFailed(error.localizedDescription)
        }
    }

    // MARK: - Multipart helpers

    private func part(name: String, value: String, boundary: String) -> Data {
        "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"\r\n\r\n\(value)\r\n".utf8Data
    }

    private func filePart(name: String, filename: String, mime: String, data: Data, boundary: String) -> Data {
        var d = "--\(boundary)\r\nContent-Disposition: form-data; name=\"\(name)\"; filename=\"\(filename)\"\r\nContent-Type: \(mime)\r\n\r\n".utf8Data
        d += data
        d += "\r\n".utf8Data
        return d
    }

    private static func mimeType(ext: String) -> String {
        switch ext.lowercased() {
        case "stl": return "model/stl"
        case "obj": return "model/obj"
        case "ply": return "application/octet-stream"
        default:    return "application/octet-stream"
        }
    }
}

// MARK: - Data helper

private extension String {
    var utf8Data: Data { Data(utf8) }
}

private func += (lhs: inout Data, rhs: Data) { lhs.append(rhs) }
