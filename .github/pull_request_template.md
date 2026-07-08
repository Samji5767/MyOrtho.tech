## Summary

<!-- What changed and why? Provide enough context for a reviewer who wasn't involved in the work. -->



## Type of Change

- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Refactor (no functional change, code quality improvement)
- [ ] Documentation update
- [ ] Database migration (schema change included)
- [ ] Breaking change (existing behavior changes; describe below)

## Testing Done

<!-- What did you test? How? Include unit tests, manual testing steps, or both. -->



## Clinical Safety Check

_Complete this section for any change that touches AI recommendations, clinical data display, or patient-facing outputs. Mark N/A if the change has no clinical output path._

- [ ] No AI output is returned without `disclaimer` populated using the `CLINICAL_DISCLAIMER` constant
- [ ] All AI recommendation objects have `confidence_level` set (never `undefined`)
- [ ] No code path fabricates or interpolates clinical measurements or diagnoses
- [ ] LLM prompts instruct the model not to invent clinical values
- [ ] AI recommendations are logged to the audit log (timestamp, case/patient ID, recommendation, confidence, source)

## TypeScript

- [ ] `tsc --noEmit` passes with zero errors on both backend and frontend

## Breaking Changes

**Does this PR introduce a breaking change?**

- [ ] No
- [ ] Yes — describe what breaks and the migration path:

<!-- If yes, describe: what existing behavior changes, which callers/clients are affected, and how they should update. -->

## Migration Required

**Does this PR include a database migration?**

- [ ] No
- [ ] Yes — migration file(s):

<!-- List the migration filename(s). Confirm the migration is idempotent and follows one-concern-per-file. -->
