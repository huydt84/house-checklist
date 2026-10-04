# Collection workspace
Mode: Operate. The user has approved the written implementation plan and code-first design, with no concept tournament or marketing surface.
## Direction contract
THESIS: One shared checklist, evidence for each apartment, fast enough to use while standing in a room.
OWN-WORLD: Cool neutral surfaces, graphite type, deep teal actions, Radix controls, Phosphor icons, Geist and Noto Sans. Restrained, readable, consistent.
STORY: Shortlist, inspect, record, compare. Evidence and uncertainty stay visible.
FIRST VIEWPORT: Compact collection navigation beside a spacious property list; a prominent Add apartment action, concise rows with actual images and facts. Phone navigation collapses below the content.
FORM: User-pinned focused workspace; variance 4, motion 3, density 5. No hero or decorative motion. Signature interaction: open a checklist item to attach evidence without losing the section context.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Built decisions and review status

The user pins above remain authoritative. The implemented first viewport uses authentic-photo slots with neutral Phosphor building placeholders when photos are absent; no supplied real property imagery was available, and no listing imagery was fabricated. This is the documented adaptation of the original “actual images” intention.

The built system is recorded in `DESIGN.md` and `.impeccable/design.json`: semantic cool light/graphite dark themes, a teal action family, Geist with locale-specific Noto fonts, flat rows and bordered panels, Radix controls, restrained transition feedback, and responsive workspace navigation. On phones, members have a full-width identity row, preferences use a single column, and native dates retain visible text and calendar affordances. Decorative labels above Apartments and welcome headings were removed; the functional collection selector label remains.

The finish review in `.impeccable/review/finish-review.md` requested four corrections: mobile identities, full-exemption summaries, narrow preference/date fields, and decorative heading labels. The same reviewer marked all four resolved in `.impeccable/review/verdict.md`, with disposition **ship only at the scope of those four fixes**. This is not a whole-product or cloud-release certification.

The final 67-capture matrix covers sampled EN/JA/VI and light/dark combinations at 320, 390, 1440, and 1920px plus the actual 435px browser viewport. It reports no page-wide overflow or runtime errors; horizontally scrollable detail tabs are intentional bounded regions. Additional welcome and scrolled 320px date captures support the corrected states. The matrix is not a full Cartesian product of every screen, locale, theme, and width. Current PNG captures are evidence; older `validation-*.jpg` contact sheets are not the final review source.

The full 24-test suite passed before the presentation correction batch; build/lint, six domain tests, and the affected browser workflow in both engines passed afterward. Live provider credentials and physical iPhone Safari remain separate pre-release setup and verification, as recorded in `docs/verification.md`.

A subsequent target review found and corrected the question-row apartment-link height to the required 44px. The independent `.impeccable/review/verdict-touch-target.md` records **ship at the scope of this correction**: all 12 measured links across six locale/theme combinations met the 44px target, with no attributable layout regression. Current Questions captures and `.impeccable/review/touch-targets.json` hold the evidence. Build/lint passed after this final CSS correction. The earlier four-fix verdict remains unchanged.

## Apartment criteria search extension

Manual suitability now survives answer and evidence edits. Section B journey criteria are reached through Travel with their full controls for each active journey; the viewing checklist and its badge exclude them. Apartment-wide Search criteria sits to the right of Archive beneath Prepare for viewing, caps its flexible desktop width at 460px, and takes a full row at 700px and below. Grouped viewing, cost, and travel results reuse the existing answer controls with section/person context. Matching ignores case and accents, including Vietnamese đ, across criterion text and journey context. Optional cost records link into Costs; matching journey checks without an active journey offer Add journey. Escape or the 44px Clear action restores the current tab, and tab navigation clears search. Existing tokens, typography, flat surfaces, and imagery remain authoritative; no raster assets were added.

`.impeccable/review/criteria-search-review.md` records **ship at this extension's scope** after reviewing all 24 `criteria-{header,results,card}-{chromium,webkit-mobile}-{320,390,1440,1920}.png` captures. The samples cover Japanese/light at 320px, Vietnamese/dark at 390px, English/light at 1440px, and Vietnamese/light at 1920px in both engines; this is not a full locale/theme matrix. Final mobile card captures use a 1600px height to show footer actions, while mobile header/results captures retain 850px. Build/lint, the current 16 unit tests, 13 database tests, 12 affected browser tests across both engines, and final search/assessment proofs passed. This verifies the local scoped change only; earlier verdicts and limitations remain in force, and no deployment or cloud certification is implied.
