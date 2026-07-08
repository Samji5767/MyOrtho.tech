# ADR-001: Cookie-Based Authentication

## Status

Accepted

## Date

2026-01-15

## Context

MyOrtho.tech's frontend is a Next.js SPA making same-origin API calls to the NestJS backend. The application handles clinical data subject to strict session control requirements. We needed an authentication mechanism that:

- Avoids storing credentials or tokens in JavaScript-accessible storage (localStorage, sessionStorage), which is vulnerable to XSS
- Provides CSRF protection without requiring bespoke client-side header management
- Enables automatic session expiry managed by the browser
- Supports clinical-grade session invalidation on the server side

## Decision

We use an HttpOnly cookie named `mo_session` as the authentication transport. The cookie contains a signed JWT payload. On every request, the NestJS `AuthGuard` validates the cookie's JWT signature and expiry before allowing access to protected routes.

Cookie configuration:

- `HttpOnly: true` — not accessible from JavaScript
- `SameSite: Strict` — rejected on cross-origin requests, providing CSRF protection without requiring a separate CSRF token
- `Secure: true` — transmitted over HTTPS only
- `Path: /` — scoped to the entire application

The `AuthGuard` extracts the JWT from the `mo_session` cookie on each request, validates signature and expiry, and attaches the decoded user context to the request object.

## Consequences

### Positive

- No token storage in JavaScript — eliminates the primary XSS token theft vector
- CSRF protection is provided by `SameSite: Strict` without additional tokens or middleware
- The browser enforces automatic expiry via the cookie's `Max-Age`/`Expires` attribute
- Server-side session invalidation is possible by rotating the JWT secret or maintaining a token blocklist

### Negative

- Cross-origin API access (e.g., third-party integrations, mobile web views on different origins) requires explicit CORS configuration with `credentials: true`, which must be carefully locked down to specific allowed origins
- Native mobile apps (iOS/Android) must use a cookie jar (e.g., WKWebView cookie store, OkHttp `CookieJar`) rather than the simpler `Authorization` header approach
- Load balancers must ensure sticky sessions or the JWT secret must be shared across all backend instances (we use shared secret via environment variable)

## Alternatives Considered

### Bearer Token in localStorage

**Rejected.** localStorage is accessible to any JavaScript running on the page. An XSS vulnerability anywhere in the application — including third-party scripts — could silently exfiltrate the token. Clinical data access controls must not depend on XSS absence.

### Bearer Token in Memory (JavaScript variable)

**Rejected.** A token held in a JavaScript module-level variable or React state is not persistent across page refreshes. This would require re-authentication on every page load or a silent refresh mechanism (which re-introduces the XSS surface via the refresh token path). The complexity is not justified for v1 given the SPA architecture.

### OAuth2 Third-Party Provider (Auth0, Cognito, etc.)

**Rejected for v1.** Introducing an external identity provider adds significant integration complexity, vendor dependency, and operational overhead. For a v1 clinical platform with a known user base, a self-managed cookie session is simpler, auditable, and sufficient. OAuth2 federation is noted as a future consideration for enterprise SSO requirements.
