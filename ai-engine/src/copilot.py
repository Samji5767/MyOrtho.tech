import logging
from typing import Optional

import numpy as np

logger = logging.getLogger("ai-engine.copilot")

# Attachment type selection rules indexed by movement type.
# Key: (movement_type, tooth_type) → attachment_label
# Based on Align Technology clinical guidelines and published literature.
_ATTACHMENT_RULES = {
    ("rotation", "premolar"):  "Beveled Horizontal",
    ("rotation", "canine"):    "Vertical Rectangle",
    ("rotation", "incisor"):   "Beveled Horizontal",
    ("extrusion", "any"):      "Extrusion Hook",
    ("intrusion", "any"):      "Intrusion Notch",
    ("torque", "any"):         "Torque-control Ellipsoid",
}

_ROTATION_THRESHOLD_DEG = 2.0


class MyOrthoCopilot:
    """
    Orthodontic clinical decision support.

    Methods that require real LLM or RAG infrastructure raise NotImplementedError
    and document the integration path required.
    """

    def analyze_case_risks(self, displacements: dict) -> dict:
        """
        Evaluate staging displacements, identifying teeth exceeding biological thresholds.
        Thresholds are based on published recommendations for clear aligner movement limits.
        """
        logger.info("Copilot: evaluating biomechanical displacements for risk index")
        warnings = []
        max_trans = 0.0

        for tooth_id, disp in displacements.items():
            trans = disp.get("translation", [0, 0, 0])
            linear_mag = float(np.linalg.norm(trans))
            max_trans = max(max_trans, linear_mag)

            if linear_mag > 0.25:
                warnings.append({
                    "tooth_id": int(tooth_id),
                    "parameter": "translation",
                    "value": round(linear_mag, 3),
                    "risk": "Exceeds safe per-stage translation limit (0.25 mm). Risk of root resorption.",
                })

        # Complexity scoring based on movement magnitude
        if max_trans > 0.3:
            complexity = 80
            assessment = "High Complexity Case"
        elif max_trans > 0.15:
            complexity = 55
            assessment = "Moderate Complexity Case"
        else:
            complexity = 35
            assessment = "Standard Complexity Case"

        return {
            "complexity_score": complexity,
            "max_displacement_mm": round(max_trans, 3),
            "warnings": warnings,
            "risk_assessment": assessment,
        }

    def recommend_attachments(self, displacements: dict) -> list:
        """
        Recommend attachments based on movement type and magnitude.
        Uses a rule-based clinical table — not a learned model.
        Confidence reflects rule coverage, not model probability.

        Note: tooth_type is not currently inferred from tooth_id;
        all rotations are treated as premolar unless FDI 13/23/33/43 (canines).
        """
        logger.info("Copilot: parsing displacements to recommend attachments (rule-based)")
        recommendations = []

        _CANINE_FDI = {13, 23, 33, 43}
        _INCISOR_FDI = {11, 12, 21, 22, 31, 32, 41, 42}

        for tooth_id_str, disp in displacements.items():
            try:
                fdi = int(tooth_id_str)
            except ValueError:
                continue

            rot = disp.get("rotation", [0, 0, 0])
            trans = disp.get("translation", [0, 0, 0])
            yaw_deg = abs(rot[2]) * 180.0 / np.pi

            if fdi in _CANINE_FDI:
                tooth_type = "canine"
            elif fdi in _INCISOR_FDI:
                tooth_type = "incisor"
            else:
                tooth_type = "premolar"

            if yaw_deg > _ROTATION_THRESHOLD_DEG:
                movement_type = "rotation"
                rule_key = (movement_type, tooth_type)
                attach_type = _ATTACHMENT_RULES.get(rule_key, "Beveled Horizontal")
                recommendations.append({
                    "tooth_id": fdi,
                    "type": attach_type,
                    "movement_type": movement_type,
                    "rationale": (
                        f"Yaw rotation {yaw_deg:.1f}° exceeds {_ROTATION_THRESHOLD_DEG}° threshold. "
                        f"{attach_type} attachment indicated per clinical rule table."
                    ),
                    "confidence": 0.72,
                    "disclaimer": (
                        "AI-assisted recommendation only. "
                        "Final treatment decisions remain the responsibility of the licensed orthodontist."
                    ),
                })
            elif trans[1] < -0.1:
                recommendations.append({
                    "tooth_id": fdi,
                    "type": "Extrusion Hook",
                    "movement_type": "extrusion",
                    "rationale": f"Extrusion of {abs(trans[1]):.2f} mm indicated.",
                    "confidence": 0.68,
                    "disclaimer": (
                        "AI-assisted recommendation only. "
                        "Final treatment decisions remain the responsibility of the licensed orthodontist."
                    ),
                })

        return recommendations

    def query_knowledge_base(self, query: str) -> dict:
        """
        Semantic search on orthodontic knowledge base.

        Status: NOT IMPLEMENTED — requires a real RAG pipeline:
          1. Embed clinical literature with sentence-transformers or OpenAI embeddings.
          2. Index into a vector store (pgvector or Chroma).
          3. Perform similarity search and return grounded, cited answers.

        Raises NotImplementedError until a real RAG backend is configured.
        """
        logger.warning(
            "query_knowledge_base called but RAG pipeline is not implemented. "
            "Returning error to prevent fabricated citations from reaching clinicians."
        )
        raise NotImplementedError(
            "The knowledge base RAG pipeline is not yet implemented. "
            "Configure a vector store (pgvector / Chroma) with embedded clinical literature "
            "and set RAG_ENABLED=true in environment to activate this endpoint."
        )
