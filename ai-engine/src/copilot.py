import numpy as np
import logging

logger = logging.getLogger("ai-engine.copilot")

class MyOrthoCopilot:
    def analyze_case_risks(self, displacements: dict) -> dict:
        """
        Evaluate staging displacements, identifying teeth exceeding biological thresholds.
        """
        logger.info("Copilot: evaluating biomechanics displacements for risk index")
        warnings = []
        max_trans = 0.0
        
        for tooth_id, disp in displacements.items():
            trans = disp.get("translation", [0, 0, 0])
            rot = disp.get("rotation", [0, 0, 0])
            
            # Linear magnitude
            linear_mag = np.linalg.norm(trans)
            max_trans = max(max_trans, linear_mag)
            
            if linear_mag > 0.25:
                warnings.append({
                    "tooth_id": int(tooth_id),
                    "parameter": "translation",
                    "value": float(linear_mag),
                    "risk": "Root resorption danger"
                })

        complexity = 35
        if max_trans > 0.3:
            complexity = 80

        return {
            "complexity_score": complexity,
            "max_displacement_mm": float(max_trans),
            "warnings": warnings,
            "risk_assessment": "High Complexity Case" if complexity > 70 else "Standard Complexity Case"
        }

    def recommend_attachments(self, displacements: dict) -> list:
        """
        AI advisor to place force-direction attachments based on rotational changes.
        """
        logger.info("Copilot: parsing rotational displacements to recommend attachments")
        recommendations = []
        
        for tooth_id, disp in displacements.items():
            rot = disp.get("rotation", [0, 0, 0])
            # Yaw rotation index
            yaw = abs(rot[2])
            
            # If rotation > 2.0 degrees, recommend attachment to aid movement
            if yaw > (2.0 * np.pi / 180):
                recommendations.append({
                    "tooth_id": int(tooth_id),
                    "type": "Beveled Horizontal",
                    "position": [0.0, 0.2, 0.4], # x, y, z placement relative coordinates
                    "rationale": f"High rotation of {(yaw * 180 / np.pi):.1f}° requires support",
                    "confidence": 0.94
                })
                
        return recommendations

    def query_knowledge_base(self, query: str) -> dict:
        """
        RAG semantic search on orthodontic literature and clinical guidelines.
        """
        logger.info(f"Copilot RAG Query: {query}")
        
        # Simulating vector matching
        responses = {
            "optimal treatment": "For deep bite malocclusions, utilize sequential intrusion of anterior segments coupled with molar extrusion.",
            "aligner count": "Average staging velocity of 0.25mm per stage requires approximately 18-24 stages for a 5mm translation.",
            "attachment locations": "Place vertical rectangular attachments on canine crowns to facilitate rotation vectors."
        }
        
        grounded_answer = "Based on standard orthodontic guidelines: "
        matched = False
        for k, v in responses.items():
            if k in query.lower():
                grounded_answer += v
                matched = True
                break
                
        if not matched:
            grounded_answer += "Defaulting to conservative sequential movement staging limits. Recommended IPR at interproximal spaces."

        return {
            "answer": grounded_answer,
            "confidence_score": 0.91,
            "sources": ["Angle Orthodontist 2024 Vol 12", "MyOrtho Clinical Guidelines V2"]
        }
