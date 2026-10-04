# D/E checklist simplification

Historical capture and trace paths below refer to review output removed on 2026-10-04. The written verification results remain.

Sections D and E now show suitability (the existing three choices), visible
notes, and characteristic fields where needed. Orientation and burner count
retain their typed controls; refrigerator and washing-machine spaces retain
their dimension fields. Descriptive answers and Yes/No controls, not-applicable,
source/date/document fields, and per-item question/upload/history actions are
omitted from these sections.

Completion follows the manual assessment. Optional facts and notes do not mark
a check complete and editing them does not clear the assessment. Existing text
answers appear with notes; editing this combined text saves it as notes.
Comparison and PDF reports preserve those descriptions and do not turn missing
burner counts into zero or missing boolean values into No. No migration or
production deployment was needed.

## Verification on 2026-10-02

- Production build and lint passed.
- All 12 domain/PDF unit tests and 12 database tests passed.
- The D/E persistence and responsive browser test passed in Chromium and WebKit.
  It covers legacy text, note edits, assessments without facts, burner counts,
  dimensions, resetting assessment, and 320/390/1440/1920px layouts.
- English captures in both engines and Vietnamese light/dark captures across
  those four widths were inspected. Vietnamese captures had no overflow or
  browser runtime errors. Evidence is in `.impeccable/de-checklist-review/`.
- The existing checklist/cost smoke test passed in both engines; the existing
  creation/comparison smoke test passed in Chromium. In the reused development
  server, the WebKit creation/comparison test was blocked by the Next.js Dev
  Tools portal intercepting clicks on the mobile Apartments link. Its evidence
  is in `.impeccable/de-checklist-regression/`. This does not certify that
  unrelated navigation smoke test.

## Appliance and gas extension on 2026-10-03

E04 and E07 now include Available/Not available checkboxes as one optional
boolean fact. Neither is selected until availability is recorded; selecting one
clears the other, and unchecking it restores an unknown value. Existing
dimensions, notes and suitability remain independent. E10 adds Toshi, Propane
and Other, with an input shown only for Other. Saved custom text is retained
when switching choices but is displayed/exported only when Other is selected.

The migration adds these definitions to existing collections, preserves custom
support fields and apartment answers, and publishes updates to cached devices.
It is idempotent. New collections use the updated seed. Rapid edits of a new
answer now merge pending saves by apartment, criterion and journey, retaining
one record ID instead of producing duplicate-answer conflicts.

Domain and PDF tests cover boolean validation, unknown versus false, and
translated export labels. Database tests cover preserved answers/custom fields,
published definitions and migration reruns. The existing D/E browser test covers
mutual exclusion, clearing availability, immediate Other entry, all three gas
choices, reload persistence, and 320/390/1440/1920px layouts in both engines.
No production deployment was performed.

Validation passed: production build, lint, 16 domain/PDF tests, 14 database
tests, and eight affected browser cases across Chromium and WebKit (creation,
input persistence, D/E entries and offline reload/reconnect). English captures
at all four widths and Vietnamese/Japanese light/dark samples were inspected.
Localized samples reported no document overflow or browser runtime errors.
Final evidence is in `.local-files/kitchen-tests-final/` and
`.local-files/kitchen-localized/`. The reviewed extension is ready locally;
this does not certify production services or unrelated UI.
