# Performance Report

## Improvements Implemented
- Heavy workspaces are dynamically imported with loading skeletons.
- WebGL viewer is client-only to prevent hydration and SSR overhead.
- Geometry memory is disposed when models are replaced.
- Design primitives reduce repeated component markup and improve render consistency.
- CSS uses tokenized themes and reduced-motion media handling.
- STL import metrics run locally without blocking unrelated workspaces.

## Current Targets
- Fast initial paint by loading the landing/app shell first.
- Deferred Three.js and manufacturing surfaces until selected.
- Responsive layout with stable dimensions for viewer and cards.

## Remaining Recommendations
- Add bundle analyzer and enforce route-level budgets.
- Move very large STL parsing/decimation fully into a worker pipeline.
- Add Web Vitals reporting and automated Lighthouse CI.
- Cache uploaded model metadata by file hash.
- Add virtualized tables when patient/case volume grows beyond several hundred rows.
