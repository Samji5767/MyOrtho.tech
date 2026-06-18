import logging

logger = logging.getLogger("ai-engine.fdi_numbering")

class ToothNumberingConverter:
    # FDI to Universal mapping dictionary
    # Maxillary Right: 18-11 -> 1-8
    # Maxillary Left: 21-28 -> 9-16
    # Mandibular Left: 31-38 -> 17-24
    # Mandibular Right: 41-48 -> 25-32
    FDI_TO_UNIVERSAL = {
        18: 1, 17: 2, 16: 3, 15: 4, 14: 5, 13: 6, 12: 7, 11: 8,
        21: 9, 22: 10, 23: 11, 24: 12, 25: 13, 26: 14, 27: 15, 28: 16,
        38: 17, 37: 18, 36: 19, 35: 20, 34: 21, 33: 22, 32: 23, 31: 24,
        41: 25, 42: 26, 43: 27, 44: 28, 45: 29, 46: 30, 47: 31, 48: 32
    }

    @classmethod
    def to_universal(cls, fdi: int) -> int:
        return cls.FDI_TO_UNIVERSAL.get(fdi, 0)

    @classmethod
    def to_palmer(cls, fdi: int) -> str:
        """
        Converts FDI to Palmer notation representing tooth position (1-8) and quadrant symbol
        Quadrant symbols: UR (┘), UL (└), LL (┌), LR (┐)
        """
        quadrant = fdi // 10
        tooth_pos = fdi % 10

        if quadrant == 1:
            return f"UR_{tooth_pos}┘"
        elif quadrant == 2:
            return f"UL_└{tooth_pos}"
        elif quadrant == 3:
            return f"LL_┌{tooth_pos}"
        elif quadrant == 4:
            return f"LR_{tooth_pos}┐"
        return f"Unknown_{tooth_pos}"

    @classmethod
    def get_full_numbering(cls, fdi: int) -> dict:
        return {
            "fdi": fdi,
            "universal": cls.to_universal(fdi),
            "palmer": cls.to_palmer(fdi),
            "confidence_score": 0.985
        }
