# Clinical AI Disclaimer Policy

## Overview

MyOrtho.tech incorporates AI-assisted features to support clinical decision-making in orthodontic treatment planning. This policy governs how AI outputs are presented and used.

## Core Disclaimer

> **AI-assisted recommendation only. Final treatment decisions remain the responsibility of the licensed orthodontist. All AI outputs require clinical review and verification before implementation.**

This disclaimer (`CLINICAL_AI_DISCLAIMER`) is defined in `frontend/src/lib/ai/clinical-intelligence.interfaces.ts` and must be displayed alongside all AI-generated suggestions, scores, and recommendations.

## Scope

AI features covered by this policy include:
- Treatment plan copilot suggestions
- Confidence scores and explainability panels
- Proactive clinical warnings (Kravitz limits, IPR safety, PDL stress)
- Cephalometric analysis interpretations
- Growth prediction estimates
- Treatment simulation projections

## Policy Requirements

1. **Mandatory display:** Every AI suggestion surface must show the clinical disclaimer.
2. **No autonomous action:** AI outputs must not trigger clinical workflows without explicit clinician approval.
3. **Confidence indication:** Confidence levels (`very_high` → `unknown`) must be shown and explained.
4. **Explainability:** Evidence, limitations, and review steps must be accessible for every AI recommendation.
5. **Data accuracy:** AI outputs are only as accurate as the underlying clinical data (scans, prescriptions, simulations). Missing data degrades confidence.
6. **Regulatory:** This system is a clinical decision support tool, not an autonomous medical device. It does not replace clinical judgment or regulatory-cleared diagnostic equipment.

## Enforcement

- The `CLINICAL_AI_DISCLAIMER` constant must not be removed from any AI-facing component.
- AI outputs must never be presented as definitive diagnoses.
- Clinician review and sign-off is required before any AI-suggested treatment plan is approved for manufacturing.
