# ADR-004: Next.js Static Export

## Status

Accepted

## Date

2026-01-15

## Context

MyOrtho.tech's frontend is a clinical management SPA used by orthodontists and their staff. The usage pattern is:

- Users authenticate once and work within a rich client-side interface
- All data is fetched from the NestJS backend API after authentication
- Page content is driven by runtime API data, not build-time data
- The application does not require personalized HTML generated on a Node.js server
- Hosting simplicity and CDN performance are priorities for the v1 deployment model

Next.js supports multiple rendering strategies: Server-Side Rendering (SSR), Incremental Static Regeneration (ISR), and static export. The choice has significant implications for hosting infrastructure and operational complexity.

## Decision

We configure `output: 'export'` in `next.config.js`. The entire frontend application is compiled to a static directory of HTML, CSS, and JavaScript files at build time.

All pages are client-rendered: data is fetched from the backend API by client-side hooks after the initial HTML shell loads. Dynamic routes that require static paths at build time use `generateStaticParams` to enumerate known parameter values.

The static export is served via CDN (nginx or a static hosting provider) with all routes falling through to `index.html` (via a `try_files $uri /index.html` nginx directive or equivalent CDN fallback).

## Consequences

### Positive

- **No Node.js server for the frontend.** The output is pure static files: no runtime process to manage, patch, or scale for the frontend tier
- **CDN delivery.** Static assets are served from edge nodes close to users, providing low latency for the shell load
- **Simplified deployment.** A `next build` produces a self-contained `out/` directory that can be deployed by copying files, with no runtime dependencies
- **Reduced attack surface.** No server-side code means no server-side vulnerabilities in the frontend tier

### Negative

- **No server-side data fetching.** `getServerSideProps` and `getStaticProps` with `revalidate` are not available. All data must be fetched client-side after the page loads. This means a loading state is always present on first render for dynamic content
- **No Next.js API routes.** API routes (`/pages/api/*`) are not available in static export mode. All API calls go directly to the NestJS backend
- **SEO limitations.** Client-rendered pages are not crawlable by search engines without additional tooling (e.g., prerendering). This is acceptable for a clinical application behind authentication, which should not be indexed
- **`generateStaticParams` required for dynamic routes.** Any page with a dynamic route segment (e.g., `/cases/[id]`) must either enumerate all known IDs at build time or use a catch-all approach with client-side data loading. We use the latter: dynamic routes render a loading skeleton, then fetch data client-side

## Configuration Reference

```javascript
// next.config.js
const nextConfig = {
  output: 'export',
  trailingSlash: true,
  images: {
    unoptimized: true, // required for static export (no image optimization server)
  },
};
```
