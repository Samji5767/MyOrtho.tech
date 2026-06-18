# STL Viewer Architecture

## Stack
- Three.js
- React Three Fiber
- Drei
- STLLoader from Three.js examples

## Implemented Capabilities
- Client-only dynamic loading to avoid SSR/WebGL hydration issues.
- Binary STL parsing through STLLoader.
- Automatic model centering and bounding sphere camera framing.
- Orbit controls with pan, rotate, zoom, damping, and clinical camera presets.
- Occlusal, side, front, top, and bottom view presets.
- Fullscreen mode, reset camera, and PNG screenshot export.
- Measurement workflow using double-click point picking.
- Section cutting plane toggle using local clipping.
- PBR dental material with environment lighting, contact shadows, tone mapping, anti-aliasing, and high-DPI canvas.
- Geometry disposal when files are replaced or the viewer unmounts.

## Extension Points
- The existing CAD worker can be connected for large STL decimation before geometry reaches the renderer.
- Measurement tools can expand to angle, arch width, Bolton, and interproximal distance tools.
- Server-side scan processing can feed precomputed normals, mesh repair, and segmentation labels.
