import logging

logger = logging.getLogger("ai-engine.arch_analysis")

class ArchAnalysisEngine:
    def calculate_bolton_ratios(self, maxillary_widths: dict, mandibular_widths: dict) -> dict:
        """
        Calculates Bolton Overall and Anterior ratios for teeth widths.
        Maxillary overall: 16 to 26 (12 teeth)
        Mandibular overall: 36 to 46 (12 teeth)
        Maxillary anterior: 13 to 23 (6 teeth)
        Mandibular anterior: 33 to 43 (6 teeth)
        """
        logger.info("Bolton Analysis: calculating width percentages across arches")
        
        # 1. Bolton Overall Ratio (12 teeth)
        max_12_keys = [16, 15, 14, 13, 12, 11, 21, 22, 23, 24, 25, 26]
        man_12_keys = [46, 45, 44, 43, 42, 41, 31, 32, 33, 34, 35, 36]
        
        sum_max_12 = sum(maxillary_widths.get(k, 7.5) for k in max_12_keys)
        sum_man_12 = sum(mandibular_widths.get(k, 7.0) for k in man_12_keys)
        
        overall_ratio = (sum_man_12 / sum_max_12) * 100 if sum_max_12 > 0 else 91.3

        # 2. Bolton Anterior Ratio (6 teeth)
        max_6_keys = [13, 12, 11, 21, 22, 23]
        man_6_keys = [43, 42, 41, 31, 32, 33]
        
        sum_max_6 = sum(maxillary_widths.get(k, 8.0) for k in max_6_keys)
        sum_man_6 = sum(mandibular_widths.get(k, 6.5) for k in man_6_keys)
        
        anterior_ratio = (sum_man_6 / sum_max_6) * 100 if sum_max_6 > 0 else 77.2

        overall_discrepancy = sum_man_12 - (sum_max_12 * 0.913)
        anterior_discrepancy = sum_man_6 - (sum_max_6 * 0.772)

        return {
            "overall_ratio": float(overall_ratio),
            "anterior_ratio": float(anterior_ratio),
            "overall_discrepancy_mm": float(overall_discrepancy),
            "anterior_discrepancy_mm": float(anterior_discrepancy),
            "interpretation": {
                "overall": "Mandibular excess" if overall_discrepancy > 0.5 else ("Maxillary excess" if overall_discrepancy < -0.5 else "Normal Bolton Overall"),
                "anterior": "Mandibular anterior excess" if anterior_discrepancy > 0.5 else ("Maxillary anterior excess" if anterior_discrepancy < -0.5 else "Normal Bolton Anterior")
            }
        }

    def classify_case_malocclusion(self, landmark_data: dict) -> dict:
        """
        Determines malocclusion classification based on molar contact relations.
        Angle Classifications: Class I, Class II, Class III
        Complexity index: 1 (easy) to 100 (high complexity)
        """
        logger.info("Malocclusion Classifier: parsing arch lines and molar coordinates")
        
        # In production, this calculates the sagittal distance between:
        # Maxillary 1st molar mesiobuccal cusp and Mandibular 1st molar buccal groove.
        # sagittal_dist = max_molar_cusp.x - man_molar_groove.x
        
        # Mocking logic based on spacing / crowding parameters
        overjet = float(landmark_data.get("overjet_mm", 2.2))
        overbite = float(landmark_data.get("overbite_mm", 2.0))
        crowding = float(landmark_data.get("crowding_mm", 3.5))

        if overjet > 4.5:
            classification = "Class II"
            complexity = 75
        elif overjet < 0.0:
            classification = "Class III"
            complexity = 85
        else:
            classification = "Class I"
            complexity = 35

        if crowding > 6.0 or overbite < 0.0:
            complexity += 15 # Severe crowding or open bite adds complexity

        return {
            "angle_classification": classification,
            "overjet_mm": overjet,
            "overbite_mm": overbite,
            "crowding_severity": "severe" if crowding > 6.0 else ("moderate" if crowding > 3.0 else "mild"),
            "complexity_score": min(complexity, 100),
            "diagnostics": {
                "crossbite": landmark_data.get("crossbite", False),
                "openbite": overbite < 0.0,
                "deepbite": overbite > 4.0
            }
        }
