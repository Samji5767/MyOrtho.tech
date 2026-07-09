import logging
import os
from pathlib import Path

import numpy as np

logger = logging.getLogger("ai-engine.dicom_viewer")

try:
    import pydicom

    PYDICOM_AVAILABLE = True
except ImportError:
    PYDICOM_AVAILABLE = False
    logger.warning("pydicom not installed — CBCT DICOM loading is unavailable. Run: pip install pydicom")


class DicomCBCTViewer:
    """
    CBCT DICOM volume loader and MPR slicer.

    load_cbct_volume requires pydicom. If pydicom is not installed, the method
    raises NotImplementedError with installation instructions.
    """

    def load_cbct_volume(self, dicom_dir: str) -> dict:
        """
        Parse CBCT DICOM slices into a 3D numpy volume (Hounsfield units).
        Returns volume shape metadata; the actual numpy array is stored in-process.
        Raises NotImplementedError if pydicom is not installed.
        """
        if not PYDICOM_AVAILABLE:
            raise NotImplementedError(
                "CBCT DICOM loading requires pydicom. Install it: pip install pydicom"
            )

        dicom_path = Path(dicom_dir)
        if not dicom_path.is_dir():
            raise ValueError(f"DICOM directory does not exist: {dicom_dir}")

        dicom_files = sorted(
            dicom_path.glob("*.dcm"),
            key=lambda p: p.name,
        )
        if not dicom_files:
            raise ValueError(f"No .dcm files found in: {dicom_dir}")

        logger.info("DICOM: loading %d slices from %s", len(dicom_files), dicom_dir)
        slices = [pydicom.dcmread(str(f)) for f in dicom_files]

        # Sort by ImagePositionPatient Z to ensure correct slice order
        slices.sort(key=lambda s: float(s.ImagePositionPatient[2]) if hasattr(s, "ImagePositionPatient") else 0)

        pixel_arrays = []
        for s in slices:
            arr = s.pixel_array.astype(np.float32)
            intercept = float(getattr(s, "RescaleIntercept", 0))
            slope = float(getattr(s, "RescaleSlope", 1))
            pixel_arrays.append(arr * slope + intercept)

        volume = np.stack(pixel_arrays, axis=0)  # shape: (slices, rows, cols)

        ps = getattr(slices[0], "PixelSpacing", [0.3, 0.3])
        st = getattr(slices[0], "SliceThickness", 0.4)

        self._volume = volume
        return {
            "volume_shape": volume.shape,
            "pixel_spacing": (float(ps[0]), float(ps[1]), float(st)),
            "loaded_slices": volume.shape[0],
        }

    def extract_mpr_slice(self, volume: np.ndarray, plane: str, slice_index: int) -> np.ndarray:
        """
        Extract an orthogonal MPR slice from a loaded CBCT volume.
        plane: 'axial' | 'coronal' | 'sagittal'
        """
        logger.info("MPR Slicer: extracting %s slice at index %d", plane, slice_index)
        if plane == "axial":
            return volume[slice_index, :, :]
        elif plane == "coronal":
            return volume[:, slice_index, :]
        elif plane == "sagittal":
            return volume[:, :, slice_index]
        else:
            raise ValueError(f"Invalid plane '{plane}': must be 'axial', 'coronal', or 'sagittal'")

    def align_crown_to_root(self, stl_coords: np.ndarray, cbct_coords: np.ndarray) -> np.ndarray:
        """
        Compute rigid registration translation vector aligning crown STL to CBCT space.
        Uses centroid alignment as a starting estimate.
        """
        logger.info("Registering crown STL to CBCT root reference coordinates")
        centroid_stl = np.mean(stl_coords, axis=0)
        centroid_cbct = np.mean(cbct_coords, axis=0)
        return centroid_cbct - centroid_stl
