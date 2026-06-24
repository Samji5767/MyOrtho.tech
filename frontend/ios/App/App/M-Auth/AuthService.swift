import Foundation

// MARK: - Types

struct AuthUser: Codable, Equatable {
    let id: String
    let email: String
    let name: String
    let role: String
    let orgId: String?
    let isOnboarded: Bool
}

enum AuthError: LocalizedError {
    case noStoredToken
    case invalidCredentials
    case networkError(String)
    case serverError(Int, String)

    var errorDescription: String? {
        switch self {
        case .noStoredToken:                        return "No stored session."
        case .invalidCredentials:                   return "Invalid email or password."
        case .networkError(let msg):                return "Network error — \(msg)"
        case .serverError(let code, let msg):       return "Server error \(code): \(msg)"
        }
    }
}

// MARK: - AuthService

actor AuthService {
    static let shared = AuthService()

    private let baseURL   = URL(string: "https://myortho.tech")!
    private let tokenKey  = "mo_bearer_token"
    private let urlSession: URLSession

    private init() {
        let config = URLSessionConfiguration.default
        config.timeoutIntervalForRequest  = 30
        config.timeoutIntervalForResource = 60
        urlSession = URLSession(configuration: config)
    }

    // MARK: - Keychain

    func storedToken() -> String? { KeychainStore.load(key: tokenKey) }

    private func saveToken(_ token: String) throws {
        try KeychainStore.save(key: tokenKey, value: token)
    }

    func clearToken() { KeychainStore.delete(key: tokenKey) }

    // MARK: - Login

    func login(email: String, password: String) async throws -> AuthUser {
        var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/login"))
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "Content-Type")
        req.httpBody = try JSONEncoder().encode(["email": email, "password": password])

        let (data, response) = try await urlSession.data(for: req)
        let http = response as! HTTPURLResponse

        if http.statusCode == 401 { throw AuthError.invalidCredentials }
        guard http.statusCode == 200 else {
            let msg = (try? JSONDecoder().decode([String: String].self, from: data))?["message"] ?? "Login failed"
            throw AuthError.serverError(http.statusCode, msg)
        }

        struct LoginResponse: Decodable { let user: AuthUser; let token: String }
        let body = try JSONDecoder().decode(LoginResponse.self, from: data)
        try saveToken(body.token)
        return body.user
    }

    // MARK: - Session validation

    func fetchSession() async throws -> AuthUser {
        guard let token = storedToken() else { throw AuthError.noStoredToken }

        var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/session"))
        req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")

        let (data, response) = try await urlSession.data(for: req)
        let http = response as! HTTPURLResponse

        guard http.statusCode == 200 else {
            clearToken()
            throw AuthError.invalidCredentials
        }

        struct SessionResponse: Decodable { let user: AuthUser }
        return try JSONDecoder().decode(SessionResponse.self, from: data).user
    }

    // MARK: - Logout

    func logout() async {
        if let token = storedToken() {
            var req = URLRequest(url: baseURL.appendingPathComponent("api/auth/logout"))
            req.httpMethod = "POST"
            req.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
            _ = try? await urlSession.data(for: req)
        }
        clearToken()
    }
}
