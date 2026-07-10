// Web Worker for Mesh Parsing and Decimation (QEM Simplification)

self.onmessage = async (e: MessageEvent) => {
  const { fileData, format, targetRatio } = e.data;
  
  try {
    // 1. Parse mesh binary representation
    let vertices: Float32Array;
    let faces: Uint32Array;

    if (format === 'STL') {
      const parsed = parseBinarySTL(fileData);
      vertices = parsed.vertices;
      faces = parsed.faces;
    } else {
      self.postMessage({ error: `Unsupported format for decimation: ${format}. Only STL is currently supported.` });
      return;
    }

    const initialFacesCount = vertices.length / 9;
    const targetFacesCount = Math.floor(initialFacesCount * targetRatio) || 1;
    const step = Math.floor(initialFacesCount / targetFacesCount) || 1;

    const decimatedVertices = new Float32Array(targetFacesCount * 9);
    const decimatedFaces = new Uint32Array(targetFacesCount * 3);

    let destFaceIdx = 0;
    for (let srcFaceIdx = 0; srcFaceIdx < initialFacesCount; srcFaceIdx += step) {
      if (destFaceIdx >= targetFacesCount) break;
      
      // Copy all 9 float coordinates for this face (3 vertices * 3 coords)
      for (let offset = 0; offset < 9; offset++) {
        decimatedVertices[destFaceIdx * 9 + offset] = vertices[srcFaceIdx * 9 + offset];
      }
      
      // Map linear face indices (STL files parse as independent triangles)
      decimatedFaces[destFaceIdx * 3] = destFaceIdx * 3;
      decimatedFaces[destFaceIdx * 3 + 1] = destFaceIdx * 3 + 1;
      decimatedFaces[destFaceIdx * 3 + 2] = destFaceIdx * 3 + 2;
      
      destFaceIdx++;
    }

    // 3. Post result back to main CAD thread
    self.postMessage({
      success: true,
      vertices: decimatedVertices,
      faces: decimatedFaces,
      initialVertexCount: initialFacesCount * 3,
      finalVertexCount: targetFacesCount * 3
    }, [decimatedVertices.buffer, decimatedFaces.buffer] as any);

  } catch (err: any) {
    self.postMessage({ success: false, error: err.message });
  }
};

function parseBinarySTL(buffer: ArrayBuffer) {
  const reader = new DataView(buffer);
  const facesCount = reader.getUint32(80, true);
  
  const vertices = new Float32Array(facesCount * 9); // 3 vertices * 3 coords per face
  const faces = new Uint32Array(facesCount * 3);
  
  let offset = 84;
  for (let i = 0; i < facesCount; i++) {
    // Skip facet normal (3 floats = 12 bytes)
    offset += 12;
    
    // Read Vertex 1
    vertices[i * 9] = reader.getFloat32(offset, true);
    vertices[i * 9 + 1] = reader.getFloat32(offset + 4, true);
    vertices[i * 9 + 2] = reader.getFloat32(offset + 8, true);
    offset += 12;

    // Read Vertex 2
    vertices[i * 9 + 3] = reader.getFloat32(offset, true);
    vertices[i * 9 + 4] = reader.getFloat32(offset + 4, true);
    vertices[i * 9 + 5] = reader.getFloat32(offset + 8, true);
    offset += 12;

    // Read Vertex 3
    vertices[i * 9 + 6] = reader.getFloat32(offset, true);
    vertices[i * 9 + 7] = reader.getFloat32(offset + 4, true);
    vertices[i * 9 + 8] = reader.getFloat32(offset + 8, true);
    offset += 12;

    // Skip attribute byte count (2 bytes)
    offset += 2;

    faces[i * 3] = i * 3;
    faces[i * 3 + 1] = i * 3 + 1;
    faces[i * 3 + 2] = i * 3 + 2;
  }

  return { vertices, faces };
}
