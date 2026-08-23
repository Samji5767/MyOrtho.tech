/**
 * Real mesh-to-mesh collision / proximity detection between adjacent teeth.
 *
 * Distances are exact closest-point distances between the segmented tooth
 * triangle meshes (via three-mesh-bvh), evaluated under the SAME transforms
 * the 3D scene renders with for the current stage. What is flagged here is
 * exactly what is displayed — including the documented arch-frame
 * approximation used to map anatomical movement components onto scene axes.
 *
 * No estimation and no substitution: a pair is only reported when both tooth
 * meshes are loaded, and intersection is a true BVH triangle-intersection
 * test, not a bounding-box heuristic.
 */
import * as THREE from "three";
import { MeshBVH } from "three-mesh-bvh";
import { SCENE_TO_MM, MM_TO_SCENE } from "./meshAnalysis";

export interface CollisionPair {
  fdiA: number;
  fdiB: number;
  /** Exact closest-point distance in mm; null when farther than the query cap. */
  distanceMm: number | null;
  /** True when the two meshes' triangles actually intersect. */
  intersecting: boolean;
}

export interface ToothForCollision {
  fdi: number;
  /** Geometry re-centred on the tooth centroid (the viewer's convention). */
  geometry: THREE.BufferGeometry;
  /** Tooth centroid in scene units, relative to the arch centre. */
  centroid: [number, number, number];
}

export interface ToothSceneTransform {
  position: [number, number, number];
  rotation: [number, number, number];
}

/** Interproximal contact flag threshold (mm). */
export const CONTACT_MM = 0.5;
/** Distances beyond this are reported as clear (query cap, mm). */
export const QUERY_CAP_MM = 1.5;

// Anatomical arch order; consecutive present teeth are adjacent pairs
// (including the cross-midline 11–21 / 41–31 contacts).
const UPPER_ORDER = [18, 17, 16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26, 27, 28];
const LOWER_ORDER = [48, 47, 46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36, 37, 38];

type BVHGeometry = THREE.BufferGeometry & { boundsTree?: MeshBVH };

const bvhCache = new WeakMap<THREE.BufferGeometry, MeshBVH>();

function getBVH(geometry: THREE.BufferGeometry): MeshBVH {
  let bvh = bvhCache.get(geometry);
  if (!bvh) {
    bvh = new MeshBVH(geometry);
    bvhCache.set(geometry, bvh);
    // three-mesh-bvh accelerates geometry-vs-geometry queries when the other
    // geometry also carries its tree at the conventional property.
    (geometry as BVHGeometry).boundsTree = bvh;
  }
  return bvh;
}

function sceneMatrix(tooth: ToothForCollision, t: ToothSceneTransform): THREE.Matrix4 {
  // Mirror of the viewer's <group position={centroid + t.position} rotation={t.rotation}>:
  // translation to (centroid + stage offset), rotation about the centroid pivot.
  const pos = new THREE.Vector3(
    tooth.centroid[0] + t.position[0],
    tooth.centroid[1] + t.position[1],
    tooth.centroid[2] + t.position[2],
  );
  const quat = new THREE.Quaternion().setFromEuler(
    new THREE.Euler(t.rotation[0], t.rotation[1], t.rotation[2], "XYZ"),
  );
  return new THREE.Matrix4().compose(pos, quat, new THREE.Vector3(1, 1, 1));
}

/**
 * Compute proximity/intersection for every adjacent tooth pair present in
 * `teeth`, under the given per-tooth stage transforms.
 *
 * Returns one entry per adjacent pair of loaded meshes, ordered by arch.
 */
export function computeCollisions(
  teeth: ToothForCollision[],
  transformFor: (fdi: number) => ToothSceneTransform,
): CollisionPair[] {
  const byFdi = new Map(teeth.map(t => [t.fdi, t]));
  const results: CollisionPair[] = [];
  const capScene = QUERY_CAP_MM * MM_TO_SCENE;

  for (const order of [UPPER_ORDER, LOWER_ORDER]) {
    const present = order.filter(fdi => byFdi.has(fdi));
    for (let i = 0; i < present.length - 1; i++) {
      const a = byFdi.get(present[i])!;
      const b = byFdi.get(present[i + 1])!;

      const matA = sceneMatrix(a, transformFor(a.fdi));
      const matB = sceneMatrix(b, transformFor(b.fdi));
      // Matrix taking B's local (centroid) frame into A's local frame.
      const bToA = matA.clone().invert().multiply(matB);

      const bvhA = getBVH(a.geometry);
      getBVH(b.geometry); // attaches boundsTree to b for the accelerated path

      const intersecting = bvhA.intersectsGeometry(b.geometry, bToA);
      if (intersecting) {
        results.push({ fdiA: a.fdi, fdiB: b.fdi, distanceMm: 0, intersecting: true });
        continue;
      }

      const t1 = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
      const t2 = { point: new THREE.Vector3(), distance: 0, faceIndex: 0 };
      const hit = bvhA.closestPointToGeometry(b.geometry, bToA, t1, t2, 0, capScene);
      // maxThreshold is an early-termination hint, not a filter — the query can
      // still return a distance beyond the cap, which we report as clear.
      const distanceMm = hit && hit.distance <= capScene ? hit.distance * SCENE_TO_MM : null;
      results.push({
        fdiA: a.fdi,
        fdiB: b.fdi,
        distanceMm,
        intersecting: false,
      });
    }
  }
  return results;
}

/** FDI numbers involved in an intersection (for in-scene highlighting). */
export function intersectingFdis(pairs: CollisionPair[]): Set<number> {
  const s = new Set<number>();
  for (const p of pairs) {
    if (p.intersecting) { s.add(p.fdiA); s.add(p.fdiB); }
  }
  return s;
}
