"""Per-tooth submesh extraction from provider vertex labels.

TGN / MeshSegNet providers return one FDI label per vertex (0 = gingiva /
background). The viewer and downstream manufacturing steps consume per-tooth
STL files, so this module carves the original scan into labelled submeshes.

Vertices are re-indexed from the ORIGINAL scan mesh — no re-centering, no
normalization — so every exported submesh shares the source coordinate frame.

The raw per-vertex labels are also persisted as vertex_labels.json in the
output directory: the job payload does not carry them and they are otherwise
unrecoverable once the job's Redis record expires, which would leave nothing
for vertex-level segmentation editing to correct against.
"""

import json
import logging
import os
from typing import Dict, List, Optional

import numpy as np
import trimesh

logger = logging.getLogger("myortho-ai")

_VALID_FDI = {
    q * 10 + p for q in (1, 2, 3, 4) for p in range(1, 9)
}

MIN_FACES_PER_TOOTH = 20
MIN_FACES_GINGIVA = 20


def _export_submesh(
    mesh: trimesh.Trimesh, face_mask: np.ndarray, out_path: str
) -> bool:
    """Export the faces selected by mask as an STL, preserving coordinates."""
    faces = mesh.faces[face_mask]
    if len(faces) == 0:
        return False
    unique_verts, remapped = np.unique(faces.reshape(-1), return_inverse=True)
    sub = trimesh.Trimesh(
        vertices=mesh.vertices[unique_verts],
        faces=remapped.reshape(-1, 3),
        process=False,
    )
    sub.export(out_path)
    return True


def extract_labeled_meshes(
    file_path: str,
    vertex_labels: List[int],
    output_dir: Optional[str] = None,
) -> Optional[Dict[str, object]]:
    """Split the scan into per-tooth STLs + gingiva.stl from vertex labels.

    Returns {"output_dir": str, "teeth_written": [fdi...], "gingiva_written": bool}
    or None when extraction is impossible (label/vertex count mismatch etc.).
    Never raises — extraction failure must not fail the segmentation job.
    """
    try:
        mesh = trimesh.load(file_path, force="mesh", process=False)
        labels = np.asarray(vertex_labels, dtype=np.int64)
        if len(labels) != len(mesh.vertices):
            logger.warning(
                "Mesh extraction skipped: %d labels for %d vertices (%s)",
                len(labels), len(mesh.vertices), file_path,
            )
            return None

        if output_dir is None:
            stem = os.path.splitext(os.path.basename(file_path))[0]
            output_dir = os.path.join(os.path.dirname(file_path), f"seg_{stem}")
        os.makedirs(output_dir, exist_ok=True)

        # Face label = majority vote of its three vertex labels; ties go to
        # the smallest label so gingiva (0) wins mixed boundary faces.
        face_labels = labels[mesh.faces]  # (F, 3)
        maj = np.sort(face_labels, axis=1)[:, 1]  # median of 3 = majority

        teeth_written: List[int] = []
        for fdi in sorted(set(int(v) for v in np.unique(maj)) & _VALID_FDI):
            mask = maj == fdi
            if int(mask.sum()) < MIN_FACES_PER_TOOTH:
                continue
            out = os.path.join(output_dir, f"tooth_fdi_{fdi}.stl")
            if _export_submesh(mesh, mask, out):
                teeth_written.append(fdi)

        gingiva_mask = maj == 0
        gingiva_written = False
        if int(gingiva_mask.sum()) >= MIN_FACES_GINGIVA:
            gingiva_written = _export_submesh(
                mesh, gingiva_mask, os.path.join(output_dir, "gingiva.stl")
            )

        if not teeth_written:
            logger.warning("Mesh extraction produced no tooth submeshes (%s)", file_path)
            return None

        # Persist the raw labels next to the submeshes so vertex-level
        # corrections have a baseline after the job record expires.
        try:
            with open(os.path.join(output_dir, "vertex_labels.json"), "w", encoding="utf-8") as fh:
                json.dump(
                    {"source_file": os.path.basename(file_path),
                     "vertex_count": int(len(labels)),
                     "labels": [int(v) for v in labels]},
                    fh,
                )
        except OSError as exc:
            logger.warning("Could not persist vertex_labels.json: %s", exc)

        logger.info(
            "Extracted %d tooth meshes (gingiva=%s) to %s",
            len(teeth_written), gingiva_written, output_dir,
        )
        return {
            "output_dir": output_dir,
            "teeth_written": teeth_written,
            "gingiva_written": gingiva_written,
        }
    except Exception as exc:  # noqa: BLE001 — extraction is best-effort
        logger.warning("Mesh extraction failed for %s: %s", file_path, exc)
        return None
