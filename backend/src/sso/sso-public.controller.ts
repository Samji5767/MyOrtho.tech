import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
} from '@nestjs/common';

/**
 * SsoPublicController — SSO endpoints that must be reachable WITHOUT authentication.
 *
 * These are the endpoints the Identity Provider calls back after the user
 * authenticates with the IdP. The end user is not yet logged in, so no
 * AuthGuard is applied.
 *
 * IMPLEMENTATION STATUS:
 * - POST /api/sso/callback/saml — ACS placeholder.
 *   A full implementation requires @node-saml/node-saml to parse and verify
 *   the SAML assertion XML, verify the IdP signature, extract the NameID,
 *   look up or provision the user, and issue a session cookie.
 *   Current behavior: always returns 503 with an honest status message.
 *
 * - GET /api/sso/callback/oidc — OIDC callback placeholder.
 *   A full implementation requires openid-client to exchange the authorization
 *   code for tokens, verify the ID token signature, extract claims, and issue
 *   a session cookie.
 *   Current behavior: always returns 503 with an honest status message.
 *
 * Neither library is currently installed. Until they are, SSO login cannot
 * complete even if the configuration is marked active.
 */
@Controller('api/sso')
export class SsoPublicController {
  /**
   * POST /api/sso/callback/saml
   * SAML 2.0 Assertion Consumer Service (ACS) endpoint.
   * Identity Providers POST a SAMLResponse (base64-encoded assertion XML) here.
   *
   * NOT IMPLEMENTED: assertion parsing and signature verification require
   * @node-saml/node-saml which is not installed.
   */
  @Post('callback/saml')
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  samlCallback(@Body() _body: Record<string, unknown>) {
    return {
      status: 'not_implemented',
      message:
        'SAML assertion processing is not yet implemented. ' +
        'Install @node-saml/node-saml to enable SAML assertion parsing and signature verification. ' +
        'SSO login cannot complete until this library is configured.',
    };
  }

  /**
   * GET /api/sso/callback/oidc
   * OIDC authorization code callback.
   * The Identity Provider redirects here with ?code=... after the user authenticates.
   *
   * NOT IMPLEMENTED: authorization code exchange requires openid-client which is not installed.
   */
  @Get('callback/oidc')
  @HttpCode(HttpStatus.SERVICE_UNAVAILABLE)
  oidcCallback(
    @Query('code') _code: string,
    @Query('state') _state: string,
    @Query('error') error: string,
  ) {
    if (error) {
      // Validate against RFC 6749 §4.1.2.1 + OIDC Core §3.1.2.6 error codes
      // to prevent reflected XSS from arbitrary IdP-supplied error strings.
      const OIDC_ERROR_CODES = new Set([
        'access_denied', 'server_error', 'temporarily_unavailable',
        'invalid_request', 'unauthorized_client', 'unsupported_response_type',
        'invalid_scope', 'login_required', 'consent_required',
        'interaction_required', 'request_not_supported',
      ]);
      const safeError = OIDC_ERROR_CODES.has(error) ? error : 'server_error';
      return {
        status: 'error',
        message: `Identity provider returned an error: ${safeError}. SSO login failed.`,
      };
    }
    return {
      status: 'not_implemented',
      message:
        'OIDC authorization code exchange is not yet implemented. ' +
        'Install openid-client to enable token exchange and ID token verification. ' +
        'SSO login cannot complete until this library is configured.',
    };
  }
}
