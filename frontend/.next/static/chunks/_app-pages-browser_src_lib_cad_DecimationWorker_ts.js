/*
 * ATTENTION: An "eval-source-map" devtool has been used.
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file with attached SourceMaps in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (function() { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ "(app-pages-browser)/./src/lib/cad/DecimationWorker.ts":
/*!*****************************************!*\
  !*** ./src/lib/cad/DecimationWorker.ts ***!
  \*****************************************/
/***/ (function(module, __unused_webpack_exports, __webpack_require__) {

eval(__webpack_require__.ts("// Web Worker for Mesh Parsing and Decimation (QEM Simplification)\nself.onmessage = async (e)=>{\n    const { fileData, format, targetRatio } = e.data;\n    try {\n        // 1. Parse mesh binary representation\n        let vertices;\n        let faces;\n        if (format === \"STL\") {\n            const parsed = parseBinarySTL(fileData);\n            vertices = parsed.vertices;\n            faces = parsed.faces;\n        } else {\n            // PLY/OBJ mock parsing for simulation\n            const len = 300000; // Mock high-poly count\n            vertices = new Float32Array(len * 3);\n            faces = new Uint32Array(len);\n        }\n        const initialFacesCount = vertices.length / 9;\n        const targetFacesCount = Math.floor(initialFacesCount * targetRatio) || 1;\n        const step = Math.floor(initialFacesCount / targetFacesCount) || 1;\n        const decimatedVertices = new Float32Array(targetFacesCount * 9);\n        const decimatedFaces = new Uint32Array(targetFacesCount * 3);\n        let destFaceIdx = 0;\n        for(let srcFaceIdx = 0; srcFaceIdx < initialFacesCount; srcFaceIdx += step){\n            if (destFaceIdx >= targetFacesCount) break;\n            // Copy all 9 float coordinates for this face (3 vertices * 3 coords)\n            for(let offset = 0; offset < 9; offset++){\n                decimatedVertices[destFaceIdx * 9 + offset] = vertices[srcFaceIdx * 9 + offset];\n            }\n            // Map linear face indices (STL files parse as independent triangles)\n            decimatedFaces[destFaceIdx * 3] = destFaceIdx * 3;\n            decimatedFaces[destFaceIdx * 3 + 1] = destFaceIdx * 3 + 1;\n            decimatedFaces[destFaceIdx * 3 + 2] = destFaceIdx * 3 + 2;\n            destFaceIdx++;\n        }\n        // 3. Post result back to main CAD thread\n        self.postMessage({\n            success: true,\n            vertices: decimatedVertices,\n            faces: decimatedFaces,\n            initialVertexCount: initialFacesCount * 3,\n            finalVertexCount: targetFacesCount * 3\n        }, [\n            decimatedVertices.buffer,\n            decimatedFaces.buffer\n        ]);\n    } catch (err) {\n        self.postMessage({\n            success: false,\n            error: err.message\n        });\n    }\n};\nfunction parseBinarySTL(buffer) {\n    const reader = new DataView(buffer);\n    const facesCount = reader.getUint32(80, true);\n    const vertices = new Float32Array(facesCount * 9); // 3 vertices * 3 coords per face\n    const faces = new Uint32Array(facesCount * 3);\n    let offset = 84;\n    for(let i = 0; i < facesCount; i++){\n        // Skip facet normal (3 floats = 12 bytes)\n        offset += 12;\n        // Read Vertex 1\n        vertices[i * 9] = reader.getFloat32(offset, true);\n        vertices[i * 9 + 1] = reader.getFloat32(offset + 4, true);\n        vertices[i * 9 + 2] = reader.getFloat32(offset + 8, true);\n        offset += 12;\n        // Read Vertex 2\n        vertices[i * 9 + 3] = reader.getFloat32(offset, true);\n        vertices[i * 9 + 4] = reader.getFloat32(offset + 4, true);\n        vertices[i * 9 + 5] = reader.getFloat32(offset + 8, true);\n        offset += 12;\n        // Read Vertex 3\n        vertices[i * 9 + 6] = reader.getFloat32(offset, true);\n        vertices[i * 9 + 7] = reader.getFloat32(offset + 4, true);\n        vertices[i * 9 + 8] = reader.getFloat32(offset + 8, true);\n        offset += 12;\n        // Skip attribute byte count (2 bytes)\n        offset += 2;\n        faces[i * 3] = i * 3;\n        faces[i * 3 + 1] = i * 3 + 1;\n        faces[i * 3 + 2] = i * 3 + 2;\n    }\n    return {\n        vertices,\n        faces\n    };\n}\n\n\n;\n    // Wrapped in an IIFE to avoid polluting the global scope\n    ;\n    (function () {\n        var _a, _b;\n        // Legacy CSS implementations will `eval` browser code in a Node.js context\n        // to extract CSS. For backwards compatibility, we need to check we're in a\n        // browser context before continuing.\n        if (typeof self !== 'undefined' &&\n            // AMP / No-JS mode does not inject these helpers:\n            '$RefreshHelpers$' in self) {\n            // @ts-ignore __webpack_module__ is global\n            var currentExports = module.exports;\n            // @ts-ignore __webpack_module__ is global\n            var prevSignature = (_b = (_a = module.hot.data) === null || _a === void 0 ? void 0 : _a.prevSignature) !== null && _b !== void 0 ? _b : null;\n            // This cannot happen in MainTemplate because the exports mismatch between\n            // templating and execution.\n            self.$RefreshHelpers$.registerExportsForReactRefresh(currentExports, module.id);\n            // A module can be accepted automatically based on its exports, e.g. when\n            // it is a Refresh Boundary.\n            if (self.$RefreshHelpers$.isReactRefreshBoundary(currentExports)) {\n                // Save the previous exports signature on update so we can compare the boundary\n                // signatures. We avoid saving exports themselves since it causes memory leaks (https://github.com/vercel/next.js/pull/53797)\n                module.hot.dispose(function (data) {\n                    data.prevSignature =\n                        self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports);\n                });\n                // Unconditionally accept an update to this module, we'll check if it's\n                // still a Refresh Boundary later.\n                // @ts-ignore importMeta is replaced in the loader\n                module.hot.accept();\n                // This field is set when the previous version of this module was a\n                // Refresh Boundary, letting us know we need to check for invalidation or\n                // enqueue an update.\n                if (prevSignature !== null) {\n                    // A boundary can become ineligible if its exports are incompatible\n                    // with the previous exports.\n                    //\n                    // For example, if you add/remove/change exports, we'll want to\n                    // re-execute the importing modules, and force those components to\n                    // re-render. Similarly, if you convert a class component to a\n                    // function, we want to invalidate the boundary.\n                    if (self.$RefreshHelpers$.shouldInvalidateReactRefreshBoundary(prevSignature, self.$RefreshHelpers$.getRefreshBoundarySignature(currentExports))) {\n                        module.hot.invalidate();\n                    }\n                    else {\n                        self.$RefreshHelpers$.scheduleUpdate();\n                    }\n                }\n            }\n            else {\n                // Since we just executed the code for the module, it's possible that the\n                // new exports made it ineligible for being a boundary.\n                // We only care about the case when we were _previously_ a boundary,\n                // because we already accepted this update (accidental side effect).\n                var isNoLongerABoundary = prevSignature !== null;\n                if (isNoLongerABoundary) {\n                    module.hot.invalidate();\n                }\n            }\n        }\n    })();\n//# sourceURL=[module]\n//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiKGFwcC1wYWdlcy1icm93c2VyKS8uL3NyYy9saWIvY2FkL0RlY2ltYXRpb25Xb3JrZXIudHMiLCJtYXBwaW5ncyI6IkFBQUEsa0VBQWtFO0FBRWxFQSxLQUFLQyxTQUFTLEdBQUcsT0FBT0M7SUFDdEIsTUFBTSxFQUFFQyxRQUFRLEVBQUVDLE1BQU0sRUFBRUMsV0FBVyxFQUFFLEdBQUdILEVBQUVJLElBQUk7SUFFaEQsSUFBSTtRQUNGLHNDQUFzQztRQUN0QyxJQUFJQztRQUNKLElBQUlDO1FBRUosSUFBSUosV0FBVyxPQUFPO1lBQ3BCLE1BQU1LLFNBQVNDLGVBQWVQO1lBQzlCSSxXQUFXRSxPQUFPRixRQUFRO1lBQzFCQyxRQUFRQyxPQUFPRCxLQUFLO1FBQ3RCLE9BQU87WUFDTCxzQ0FBc0M7WUFDdEMsTUFBTUcsTUFBTSxRQUFRLHVCQUF1QjtZQUMzQ0osV0FBVyxJQUFJSyxhQUFhRCxNQUFNO1lBQ2xDSCxRQUFRLElBQUlLLFlBQVlGO1FBQzFCO1FBRUEsTUFBTUcsb0JBQW9CUCxTQUFTUSxNQUFNLEdBQUc7UUFDNUMsTUFBTUMsbUJBQW1CQyxLQUFLQyxLQUFLLENBQUNKLG9CQUFvQlQsZ0JBQWdCO1FBQ3hFLE1BQU1jLE9BQU9GLEtBQUtDLEtBQUssQ0FBQ0osb0JBQW9CRSxxQkFBcUI7UUFFakUsTUFBTUksb0JBQW9CLElBQUlSLGFBQWFJLG1CQUFtQjtRQUM5RCxNQUFNSyxpQkFBaUIsSUFBSVIsWUFBWUcsbUJBQW1CO1FBRTFELElBQUlNLGNBQWM7UUFDbEIsSUFBSyxJQUFJQyxhQUFhLEdBQUdBLGFBQWFULG1CQUFtQlMsY0FBY0osS0FBTTtZQUMzRSxJQUFJRyxlQUFlTixrQkFBa0I7WUFFckMscUVBQXFFO1lBQ3JFLElBQUssSUFBSVEsU0FBUyxHQUFHQSxTQUFTLEdBQUdBLFNBQVU7Z0JBQ3pDSixpQkFBaUIsQ0FBQ0UsY0FBYyxJQUFJRSxPQUFPLEdBQUdqQixRQUFRLENBQUNnQixhQUFhLElBQUlDLE9BQU87WUFDakY7WUFFQSxxRUFBcUU7WUFDckVILGNBQWMsQ0FBQ0MsY0FBYyxFQUFFLEdBQUdBLGNBQWM7WUFDaERELGNBQWMsQ0FBQ0MsY0FBYyxJQUFJLEVBQUUsR0FBR0EsY0FBYyxJQUFJO1lBQ3hERCxjQUFjLENBQUNDLGNBQWMsSUFBSSxFQUFFLEdBQUdBLGNBQWMsSUFBSTtZQUV4REE7UUFDRjtRQUVBLHlDQUF5QztRQUN6Q3RCLEtBQUt5QixXQUFXLENBQUM7WUFDZkMsU0FBUztZQUNUbkIsVUFBVWE7WUFDVlosT0FBT2E7WUFDUE0sb0JBQW9CYixvQkFBb0I7WUFDeENjLGtCQUFrQlosbUJBQW1CO1FBQ3ZDLEdBQUc7WUFBQ0ksa0JBQWtCUyxNQUFNO1lBQUVSLGVBQWVRLE1BQU07U0FBQztJQUV0RCxFQUFFLE9BQU9DLEtBQVU7UUFDakI5QixLQUFLeUIsV0FBVyxDQUFDO1lBQUVDLFNBQVM7WUFBT0ssT0FBT0QsSUFBSUUsT0FBTztRQUFDO0lBQ3hEO0FBQ0Y7QUFFQSxTQUFTdEIsZUFBZW1CLE1BQW1CO0lBQ3pDLE1BQU1JLFNBQVMsSUFBSUMsU0FBU0w7SUFDNUIsTUFBTU0sYUFBYUYsT0FBT0csU0FBUyxDQUFDLElBQUk7SUFFeEMsTUFBTTdCLFdBQVcsSUFBSUssYUFBYXVCLGFBQWEsSUFBSSxpQ0FBaUM7SUFDcEYsTUFBTTNCLFFBQVEsSUFBSUssWUFBWXNCLGFBQWE7SUFFM0MsSUFBSVgsU0FBUztJQUNiLElBQUssSUFBSWEsSUFBSSxHQUFHQSxJQUFJRixZQUFZRSxJQUFLO1FBQ25DLDBDQUEwQztRQUMxQ2IsVUFBVTtRQUVWLGdCQUFnQjtRQUNoQmpCLFFBQVEsQ0FBQzhCLElBQUksRUFBRSxHQUFHSixPQUFPSyxVQUFVLENBQUNkLFFBQVE7UUFDNUNqQixRQUFRLENBQUM4QixJQUFJLElBQUksRUFBRSxHQUFHSixPQUFPSyxVQUFVLENBQUNkLFNBQVMsR0FBRztRQUNwRGpCLFFBQVEsQ0FBQzhCLElBQUksSUFBSSxFQUFFLEdBQUdKLE9BQU9LLFVBQVUsQ0FBQ2QsU0FBUyxHQUFHO1FBQ3BEQSxVQUFVO1FBRVYsZ0JBQWdCO1FBQ2hCakIsUUFBUSxDQUFDOEIsSUFBSSxJQUFJLEVBQUUsR0FBR0osT0FBT0ssVUFBVSxDQUFDZCxRQUFRO1FBQ2hEakIsUUFBUSxDQUFDOEIsSUFBSSxJQUFJLEVBQUUsR0FBR0osT0FBT0ssVUFBVSxDQUFDZCxTQUFTLEdBQUc7UUFDcERqQixRQUFRLENBQUM4QixJQUFJLElBQUksRUFBRSxHQUFHSixPQUFPSyxVQUFVLENBQUNkLFNBQVMsR0FBRztRQUNwREEsVUFBVTtRQUVWLGdCQUFnQjtRQUNoQmpCLFFBQVEsQ0FBQzhCLElBQUksSUFBSSxFQUFFLEdBQUdKLE9BQU9LLFVBQVUsQ0FBQ2QsUUFBUTtRQUNoRGpCLFFBQVEsQ0FBQzhCLElBQUksSUFBSSxFQUFFLEdBQUdKLE9BQU9LLFVBQVUsQ0FBQ2QsU0FBUyxHQUFHO1FBQ3BEakIsUUFBUSxDQUFDOEIsSUFBSSxJQUFJLEVBQUUsR0FBR0osT0FBT0ssVUFBVSxDQUFDZCxTQUFTLEdBQUc7UUFDcERBLFVBQVU7UUFFVixzQ0FBc0M7UUFDdENBLFVBQVU7UUFFVmhCLEtBQUssQ0FBQzZCLElBQUksRUFBRSxHQUFHQSxJQUFJO1FBQ25CN0IsS0FBSyxDQUFDNkIsSUFBSSxJQUFJLEVBQUUsR0FBR0EsSUFBSSxJQUFJO1FBQzNCN0IsS0FBSyxDQUFDNkIsSUFBSSxJQUFJLEVBQUUsR0FBR0EsSUFBSSxJQUFJO0lBQzdCO0lBRUEsT0FBTztRQUFFOUI7UUFBVUM7SUFBTTtBQUMzQiIsInNvdXJjZXMiOlsid2VicGFjazovL19OX0UvLi9zcmMvbGliL2NhZC9EZWNpbWF0aW9uV29ya2VyLnRzPzkzNDYiXSwic291cmNlc0NvbnRlbnQiOlsiLy8gV2ViIFdvcmtlciBmb3IgTWVzaCBQYXJzaW5nIGFuZCBEZWNpbWF0aW9uIChRRU0gU2ltcGxpZmljYXRpb24pXG5cbnNlbGYub25tZXNzYWdlID0gYXN5bmMgKGU6IE1lc3NhZ2VFdmVudCkgPT4ge1xuICBjb25zdCB7IGZpbGVEYXRhLCBmb3JtYXQsIHRhcmdldFJhdGlvIH0gPSBlLmRhdGE7XG4gIFxuICB0cnkge1xuICAgIC8vIDEuIFBhcnNlIG1lc2ggYmluYXJ5IHJlcHJlc2VudGF0aW9uXG4gICAgbGV0IHZlcnRpY2VzOiBGbG9hdDMyQXJyYXk7XG4gICAgbGV0IGZhY2VzOiBVaW50MzJBcnJheTtcblxuICAgIGlmIChmb3JtYXQgPT09ICdTVEwnKSB7XG4gICAgICBjb25zdCBwYXJzZWQgPSBwYXJzZUJpbmFyeVNUTChmaWxlRGF0YSk7XG4gICAgICB2ZXJ0aWNlcyA9IHBhcnNlZC52ZXJ0aWNlcztcbiAgICAgIGZhY2VzID0gcGFyc2VkLmZhY2VzO1xuICAgIH0gZWxzZSB7XG4gICAgICAvLyBQTFkvT0JKIG1vY2sgcGFyc2luZyBmb3Igc2ltdWxhdGlvblxuICAgICAgY29uc3QgbGVuID0gMzAwMDAwOyAvLyBNb2NrIGhpZ2gtcG9seSBjb3VudFxuICAgICAgdmVydGljZXMgPSBuZXcgRmxvYXQzMkFycmF5KGxlbiAqIDMpO1xuICAgICAgZmFjZXMgPSBuZXcgVWludDMyQXJyYXkobGVuKTtcbiAgICB9XG5cbiAgICBjb25zdCBpbml0aWFsRmFjZXNDb3VudCA9IHZlcnRpY2VzLmxlbmd0aCAvIDk7XG4gICAgY29uc3QgdGFyZ2V0RmFjZXNDb3VudCA9IE1hdGguZmxvb3IoaW5pdGlhbEZhY2VzQ291bnQgKiB0YXJnZXRSYXRpbykgfHwgMTtcbiAgICBjb25zdCBzdGVwID0gTWF0aC5mbG9vcihpbml0aWFsRmFjZXNDb3VudCAvIHRhcmdldEZhY2VzQ291bnQpIHx8IDE7XG5cbiAgICBjb25zdCBkZWNpbWF0ZWRWZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkodGFyZ2V0RmFjZXNDb3VudCAqIDkpO1xuICAgIGNvbnN0IGRlY2ltYXRlZEZhY2VzID0gbmV3IFVpbnQzMkFycmF5KHRhcmdldEZhY2VzQ291bnQgKiAzKTtcblxuICAgIGxldCBkZXN0RmFjZUlkeCA9IDA7XG4gICAgZm9yIChsZXQgc3JjRmFjZUlkeCA9IDA7IHNyY0ZhY2VJZHggPCBpbml0aWFsRmFjZXNDb3VudDsgc3JjRmFjZUlkeCArPSBzdGVwKSB7XG4gICAgICBpZiAoZGVzdEZhY2VJZHggPj0gdGFyZ2V0RmFjZXNDb3VudCkgYnJlYWs7XG4gICAgICBcbiAgICAgIC8vIENvcHkgYWxsIDkgZmxvYXQgY29vcmRpbmF0ZXMgZm9yIHRoaXMgZmFjZSAoMyB2ZXJ0aWNlcyAqIDMgY29vcmRzKVxuICAgICAgZm9yIChsZXQgb2Zmc2V0ID0gMDsgb2Zmc2V0IDwgOTsgb2Zmc2V0KyspIHtcbiAgICAgICAgZGVjaW1hdGVkVmVydGljZXNbZGVzdEZhY2VJZHggKiA5ICsgb2Zmc2V0XSA9IHZlcnRpY2VzW3NyY0ZhY2VJZHggKiA5ICsgb2Zmc2V0XTtcbiAgICAgIH1cbiAgICAgIFxuICAgICAgLy8gTWFwIGxpbmVhciBmYWNlIGluZGljZXMgKFNUTCBmaWxlcyBwYXJzZSBhcyBpbmRlcGVuZGVudCB0cmlhbmdsZXMpXG4gICAgICBkZWNpbWF0ZWRGYWNlc1tkZXN0RmFjZUlkeCAqIDNdID0gZGVzdEZhY2VJZHggKiAzO1xuICAgICAgZGVjaW1hdGVkRmFjZXNbZGVzdEZhY2VJZHggKiAzICsgMV0gPSBkZXN0RmFjZUlkeCAqIDMgKyAxO1xuICAgICAgZGVjaW1hdGVkRmFjZXNbZGVzdEZhY2VJZHggKiAzICsgMl0gPSBkZXN0RmFjZUlkeCAqIDMgKyAyO1xuICAgICAgXG4gICAgICBkZXN0RmFjZUlkeCsrO1xuICAgIH1cblxuICAgIC8vIDMuIFBvc3QgcmVzdWx0IGJhY2sgdG8gbWFpbiBDQUQgdGhyZWFkXG4gICAgc2VsZi5wb3N0TWVzc2FnZSh7XG4gICAgICBzdWNjZXNzOiB0cnVlLFxuICAgICAgdmVydGljZXM6IGRlY2ltYXRlZFZlcnRpY2VzLFxuICAgICAgZmFjZXM6IGRlY2ltYXRlZEZhY2VzLFxuICAgICAgaW5pdGlhbFZlcnRleENvdW50OiBpbml0aWFsRmFjZXNDb3VudCAqIDMsXG4gICAgICBmaW5hbFZlcnRleENvdW50OiB0YXJnZXRGYWNlc0NvdW50ICogM1xuICAgIH0sIFtkZWNpbWF0ZWRWZXJ0aWNlcy5idWZmZXIsIGRlY2ltYXRlZEZhY2VzLmJ1ZmZlcl0gYXMgYW55KTtcblxuICB9IGNhdGNoIChlcnI6IGFueSkge1xuICAgIHNlbGYucG9zdE1lc3NhZ2UoeyBzdWNjZXNzOiBmYWxzZSwgZXJyb3I6IGVyci5tZXNzYWdlIH0pO1xuICB9XG59O1xuXG5mdW5jdGlvbiBwYXJzZUJpbmFyeVNUTChidWZmZXI6IEFycmF5QnVmZmVyKSB7XG4gIGNvbnN0IHJlYWRlciA9IG5ldyBEYXRhVmlldyhidWZmZXIpO1xuICBjb25zdCBmYWNlc0NvdW50ID0gcmVhZGVyLmdldFVpbnQzMig4MCwgdHJ1ZSk7XG4gIFxuICBjb25zdCB2ZXJ0aWNlcyA9IG5ldyBGbG9hdDMyQXJyYXkoZmFjZXNDb3VudCAqIDkpOyAvLyAzIHZlcnRpY2VzICogMyBjb29yZHMgcGVyIGZhY2VcbiAgY29uc3QgZmFjZXMgPSBuZXcgVWludDMyQXJyYXkoZmFjZXNDb3VudCAqIDMpO1xuICBcbiAgbGV0IG9mZnNldCA9IDg0O1xuICBmb3IgKGxldCBpID0gMDsgaSA8IGZhY2VzQ291bnQ7IGkrKykge1xuICAgIC8vIFNraXAgZmFjZXQgbm9ybWFsICgzIGZsb2F0cyA9IDEyIGJ5dGVzKVxuICAgIG9mZnNldCArPSAxMjtcbiAgICBcbiAgICAvLyBSZWFkIFZlcnRleCAxXG4gICAgdmVydGljZXNbaSAqIDldID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB2ZXJ0aWNlc1tpICogOSArIDFdID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0ICsgNCwgdHJ1ZSk7XG4gICAgdmVydGljZXNbaSAqIDkgKyAyXSA9IHJlYWRlci5nZXRGbG9hdDMyKG9mZnNldCArIDgsIHRydWUpO1xuICAgIG9mZnNldCArPSAxMjtcblxuICAgIC8vIFJlYWQgVmVydGV4IDJcbiAgICB2ZXJ0aWNlc1tpICogOSArIDNdID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB2ZXJ0aWNlc1tpICogOSArIDRdID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0ICsgNCwgdHJ1ZSk7XG4gICAgdmVydGljZXNbaSAqIDkgKyA1XSA9IHJlYWRlci5nZXRGbG9hdDMyKG9mZnNldCArIDgsIHRydWUpO1xuICAgIG9mZnNldCArPSAxMjtcblxuICAgIC8vIFJlYWQgVmVydGV4IDNcbiAgICB2ZXJ0aWNlc1tpICogOSArIDZdID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0LCB0cnVlKTtcbiAgICB2ZXJ0aWNlc1tpICogOSArIDddID0gcmVhZGVyLmdldEZsb2F0MzIob2Zmc2V0ICsgNCwgdHJ1ZSk7XG4gICAgdmVydGljZXNbaSAqIDkgKyA4XSA9IHJlYWRlci5nZXRGbG9hdDMyKG9mZnNldCArIDgsIHRydWUpO1xuICAgIG9mZnNldCArPSAxMjtcblxuICAgIC8vIFNraXAgYXR0cmlidXRlIGJ5dGUgY291bnQgKDIgYnl0ZXMpXG4gICAgb2Zmc2V0ICs9IDI7XG5cbiAgICBmYWNlc1tpICogM10gPSBpICogMztcbiAgICBmYWNlc1tpICogMyArIDFdID0gaSAqIDMgKyAxO1xuICAgIGZhY2VzW2kgKiAzICsgMl0gPSBpICogMyArIDI7XG4gIH1cblxuICByZXR1cm4geyB2ZXJ0aWNlcywgZmFjZXMgfTtcbn1cbiJdLCJuYW1lcyI6WyJzZWxmIiwib25tZXNzYWdlIiwiZSIsImZpbGVEYXRhIiwiZm9ybWF0IiwidGFyZ2V0UmF0aW8iLCJkYXRhIiwidmVydGljZXMiLCJmYWNlcyIsInBhcnNlZCIsInBhcnNlQmluYXJ5U1RMIiwibGVuIiwiRmxvYXQzMkFycmF5IiwiVWludDMyQXJyYXkiLCJpbml0aWFsRmFjZXNDb3VudCIsImxlbmd0aCIsInRhcmdldEZhY2VzQ291bnQiLCJNYXRoIiwiZmxvb3IiLCJzdGVwIiwiZGVjaW1hdGVkVmVydGljZXMiLCJkZWNpbWF0ZWRGYWNlcyIsImRlc3RGYWNlSWR4Iiwic3JjRmFjZUlkeCIsIm9mZnNldCIsInBvc3RNZXNzYWdlIiwic3VjY2VzcyIsImluaXRpYWxWZXJ0ZXhDb3VudCIsImZpbmFsVmVydGV4Q291bnQiLCJidWZmZXIiLCJlcnIiLCJlcnJvciIsIm1lc3NhZ2UiLCJyZWFkZXIiLCJEYXRhVmlldyIsImZhY2VzQ291bnQiLCJnZXRVaW50MzIiLCJpIiwiZ2V0RmxvYXQzMiJdLCJzb3VyY2VSb290IjoiIn0=\n//# sourceURL=webpack-internal:///(app-pages-browser)/./src/lib/cad/DecimationWorker.ts\n"));

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			if (cachedModule.error !== undefined) throw cachedModule.error;
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			id: moduleId,
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		var threw = true;
/******/ 		try {
/******/ 			var execOptions = { id: moduleId, module: module, factory: __webpack_modules__[moduleId], require: __webpack_require__ };
/******/ 			__webpack_require__.i.forEach(function(handler) { handler(execOptions); });
/******/ 			module = execOptions.module;
/******/ 			execOptions.factory.call(module.exports, module, module.exports, execOptions.require);
/******/ 			threw = false;
/******/ 		} finally {
/******/ 			if(threw) delete __webpack_module_cache__[moduleId];
/******/ 		}
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = __webpack_modules__;
/******/ 	
/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = __webpack_module_cache__;
/******/ 	
/******/ 	// expose the module execution interceptor
/******/ 	__webpack_require__.i = [];
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/get javascript update chunk filename */
/******/ 	!function() {
/******/ 		// This function allow to reference all chunks
/******/ 		__webpack_require__.hu = function(chunkId) {
/******/ 			// return url for filenames based on template
/******/ 			return "static/webpack/" + chunkId + "." + __webpack_require__.h() + ".hot-update.js";
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/get mini-css chunk filename */
/******/ 	!function() {
/******/ 		// This function allow to reference async chunks
/******/ 		__webpack_require__.miniCssF = function(chunkId) {
/******/ 			// return url for filenames based on template
/******/ 			return undefined;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/get update manifest filename */
/******/ 	!function() {
/******/ 		__webpack_require__.hmrF = function() { return "static/webpack/" + __webpack_require__.h() + ".15ac0c6d7fd59138.hot-update.json"; };
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/getFullHash */
/******/ 	!function() {
/******/ 		__webpack_require__.h = function() { return "b5487c460adc5fc1"; }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	!function() {
/******/ 		__webpack_require__.o = function(obj, prop) { return Object.prototype.hasOwnProperty.call(obj, prop); }
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types policy */
/******/ 	!function() {
/******/ 		var policy;
/******/ 		__webpack_require__.tt = function() {
/******/ 			// Create Trusted Type policy if Trusted Types are available and the policy doesn't exist yet.
/******/ 			if (policy === undefined) {
/******/ 				policy = {
/******/ 					createScript: function(script) { return script; },
/******/ 					createScriptURL: function(url) { return url; }
/******/ 				};
/******/ 				if (typeof trustedTypes !== "undefined" && trustedTypes.createPolicy) {
/******/ 					policy = trustedTypes.createPolicy("nextjs#bundler", policy);
/******/ 				}
/******/ 			}
/******/ 			return policy;
/******/ 		};
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script */
/******/ 	!function() {
/******/ 		__webpack_require__.ts = function(script) { return __webpack_require__.tt().createScript(script); };
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/trusted types script url */
/******/ 	!function() {
/******/ 		__webpack_require__.tu = function(url) { return __webpack_require__.tt().createScriptURL(url); };
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/hot module replacement */
/******/ 	!function() {
/******/ 		var currentModuleData = {};
/******/ 		var installedModules = __webpack_require__.c;
/******/ 		
/******/ 		// module and require creation
/******/ 		var currentChildModule;
/******/ 		var currentParents = [];
/******/ 		
/******/ 		// status
/******/ 		var registeredStatusHandlers = [];
/******/ 		var currentStatus = "idle";
/******/ 		
/******/ 		// while downloading
/******/ 		var blockingPromises = 0;
/******/ 		var blockingPromisesWaiting = [];
/******/ 		
/******/ 		// The update info
/******/ 		var currentUpdateApplyHandlers;
/******/ 		var queuedInvalidatedModules;
/******/ 		
/******/ 		__webpack_require__.hmrD = currentModuleData;
/******/ 		
/******/ 		__webpack_require__.i.push(function (options) {
/******/ 			var module = options.module;
/******/ 			var require = createRequire(options.require, options.id);
/******/ 			module.hot = createModuleHotObject(options.id, module);
/******/ 			module.parents = currentParents;
/******/ 			module.children = [];
/******/ 			currentParents = [];
/******/ 			options.require = require;
/******/ 		});
/******/ 		
/******/ 		__webpack_require__.hmrC = {};
/******/ 		__webpack_require__.hmrI = {};
/******/ 		
/******/ 		function createRequire(require, moduleId) {
/******/ 			var me = installedModules[moduleId];
/******/ 			if (!me) return require;
/******/ 			var fn = function (request) {
/******/ 				if (me.hot.active) {
/******/ 					if (installedModules[request]) {
/******/ 						var parents = installedModules[request].parents;
/******/ 						if (parents.indexOf(moduleId) === -1) {
/******/ 							parents.push(moduleId);
/******/ 						}
/******/ 					} else {
/******/ 						currentParents = [moduleId];
/******/ 						currentChildModule = request;
/******/ 					}
/******/ 					if (me.children.indexOf(request) === -1) {
/******/ 						me.children.push(request);
/******/ 					}
/******/ 				} else {
/******/ 					console.warn(
/******/ 						"[HMR] unexpected require(" +
/******/ 							request +
/******/ 							") from disposed module " +
/******/ 							moduleId
/******/ 					);
/******/ 					currentParents = [];
/******/ 				}
/******/ 				return require(request);
/******/ 			};
/******/ 			var createPropertyDescriptor = function (name) {
/******/ 				return {
/******/ 					configurable: true,
/******/ 					enumerable: true,
/******/ 					get: function () {
/******/ 						return require[name];
/******/ 					},
/******/ 					set: function (value) {
/******/ 						require[name] = value;
/******/ 					}
/******/ 				};
/******/ 			};
/******/ 			for (var name in require) {
/******/ 				if (Object.prototype.hasOwnProperty.call(require, name) && name !== "e") {
/******/ 					Object.defineProperty(fn, name, createPropertyDescriptor(name));
/******/ 				}
/******/ 			}
/******/ 			fn.e = function (chunkId, fetchPriority) {
/******/ 				return trackBlockingPromise(require.e(chunkId, fetchPriority));
/******/ 			};
/******/ 			return fn;
/******/ 		}
/******/ 		
/******/ 		function createModuleHotObject(moduleId, me) {
/******/ 			var _main = currentChildModule !== moduleId;
/******/ 			var hot = {
/******/ 				// private stuff
/******/ 				_acceptedDependencies: {},
/******/ 				_acceptedErrorHandlers: {},
/******/ 				_declinedDependencies: {},
/******/ 				_selfAccepted: false,
/******/ 				_selfDeclined: false,
/******/ 				_selfInvalidated: false,
/******/ 				_disposeHandlers: [],
/******/ 				_main: _main,
/******/ 				_requireSelf: function () {
/******/ 					currentParents = me.parents.slice();
/******/ 					currentChildModule = _main ? undefined : moduleId;
/******/ 					__webpack_require__(moduleId);
/******/ 				},
/******/ 		
/******/ 				// Module API
/******/ 				active: true,
/******/ 				accept: function (dep, callback, errorHandler) {
/******/ 					if (dep === undefined) hot._selfAccepted = true;
/******/ 					else if (typeof dep === "function") hot._selfAccepted = dep;
/******/ 					else if (typeof dep === "object" && dep !== null) {
/******/ 						for (var i = 0; i < dep.length; i++) {
/******/ 							hot._acceptedDependencies[dep[i]] = callback || function () {};
/******/ 							hot._acceptedErrorHandlers[dep[i]] = errorHandler;
/******/ 						}
/******/ 					} else {
/******/ 						hot._acceptedDependencies[dep] = callback || function () {};
/******/ 						hot._acceptedErrorHandlers[dep] = errorHandler;
/******/ 					}
/******/ 				},
/******/ 				decline: function (dep) {
/******/ 					if (dep === undefined) hot._selfDeclined = true;
/******/ 					else if (typeof dep === "object" && dep !== null)
/******/ 						for (var i = 0; i < dep.length; i++)
/******/ 							hot._declinedDependencies[dep[i]] = true;
/******/ 					else hot._declinedDependencies[dep] = true;
/******/ 				},
/******/ 				dispose: function (callback) {
/******/ 					hot._disposeHandlers.push(callback);
/******/ 				},
/******/ 				addDisposeHandler: function (callback) {
/******/ 					hot._disposeHandlers.push(callback);
/******/ 				},
/******/ 				removeDisposeHandler: function (callback) {
/******/ 					var idx = hot._disposeHandlers.indexOf(callback);
/******/ 					if (idx >= 0) hot._disposeHandlers.splice(idx, 1);
/******/ 				},
/******/ 				invalidate: function () {
/******/ 					this._selfInvalidated = true;
/******/ 					switch (currentStatus) {
/******/ 						case "idle":
/******/ 							currentUpdateApplyHandlers = [];
/******/ 							Object.keys(__webpack_require__.hmrI).forEach(function (key) {
/******/ 								__webpack_require__.hmrI[key](
/******/ 									moduleId,
/******/ 									currentUpdateApplyHandlers
/******/ 								);
/******/ 							});
/******/ 							setStatus("ready");
/******/ 							break;
/******/ 						case "ready":
/******/ 							Object.keys(__webpack_require__.hmrI).forEach(function (key) {
/******/ 								__webpack_require__.hmrI[key](
/******/ 									moduleId,
/******/ 									currentUpdateApplyHandlers
/******/ 								);
/******/ 							});
/******/ 							break;
/******/ 						case "prepare":
/******/ 						case "check":
/******/ 						case "dispose":
/******/ 						case "apply":
/******/ 							(queuedInvalidatedModules = queuedInvalidatedModules || []).push(
/******/ 								moduleId
/******/ 							);
/******/ 							break;
/******/ 						default:
/******/ 							// ignore requests in error states
/******/ 							break;
/******/ 					}
/******/ 				},
/******/ 		
/******/ 				// Management API
/******/ 				check: hotCheck,
/******/ 				apply: hotApply,
/******/ 				status: function (l) {
/******/ 					if (!l) return currentStatus;
/******/ 					registeredStatusHandlers.push(l);
/******/ 				},
/******/ 				addStatusHandler: function (l) {
/******/ 					registeredStatusHandlers.push(l);
/******/ 				},
/******/ 				removeStatusHandler: function (l) {
/******/ 					var idx = registeredStatusHandlers.indexOf(l);
/******/ 					if (idx >= 0) registeredStatusHandlers.splice(idx, 1);
/******/ 				},
/******/ 		
/******/ 				//inherit from previous dispose call
/******/ 				data: currentModuleData[moduleId]
/******/ 			};
/******/ 			currentChildModule = undefined;
/******/ 			return hot;
/******/ 		}
/******/ 		
/******/ 		function setStatus(newStatus) {
/******/ 			currentStatus = newStatus;
/******/ 			var results = [];
/******/ 		
/******/ 			for (var i = 0; i < registeredStatusHandlers.length; i++)
/******/ 				results[i] = registeredStatusHandlers[i].call(null, newStatus);
/******/ 		
/******/ 			return Promise.all(results);
/******/ 		}
/******/ 		
/******/ 		function unblock() {
/******/ 			if (--blockingPromises === 0) {
/******/ 				setStatus("ready").then(function () {
/******/ 					if (blockingPromises === 0) {
/******/ 						var list = blockingPromisesWaiting;
/******/ 						blockingPromisesWaiting = [];
/******/ 						for (var i = 0; i < list.length; i++) {
/******/ 							list[i]();
/******/ 						}
/******/ 					}
/******/ 				});
/******/ 			}
/******/ 		}
/******/ 		
/******/ 		function trackBlockingPromise(promise) {
/******/ 			switch (currentStatus) {
/******/ 				case "ready":
/******/ 					setStatus("prepare");
/******/ 				/* fallthrough */
/******/ 				case "prepare":
/******/ 					blockingPromises++;
/******/ 					promise.then(unblock, unblock);
/******/ 					return promise;
/******/ 				default:
/******/ 					return promise;
/******/ 			}
/******/ 		}
/******/ 		
/******/ 		function waitForBlockingPromises(fn) {
/******/ 			if (blockingPromises === 0) return fn();
/******/ 			return new Promise(function (resolve) {
/******/ 				blockingPromisesWaiting.push(function () {
/******/ 					resolve(fn());
/******/ 				});
/******/ 			});
/******/ 		}
/******/ 		
/******/ 		function hotCheck(applyOnUpdate) {
/******/ 			if (currentStatus !== "idle") {
/******/ 				throw new Error("check() is only allowed in idle status");
/******/ 			}
/******/ 			return setStatus("check")
/******/ 				.then(__webpack_require__.hmrM)
/******/ 				.then(function (update) {
/******/ 					if (!update) {
/******/ 						return setStatus(applyInvalidatedModules() ? "ready" : "idle").then(
/******/ 							function () {
/******/ 								return null;
/******/ 							}
/******/ 						);
/******/ 					}
/******/ 		
/******/ 					return setStatus("prepare").then(function () {
/******/ 						var updatedModules = [];
/******/ 						currentUpdateApplyHandlers = [];
/******/ 		
/******/ 						return Promise.all(
/******/ 							Object.keys(__webpack_require__.hmrC).reduce(function (
/******/ 								promises,
/******/ 								key
/******/ 							) {
/******/ 								__webpack_require__.hmrC[key](
/******/ 									update.c,
/******/ 									update.r,
/******/ 									update.m,
/******/ 									promises,
/******/ 									currentUpdateApplyHandlers,
/******/ 									updatedModules
/******/ 								);
/******/ 								return promises;
/******/ 							}, [])
/******/ 						).then(function () {
/******/ 							return waitForBlockingPromises(function () {
/******/ 								if (applyOnUpdate) {
/******/ 									return internalApply(applyOnUpdate);
/******/ 								} else {
/******/ 									return setStatus("ready").then(function () {
/******/ 										return updatedModules;
/******/ 									});
/******/ 								}
/******/ 							});
/******/ 						});
/******/ 					});
/******/ 				});
/******/ 		}
/******/ 		
/******/ 		function hotApply(options) {
/******/ 			if (currentStatus !== "ready") {
/******/ 				return Promise.resolve().then(function () {
/******/ 					throw new Error(
/******/ 						"apply() is only allowed in ready status (state: " +
/******/ 							currentStatus +
/******/ 							")"
/******/ 					);
/******/ 				});
/******/ 			}
/******/ 			return internalApply(options);
/******/ 		}
/******/ 		
/******/ 		function internalApply(options) {
/******/ 			options = options || {};
/******/ 		
/******/ 			applyInvalidatedModules();
/******/ 		
/******/ 			var results = currentUpdateApplyHandlers.map(function (handler) {
/******/ 				return handler(options);
/******/ 			});
/******/ 			currentUpdateApplyHandlers = undefined;
/******/ 		
/******/ 			var errors = results
/******/ 				.map(function (r) {
/******/ 					return r.error;
/******/ 				})
/******/ 				.filter(Boolean);
/******/ 		
/******/ 			if (errors.length > 0) {
/******/ 				return setStatus("abort").then(function () {
/******/ 					throw errors[0];
/******/ 				});
/******/ 			}
/******/ 		
/******/ 			// Now in "dispose" phase
/******/ 			var disposePromise = setStatus("dispose");
/******/ 		
/******/ 			results.forEach(function (result) {
/******/ 				if (result.dispose) result.dispose();
/******/ 			});
/******/ 		
/******/ 			// Now in "apply" phase
/******/ 			var applyPromise = setStatus("apply");
/******/ 		
/******/ 			var error;
/******/ 			var reportError = function (err) {
/******/ 				if (!error) error = err;
/******/ 			};
/******/ 		
/******/ 			var outdatedModules = [];
/******/ 			results.forEach(function (result) {
/******/ 				if (result.apply) {
/******/ 					var modules = result.apply(reportError);
/******/ 					if (modules) {
/******/ 						for (var i = 0; i < modules.length; i++) {
/******/ 							outdatedModules.push(modules[i]);
/******/ 						}
/******/ 					}
/******/ 				}
/******/ 			});
/******/ 		
/******/ 			return Promise.all([disposePromise, applyPromise]).then(function () {
/******/ 				// handle errors in accept handlers and self accepted module load
/******/ 				if (error) {
/******/ 					return setStatus("fail").then(function () {
/******/ 						throw error;
/******/ 					});
/******/ 				}
/******/ 		
/******/ 				if (queuedInvalidatedModules) {
/******/ 					return internalApply(options).then(function (list) {
/******/ 						outdatedModules.forEach(function (moduleId) {
/******/ 							if (list.indexOf(moduleId) < 0) list.push(moduleId);
/******/ 						});
/******/ 						return list;
/******/ 					});
/******/ 				}
/******/ 		
/******/ 				return setStatus("idle").then(function () {
/******/ 					return outdatedModules;
/******/ 				});
/******/ 			});
/******/ 		}
/******/ 		
/******/ 		function applyInvalidatedModules() {
/******/ 			if (queuedInvalidatedModules) {
/******/ 				if (!currentUpdateApplyHandlers) currentUpdateApplyHandlers = [];
/******/ 				Object.keys(__webpack_require__.hmrI).forEach(function (key) {
/******/ 					queuedInvalidatedModules.forEach(function (moduleId) {
/******/ 						__webpack_require__.hmrI[key](
/******/ 							moduleId,
/******/ 							currentUpdateApplyHandlers
/******/ 						);
/******/ 					});
/******/ 				});
/******/ 				queuedInvalidatedModules = undefined;
/******/ 				return true;
/******/ 			}
/******/ 		}
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/publicPath */
/******/ 	!function() {
/******/ 		__webpack_require__.p = "/_next/";
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/react refresh */
/******/ 	!function() {
/******/ 		if (__webpack_require__.i) {
/******/ 		__webpack_require__.i.push(function(options) {
/******/ 			var originalFactory = options.factory;
/******/ 			options.factory = function(moduleObject, moduleExports, webpackRequire) {
/******/ 				var hasRefresh = typeof self !== "undefined" && !!self.$RefreshInterceptModuleExecution$;
/******/ 				var cleanup = hasRefresh ? self.$RefreshInterceptModuleExecution$(moduleObject.id) : function() {};
/******/ 				try {
/******/ 					originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
/******/ 				} finally {
/******/ 					cleanup();
/******/ 				}
/******/ 			}
/******/ 		})
/******/ 		}
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/compat */
/******/ 	
/******/ 	
/******/ 	// noop fns to prevent runtime errors during initialization
/******/ 	if (typeof self !== "undefined") {
/******/ 		self.$RefreshReg$ = function () {};
/******/ 		self.$RefreshSig$ = function () {
/******/ 			return function (type) {
/******/ 				return type;
/******/ 			};
/******/ 		};
/******/ 	}
/******/ 	
/******/ 	/* webpack/runtime/css loading */
/******/ 	!function() {
/******/ 		var createStylesheet = function(chunkId, fullhref, resolve, reject) {
/******/ 			var linkTag = document.createElement("link");
/******/ 		
/******/ 			linkTag.rel = "stylesheet";
/******/ 			linkTag.type = "text/css";
/******/ 			var onLinkComplete = function(event) {
/******/ 				// avoid mem leaks.
/******/ 				linkTag.onerror = linkTag.onload = null;
/******/ 				if (event.type === 'load') {
/******/ 					resolve();
/******/ 				} else {
/******/ 					var errorType = event && (event.type === 'load' ? 'missing' : event.type);
/******/ 					var realHref = event && event.target && event.target.href || fullhref;
/******/ 					var err = new Error("Loading CSS chunk " + chunkId + " failed.\n(" + realHref + ")");
/******/ 					err.code = "CSS_CHUNK_LOAD_FAILED";
/******/ 					err.type = errorType;
/******/ 					err.request = realHref;
/******/ 					linkTag.parentNode.removeChild(linkTag)
/******/ 					reject(err);
/******/ 				}
/******/ 			}
/******/ 			linkTag.onerror = linkTag.onload = onLinkComplete;
/******/ 			linkTag.href = fullhref;
/******/ 		
/******/ 			document.head.appendChild(linkTag);
/******/ 			return linkTag;
/******/ 		};
/******/ 		var findStylesheet = function(href, fullhref) {
/******/ 			var existingLinkTags = document.getElementsByTagName("link");
/******/ 			for(var i = 0; i < existingLinkTags.length; i++) {
/******/ 				var tag = existingLinkTags[i];
/******/ 				var dataHref = tag.getAttribute("data-href") || tag.getAttribute("href");
/******/ 				if(tag.rel === "stylesheet" && (dataHref === href || dataHref === fullhref)) return tag;
/******/ 			}
/******/ 			var existingStyleTags = document.getElementsByTagName("style");
/******/ 			for(var i = 0; i < existingStyleTags.length; i++) {
/******/ 				var tag = existingStyleTags[i];
/******/ 				var dataHref = tag.getAttribute("data-href");
/******/ 				if(dataHref === href || dataHref === fullhref) return tag;
/******/ 			}
/******/ 		};
/******/ 		var loadStylesheet = function(chunkId) {
/******/ 			return new Promise(function(resolve, reject) {
/******/ 				var href = __webpack_require__.miniCssF(chunkId);
/******/ 				var fullhref = __webpack_require__.p + href;
/******/ 				if(findStylesheet(href, fullhref)) return resolve();
/******/ 				createStylesheet(chunkId, fullhref, resolve, reject);
/******/ 			});
/******/ 		}
/******/ 		// no chunk loading
/******/ 		
/******/ 		var oldTags = [];
/******/ 		var newTags = [];
/******/ 		var applyHandler = function(options) {
/******/ 			return { dispose: function() {
/******/ 				for(var i = 0; i < oldTags.length; i++) {
/******/ 					var oldTag = oldTags[i];
/******/ 					if(oldTag.parentNode) oldTag.parentNode.removeChild(oldTag);
/******/ 				}
/******/ 				oldTags.length = 0;
/******/ 			}, apply: function() {
/******/ 				for(var i = 0; i < newTags.length; i++) newTags[i].rel = "stylesheet";
/******/ 				newTags.length = 0;
/******/ 			} };
/******/ 		}
/******/ 		__webpack_require__.hmrC.miniCss = function(chunkIds, removedChunks, removedModules, promises, applyHandlers, updatedModulesList) {
/******/ 			applyHandlers.push(applyHandler);
/******/ 			chunkIds.forEach(function(chunkId) {
/******/ 				var href = __webpack_require__.miniCssF(chunkId);
/******/ 				var fullhref = __webpack_require__.p + href;
/******/ 				var oldTag = findStylesheet(href, fullhref);
/******/ 				if(!oldTag) return;
/******/ 				promises.push(new Promise(function(resolve, reject) {
/******/ 					var tag = createStylesheet(chunkId, fullhref, function() {
/******/ 						tag.as = "style";
/******/ 						tag.rel = "preload";
/******/ 						resolve();
/******/ 					}, reject);
/******/ 					oldTags.push(oldTag);
/******/ 					newTags.push(tag);
/******/ 				}));
/******/ 			});
/******/ 		}
/******/ 	}();
/******/ 	
/******/ 	/* webpack/runtime/importScripts chunk loading */
/******/ 	!function() {
/******/ 		// no baseURI
/******/ 		
/******/ 		// object to store loaded chunks
/******/ 		// "1" means "already loaded"
/******/ 		var installedChunks = __webpack_require__.hmrS_importScripts = __webpack_require__.hmrS_importScripts || {
/******/ 			"_app-pages-browser_src_lib_cad_DecimationWorker_ts": 1
/******/ 		};
/******/ 		
/******/ 		// no chunk install function needed
/******/ 		// no chunk loading
/******/ 		
/******/ 		function loadUpdateChunk(chunkId, updatedModulesList) {
/******/ 			var success = false;
/******/ 			self["webpackHotUpdate_N_E"] = function(_, moreModules, runtime) {
/******/ 				for(var moduleId in moreModules) {
/******/ 					if(__webpack_require__.o(moreModules, moduleId)) {
/******/ 						currentUpdate[moduleId] = moreModules[moduleId];
/******/ 						if(updatedModulesList) updatedModulesList.push(moduleId);
/******/ 					}
/******/ 				}
/******/ 				if(runtime) currentUpdateRuntime.push(runtime);
/******/ 				success = true;
/******/ 			};
/******/ 			// start update chunk loading
/******/ 			importScripts(__webpack_require__.tu(__webpack_require__.p + __webpack_require__.hu(chunkId)));
/******/ 			if(!success) throw new Error("Loading update chunk failed for unknown reason");
/******/ 		}
/******/ 		
/******/ 		var currentUpdateChunks;
/******/ 		var currentUpdate;
/******/ 		var currentUpdateRemovedChunks;
/******/ 		var currentUpdateRuntime;
/******/ 		function applyHandler(options) {
/******/ 			if (__webpack_require__.f) delete __webpack_require__.f.importScriptsHmr;
/******/ 			currentUpdateChunks = undefined;
/******/ 			function getAffectedModuleEffects(updateModuleId) {
/******/ 				var outdatedModules = [updateModuleId];
/******/ 				var outdatedDependencies = {};
/******/ 		
/******/ 				var queue = outdatedModules.map(function (id) {
/******/ 					return {
/******/ 						chain: [id],
/******/ 						id: id
/******/ 					};
/******/ 				});
/******/ 				while (queue.length > 0) {
/******/ 					var queueItem = queue.pop();
/******/ 					var moduleId = queueItem.id;
/******/ 					var chain = queueItem.chain;
/******/ 					var module = __webpack_require__.c[moduleId];
/******/ 					if (
/******/ 						!module ||
/******/ 						(module.hot._selfAccepted && !module.hot._selfInvalidated)
/******/ 					)
/******/ 						continue;
/******/ 					if (module.hot._selfDeclined) {
/******/ 						return {
/******/ 							type: "self-declined",
/******/ 							chain: chain,
/******/ 							moduleId: moduleId
/******/ 						};
/******/ 					}
/******/ 					if (module.hot._main) {
/******/ 						return {
/******/ 							type: "unaccepted",
/******/ 							chain: chain,
/******/ 							moduleId: moduleId
/******/ 						};
/******/ 					}
/******/ 					for (var i = 0; i < module.parents.length; i++) {
/******/ 						var parentId = module.parents[i];
/******/ 						var parent = __webpack_require__.c[parentId];
/******/ 						if (!parent) continue;
/******/ 						if (parent.hot._declinedDependencies[moduleId]) {
/******/ 							return {
/******/ 								type: "declined",
/******/ 								chain: chain.concat([parentId]),
/******/ 								moduleId: moduleId,
/******/ 								parentId: parentId
/******/ 							};
/******/ 						}
/******/ 						if (outdatedModules.indexOf(parentId) !== -1) continue;
/******/ 						if (parent.hot._acceptedDependencies[moduleId]) {
/******/ 							if (!outdatedDependencies[parentId])
/******/ 								outdatedDependencies[parentId] = [];
/******/ 							addAllToSet(outdatedDependencies[parentId], [moduleId]);
/******/ 							continue;
/******/ 						}
/******/ 						delete outdatedDependencies[parentId];
/******/ 						outdatedModules.push(parentId);
/******/ 						queue.push({
/******/ 							chain: chain.concat([parentId]),
/******/ 							id: parentId
/******/ 						});
/******/ 					}
/******/ 				}
/******/ 		
/******/ 				return {
/******/ 					type: "accepted",
/******/ 					moduleId: updateModuleId,
/******/ 					outdatedModules: outdatedModules,
/******/ 					outdatedDependencies: outdatedDependencies
/******/ 				};
/******/ 			}
/******/ 		
/******/ 			function addAllToSet(a, b) {
/******/ 				for (var i = 0; i < b.length; i++) {
/******/ 					var item = b[i];
/******/ 					if (a.indexOf(item) === -1) a.push(item);
/******/ 				}
/******/ 			}
/******/ 		
/******/ 			// at begin all updates modules are outdated
/******/ 			// the "outdated" status can propagate to parents if they don't accept the children
/******/ 			var outdatedDependencies = {};
/******/ 			var outdatedModules = [];
/******/ 			var appliedUpdate = {};
/******/ 		
/******/ 			var warnUnexpectedRequire = function warnUnexpectedRequire(module) {
/******/ 				console.warn(
/******/ 					"[HMR] unexpected require(" + module.id + ") to disposed module"
/******/ 				);
/******/ 			};
/******/ 		
/******/ 			for (var moduleId in currentUpdate) {
/******/ 				if (__webpack_require__.o(currentUpdate, moduleId)) {
/******/ 					var newModuleFactory = currentUpdate[moduleId];
/******/ 					/** @type {TODO} */
/******/ 					var result;
/******/ 					if (newModuleFactory) {
/******/ 						result = getAffectedModuleEffects(moduleId);
/******/ 					} else {
/******/ 						result = {
/******/ 							type: "disposed",
/******/ 							moduleId: moduleId
/******/ 						};
/******/ 					}
/******/ 					/** @type {Error|false} */
/******/ 					var abortError = false;
/******/ 					var doApply = false;
/******/ 					var doDispose = false;
/******/ 					var chainInfo = "";
/******/ 					if (result.chain) {
/******/ 						chainInfo = "\nUpdate propagation: " + result.chain.join(" -> ");
/******/ 					}
/******/ 					switch (result.type) {
/******/ 						case "self-declined":
/******/ 							if (options.onDeclined) options.onDeclined(result);
/******/ 							if (!options.ignoreDeclined)
/******/ 								abortError = new Error(
/******/ 									"Aborted because of self decline: " +
/******/ 										result.moduleId +
/******/ 										chainInfo
/******/ 								);
/******/ 							break;
/******/ 						case "declined":
/******/ 							if (options.onDeclined) options.onDeclined(result);
/******/ 							if (!options.ignoreDeclined)
/******/ 								abortError = new Error(
/******/ 									"Aborted because of declined dependency: " +
/******/ 										result.moduleId +
/******/ 										" in " +
/******/ 										result.parentId +
/******/ 										chainInfo
/******/ 								);
/******/ 							break;
/******/ 						case "unaccepted":
/******/ 							if (options.onUnaccepted) options.onUnaccepted(result);
/******/ 							if (!options.ignoreUnaccepted)
/******/ 								abortError = new Error(
/******/ 									"Aborted because " + moduleId + " is not accepted" + chainInfo
/******/ 								);
/******/ 							break;
/******/ 						case "accepted":
/******/ 							if (options.onAccepted) options.onAccepted(result);
/******/ 							doApply = true;
/******/ 							break;
/******/ 						case "disposed":
/******/ 							if (options.onDisposed) options.onDisposed(result);
/******/ 							doDispose = true;
/******/ 							break;
/******/ 						default:
/******/ 							throw new Error("Unexception type " + result.type);
/******/ 					}
/******/ 					if (abortError) {
/******/ 						return {
/******/ 							error: abortError
/******/ 						};
/******/ 					}
/******/ 					if (doApply) {
/******/ 						appliedUpdate[moduleId] = newModuleFactory;
/******/ 						addAllToSet(outdatedModules, result.outdatedModules);
/******/ 						for (moduleId in result.outdatedDependencies) {
/******/ 							if (__webpack_require__.o(result.outdatedDependencies, moduleId)) {
/******/ 								if (!outdatedDependencies[moduleId])
/******/ 									outdatedDependencies[moduleId] = [];
/******/ 								addAllToSet(
/******/ 									outdatedDependencies[moduleId],
/******/ 									result.outdatedDependencies[moduleId]
/******/ 								);
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 					if (doDispose) {
/******/ 						addAllToSet(outdatedModules, [result.moduleId]);
/******/ 						appliedUpdate[moduleId] = warnUnexpectedRequire;
/******/ 					}
/******/ 				}
/******/ 			}
/******/ 			currentUpdate = undefined;
/******/ 		
/******/ 			// Store self accepted outdated modules to require them later by the module system
/******/ 			var outdatedSelfAcceptedModules = [];
/******/ 			for (var j = 0; j < outdatedModules.length; j++) {
/******/ 				var outdatedModuleId = outdatedModules[j];
/******/ 				var module = __webpack_require__.c[outdatedModuleId];
/******/ 				if (
/******/ 					module &&
/******/ 					(module.hot._selfAccepted || module.hot._main) &&
/******/ 					// removed self-accepted modules should not be required
/******/ 					appliedUpdate[outdatedModuleId] !== warnUnexpectedRequire &&
/******/ 					// when called invalidate self-accepting is not possible
/******/ 					!module.hot._selfInvalidated
/******/ 				) {
/******/ 					outdatedSelfAcceptedModules.push({
/******/ 						module: outdatedModuleId,
/******/ 						require: module.hot._requireSelf,
/******/ 						errorHandler: module.hot._selfAccepted
/******/ 					});
/******/ 				}
/******/ 			}
/******/ 		
/******/ 			var moduleOutdatedDependencies;
/******/ 		
/******/ 			return {
/******/ 				dispose: function () {
/******/ 					currentUpdateRemovedChunks.forEach(function (chunkId) {
/******/ 						delete installedChunks[chunkId];
/******/ 					});
/******/ 					currentUpdateRemovedChunks = undefined;
/******/ 		
/******/ 					var idx;
/******/ 					var queue = outdatedModules.slice();
/******/ 					while (queue.length > 0) {
/******/ 						var moduleId = queue.pop();
/******/ 						var module = __webpack_require__.c[moduleId];
/******/ 						if (!module) continue;
/******/ 		
/******/ 						var data = {};
/******/ 		
/******/ 						// Call dispose handlers
/******/ 						var disposeHandlers = module.hot._disposeHandlers;
/******/ 						for (j = 0; j < disposeHandlers.length; j++) {
/******/ 							disposeHandlers[j].call(null, data);
/******/ 						}
/******/ 						__webpack_require__.hmrD[moduleId] = data;
/******/ 		
/******/ 						// disable module (this disables requires from this module)
/******/ 						module.hot.active = false;
/******/ 		
/******/ 						// remove module from cache
/******/ 						delete __webpack_require__.c[moduleId];
/******/ 		
/******/ 						// when disposing there is no need to call dispose handler
/******/ 						delete outdatedDependencies[moduleId];
/******/ 		
/******/ 						// remove "parents" references from all children
/******/ 						for (j = 0; j < module.children.length; j++) {
/******/ 							var child = __webpack_require__.c[module.children[j]];
/******/ 							if (!child) continue;
/******/ 							idx = child.parents.indexOf(moduleId);
/******/ 							if (idx >= 0) {
/******/ 								child.parents.splice(idx, 1);
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 		
/******/ 					// remove outdated dependency from module children
/******/ 					var dependency;
/******/ 					for (var outdatedModuleId in outdatedDependencies) {
/******/ 						if (__webpack_require__.o(outdatedDependencies, outdatedModuleId)) {
/******/ 							module = __webpack_require__.c[outdatedModuleId];
/******/ 							if (module) {
/******/ 								moduleOutdatedDependencies =
/******/ 									outdatedDependencies[outdatedModuleId];
/******/ 								for (j = 0; j < moduleOutdatedDependencies.length; j++) {
/******/ 									dependency = moduleOutdatedDependencies[j];
/******/ 									idx = module.children.indexOf(dependency);
/******/ 									if (idx >= 0) module.children.splice(idx, 1);
/******/ 								}
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 				},
/******/ 				apply: function (reportError) {
/******/ 					// insert new code
/******/ 					for (var updateModuleId in appliedUpdate) {
/******/ 						if (__webpack_require__.o(appliedUpdate, updateModuleId)) {
/******/ 							__webpack_require__.m[updateModuleId] = appliedUpdate[updateModuleId];
/******/ 						}
/******/ 					}
/******/ 		
/******/ 					// run new runtime modules
/******/ 					for (var i = 0; i < currentUpdateRuntime.length; i++) {
/******/ 						currentUpdateRuntime[i](__webpack_require__);
/******/ 					}
/******/ 		
/******/ 					// call accept handlers
/******/ 					for (var outdatedModuleId in outdatedDependencies) {
/******/ 						if (__webpack_require__.o(outdatedDependencies, outdatedModuleId)) {
/******/ 							var module = __webpack_require__.c[outdatedModuleId];
/******/ 							if (module) {
/******/ 								moduleOutdatedDependencies =
/******/ 									outdatedDependencies[outdatedModuleId];
/******/ 								var callbacks = [];
/******/ 								var errorHandlers = [];
/******/ 								var dependenciesForCallbacks = [];
/******/ 								for (var j = 0; j < moduleOutdatedDependencies.length; j++) {
/******/ 									var dependency = moduleOutdatedDependencies[j];
/******/ 									var acceptCallback =
/******/ 										module.hot._acceptedDependencies[dependency];
/******/ 									var errorHandler =
/******/ 										module.hot._acceptedErrorHandlers[dependency];
/******/ 									if (acceptCallback) {
/******/ 										if (callbacks.indexOf(acceptCallback) !== -1) continue;
/******/ 										callbacks.push(acceptCallback);
/******/ 										errorHandlers.push(errorHandler);
/******/ 										dependenciesForCallbacks.push(dependency);
/******/ 									}
/******/ 								}
/******/ 								for (var k = 0; k < callbacks.length; k++) {
/******/ 									try {
/******/ 										callbacks[k].call(null, moduleOutdatedDependencies);
/******/ 									} catch (err) {
/******/ 										if (typeof errorHandlers[k] === "function") {
/******/ 											try {
/******/ 												errorHandlers[k](err, {
/******/ 													moduleId: outdatedModuleId,
/******/ 													dependencyId: dependenciesForCallbacks[k]
/******/ 												});
/******/ 											} catch (err2) {
/******/ 												if (options.onErrored) {
/******/ 													options.onErrored({
/******/ 														type: "accept-error-handler-errored",
/******/ 														moduleId: outdatedModuleId,
/******/ 														dependencyId: dependenciesForCallbacks[k],
/******/ 														error: err2,
/******/ 														originalError: err
/******/ 													});
/******/ 												}
/******/ 												if (!options.ignoreErrored) {
/******/ 													reportError(err2);
/******/ 													reportError(err);
/******/ 												}
/******/ 											}
/******/ 										} else {
/******/ 											if (options.onErrored) {
/******/ 												options.onErrored({
/******/ 													type: "accept-errored",
/******/ 													moduleId: outdatedModuleId,
/******/ 													dependencyId: dependenciesForCallbacks[k],
/******/ 													error: err
/******/ 												});
/******/ 											}
/******/ 											if (!options.ignoreErrored) {
/******/ 												reportError(err);
/******/ 											}
/******/ 										}
/******/ 									}
/******/ 								}
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 		
/******/ 					// Load self accepted modules
/******/ 					for (var o = 0; o < outdatedSelfAcceptedModules.length; o++) {
/******/ 						var item = outdatedSelfAcceptedModules[o];
/******/ 						var moduleId = item.module;
/******/ 						try {
/******/ 							item.require(moduleId);
/******/ 						} catch (err) {
/******/ 							if (typeof item.errorHandler === "function") {
/******/ 								try {
/******/ 									item.errorHandler(err, {
/******/ 										moduleId: moduleId,
/******/ 										module: __webpack_require__.c[moduleId]
/******/ 									});
/******/ 								} catch (err2) {
/******/ 									if (options.onErrored) {
/******/ 										options.onErrored({
/******/ 											type: "self-accept-error-handler-errored",
/******/ 											moduleId: moduleId,
/******/ 											error: err2,
/******/ 											originalError: err
/******/ 										});
/******/ 									}
/******/ 									if (!options.ignoreErrored) {
/******/ 										reportError(err2);
/******/ 										reportError(err);
/******/ 									}
/******/ 								}
/******/ 							} else {
/******/ 								if (options.onErrored) {
/******/ 									options.onErrored({
/******/ 										type: "self-accept-errored",
/******/ 										moduleId: moduleId,
/******/ 										error: err
/******/ 									});
/******/ 								}
/******/ 								if (!options.ignoreErrored) {
/******/ 									reportError(err);
/******/ 								}
/******/ 							}
/******/ 						}
/******/ 					}
/******/ 		
/******/ 					return outdatedModules;
/******/ 				}
/******/ 			};
/******/ 		}
/******/ 		__webpack_require__.hmrI.importScripts = function (moduleId, applyHandlers) {
/******/ 			if (!currentUpdate) {
/******/ 				currentUpdate = {};
/******/ 				currentUpdateRuntime = [];
/******/ 				currentUpdateRemovedChunks = [];
/******/ 				applyHandlers.push(applyHandler);
/******/ 			}
/******/ 			if (!__webpack_require__.o(currentUpdate, moduleId)) {
/******/ 				currentUpdate[moduleId] = __webpack_require__.m[moduleId];
/******/ 			}
/******/ 		};
/******/ 		__webpack_require__.hmrC.importScripts = function (
/******/ 			chunkIds,
/******/ 			removedChunks,
/******/ 			removedModules,
/******/ 			promises,
/******/ 			applyHandlers,
/******/ 			updatedModulesList
/******/ 		) {
/******/ 			applyHandlers.push(applyHandler);
/******/ 			currentUpdateChunks = {};
/******/ 			currentUpdateRemovedChunks = removedChunks;
/******/ 			currentUpdate = removedModules.reduce(function (obj, key) {
/******/ 				obj[key] = false;
/******/ 				return obj;
/******/ 			}, {});
/******/ 			currentUpdateRuntime = [];
/******/ 			chunkIds.forEach(function (chunkId) {
/******/ 				if (
/******/ 					__webpack_require__.o(installedChunks, chunkId) &&
/******/ 					installedChunks[chunkId] !== undefined
/******/ 				) {
/******/ 					promises.push(loadUpdateChunk(chunkId, updatedModulesList));
/******/ 					currentUpdateChunks[chunkId] = true;
/******/ 				} else {
/******/ 					currentUpdateChunks[chunkId] = false;
/******/ 				}
/******/ 			});
/******/ 			if (__webpack_require__.f) {
/******/ 				__webpack_require__.f.importScriptsHmr = function (chunkId, promises) {
/******/ 					if (
/******/ 						currentUpdateChunks &&
/******/ 						__webpack_require__.o(currentUpdateChunks, chunkId) &&
/******/ 						!currentUpdateChunks[chunkId]
/******/ 					) {
/******/ 						promises.push(loadUpdateChunk(chunkId));
/******/ 						currentUpdateChunks[chunkId] = true;
/******/ 					}
/******/ 				};
/******/ 			}
/******/ 		};
/******/ 		
/******/ 		__webpack_require__.hmrM = function() {
/******/ 			if (typeof fetch === "undefined") throw new Error("No browser support: need fetch API");
/******/ 			return fetch(__webpack_require__.p + __webpack_require__.hmrF()).then(function(response) {
/******/ 				if(response.status === 404) return; // no update available
/******/ 				if(!response.ok) throw new Error("Failed to fetch update manifest " + response.statusText);
/******/ 				return response.json();
/******/ 			});
/******/ 		};
/******/ 	}();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// module cache are used so entry inlining is disabled
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	var __webpack_exports__ = __webpack_require__("(app-pages-browser)/./src/lib/cad/DecimationWorker.ts");
/******/ 	_N_E = __webpack_exports__;
/******/ 	
/******/ })()
;