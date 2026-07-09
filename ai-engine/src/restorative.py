import logging

import numpy as np

logger = logging.getLogger("ai-engine.restorative")


class RestorativeSlicerEngine:
    """
    Crown preparation margin detection and thickness verification.

    Status: NOT IMPLEMENTED — both methods require real mesh geometry processing.

    Integration path:
      trace_prep_margins:
        Use trimesh discrete mean curvature to detect the preparation boundary
        loop via curvature-extrema tracing along the mesh boundary edges.
      verify_crown_thickness:
        Use Hausdorff-distance or ray-casting between the preparation surface
        mesh and the outer crown surface to compute minimum thickness per vertex.
    """

    def trace_prep_margins(self, prep_mesh_path: str) -> dict:
        """
        Locate the crown margin preparation line using surface curvature loop detection.
        Raises NotImplementedError — real curvature analysis not yet implemented.
        """
        logger.warning(
            "trace_prep_margins called but geometry processing is not implemented. "
            "Returning error — do not use fabricated margin coordinates for clinical decisions."
        )
        raise NotImplementedError(
            "Crown margin tracing requires trimesh curvature analysis. "
            "Load the mesh, compute discrete mean curvature, and trace boundary extrema. "
            "This endpoint is unavailable until the geometry pipeline is integrated."
        )

    def verify_crown_thickness(
        self,
        margin_line: list,
        outer_crown_vertices: np.ndarray,
        target_material: str = "zirconia",
    ) -> dict:
        """
        Check minimum crown thickness to prevent material shearing.
        Raises NotImplementedError — real geometry analysis not yet implemented.
        """
        logger.warning(
            "verify_crown_thickness called but distance computation is not implemented. "
            "Returning error — do not use hardcoded thickness values for compliance decisions."
        )
        raise NotImplementedError(
            "Crown thickness verification requires Hausdorff-distance or ray-casting "
            "between preparation surface and outer crown geometry. "
            "This endpoint is unavailable until the geometry pipeline is integrated."
        )
