import numpy as np
import logging

logger = logging.getLogger("ai-engine.dicom_viewer")

class DicomCBCTViewer:
    def load_cbct_volume(self, dicom_dir: str) -> dict:
        """
        Parses CBCT DICOM slices into a 3D float numpy volume.
        """
        logger.info(f"DICOM: loading CBCT slice directories from: {dicom_dir}")
        # In production:
        # slices = [pydicom.dcmread(os.path.join(dicom_dir, f)) for f in os.listdir(dicom_dir)]
        # volume = np.stack([s.pixel_array for s in slices])
        
        # Simulating volume dimensions (Axial, Coronal, Sagittal grids)
        return {
            "volume_shape": (256, 256, 180),
            "pixel_spacing": (0.3, 0.3, 0.4), # typical CBCT resolution in mm
            "loaded_slices": 180
        }

    def extract_mpr_slice(self, volume: np.ndarray, plane: str, slice_index: int) -> np.ndarray:
        """
        Extracts orthogonal slice along specified plane: 'axial', 'coronal', or 'sagittal'.
        """
        logger.info(f"MPR Slicer: extracting {plane} plane slice at index {slice_index}")
        
        if plane == 'axial':
            return volume[slice_index, :, :]
        elif plane == 'coronal':
            return volume[:, slice_index, :]
        elif plane == 'sagittal':
            return volume[:, :, slice_index]
        else:
            raise ValueError("Invalid orthogonal plane direction")

    def align_crown_to_root(self, stl_coords: np.ndarray, cbct_coords: np.ndarray) -> np.ndarray:
        """
        Aligns surface STL coordinates to CBCT coordinates.
        Calculates rigid registration translation vector.
        """
        logger.info("Registering crown and CBCT roots reference coordinates...")
        
        centroid_stl = np.mean(stl_coords, axis=0)
        centroid_cbct = np.mean(cbct_coords, axis=0)
        
        translation_vector = centroid_cbct - centroid_stl
        return translation_vector
