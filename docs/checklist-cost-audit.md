# Checklist and Costs request audit — 2026-10-02

Historical screenshot and matrix paths below refer to review output removed on 2026-10-04. The written audit results remain.

Scope: the requested checklist visibility, individual field completion states across apartment tabs, and housing-cost behavior. This is a review of those changes, not certification of the entire application.

## Implementation integrity

The shared field status component follows the existing teal design system and reports completion with text and icons as well as color. Automatic apartment totals use canonical checklist answers; optional records never enter that calculation. No record-name classification remains.

The audit found three gaps in the previously deployed implementation. They were addressed in one correction batch:

- **P1 — Secondary text and neutral status badges had insufficient light-mode contrast.** In `app/globals.css:1177`, gray helper text and Empty markers on the teal card surface measured 4.20:1; neutral badges also fell below the 4.5:1 threshold for ordinary text. The answered-card secondary-text token now uses the existing teal foreground, producing 6.95:1. Not-applicable card copy and neutral status badges use the normal foreground. Neutral empty-card field styling is preserved. This addresses [WCAG 1.4.3, Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html).

- **P2 — Saved optional-cost fields lacked completion markers.** At `components/screens/Costs.jsx:295` and `:331`, the record editor showed Filled/Empty, but the saved name and amount did not. Costs now renders a marker beside each of these fields, including an Empty marker when a formula cannot resolve its amount. The existing browser workflow reproduced the missing marker before the correction. Category: implementation integrity / field visibility.
- **P2 — Legacy benefit records remained visible.** At `components/screens/Costs.jsx:64`, removing the creation button did not remove existing benefit entries: they could still appear as Cost reduction and reopen an editor. Costs now excludes benefit records from its visible reference ledger and removes the unreachable benefit editor branches. Stored records remain preserved. A local legacy-record fixture reproduced the visible entry before the correction. Category: implementation integrity / requested behavior.

No P0 finding was verified in the requested scope. The P1 and both P2 findings above were corrected. A suspected dropdown tint issue was a false positive: the full CSS cascade and live computed styles show white/neutral empty dropdowns and teal filled dropdowns. The redundant overridden rule was removed; no behavior change was needed.

## Request-by-request behavior

| Request                                                                  | Result                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Recognize the completed 7 of 87 checklist checks                         | Each answered check has a visible Checked badge and teal surface. Empty checks say Not checked. Each individual answer/support/evidence field has its own Filled/Empty marker.                                                               |
| Recognize populated fields inside other cards                            | Overview data/edit fields, Costs inputs/edit fields, saved optional-cost names and amounts, Travel inputs, and external-link inputs use field markers. Navigation/filter selectors do not contribute to completion.                          |
| Monthly housing is Rent + Management only                                | It is a derived display, not an extra charge. If either amount is missing, it stays Unknown; an explicit Not applicable amount contributes zero. The source aggregate in the optional ledger is not substituted for missing rent/management. |
| Final optional Costs section is excluded from all automatic calculations | Every optional charge, discount, payment, and legacy benefit is excluded regardless of name, linked criterion, or formula.                                                                                                                   |
| Building year label                                                      | The input is labeled Building year without a repeated year unit.                                                                                                                                                                             |
| Remove benefits from Costs                                               | No benefit creation, allowance input, benefit summary, or legacy benefit entry is shown in Costs.                                                                                                                                            |
| Provide a usable 24-month expense                                        | A manual 24-month expense estimate is saved as entered. No rent multiplier or date dependency is applied. Zero is valid; clearing the field restores Unknown.                                                                                |
| Delete cost entries                                                      | Optional records offer Delete and Undo. Canonical checklist amounts are removed by clearing their field; Not applicable is a separate explicit state.                                                                                        |

## Completion semantics

Filled describes whether a field has a value, not whether it has been confirmed or meets the renter's requirements. Numeric zero and boolean No count as values. Whitespace and cleared values are empty. Default dropdown selections are values. Notes and evidence can be filled while the main answer remains unchecked; they do not inflate 7/87. Not applicable remains distinct and is excluded from the applicable checklist denominator.

The 24-month housing expense field does not change Travel's separate journey estimate. Travel continues to calculate journey costs from its own scenario frequency and fares.

## Technical audit

| Dimension                | Score            | Evidence and boundary                                                                                                                                                                                                                                           |
| ------------------------ | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Accessibility            | 3/4              | Stable input names, completion descriptions, text/icons, keyboard-operable existing controls. New marker contrasts: light Empty 4.51–4.85:1, light Filled 6.95:1, dark Empty 7.23:1, dark Filled 7.66:1. No screen-reader/device certification claimed.         |
| Performance              | 3/4              | Markers derive from existing local field values; no new request, subscription, animation, or dependency. Runtime/matrix checks pass; no quantitative performance benchmark performed.                                                                           |
| Responsive design        | 3/4              | Existing verification covers 320, 390, 1440, and 1920 px, with compact markers and 44 px Delete controls. Physical-device testing remains outside this audit.                                                                                                   |
| Theming                  | 4/4              | Marker colors and filled-field surfaces use shared light/dark tokens; no new hard-coded color.                                                                                                                                                                  |
| Implementation integrity | 3/4              | Both scope gaps above were verified rather than inferred. The detector reports zero anti-pattern failures and 84 advisory token-scale notes in the broader existing stylesheet; these are documentation/style-scale drift, not 84 confirmed functional defects. |
| **Total**                | **16/20 — Good** | Scoped engineering assessment with the stated verification limits.                                                                                                                                                                                              |

The recurring gap was verifying editable forms without also checking their saved read-only representation. Future field changes should check both within the same browser workflow. Recommended follow-up is to reconcile the broader stylesheet's typography/radius ramp with DESIGN.md; it is not required for the requested behavior. An Impeccable document pass followed by a bounded polish pass is appropriate if that follow-up is requested.

## Final verification

Build and lint pass. Ten domain tests and six real-Postgres tests pass. All twenty-four Chromium/mobile-WebKit browser workflows passed before the final contrast-only CSS correction; the affected checklist/Costs workflow passed again in both engines on the final build. The final forty-case matrix covers five tabs in EN/JA/VI and light/dark at 320, 390, 1440, and 1920 px. It reports no overflow, runtime errors, hidden status badges, oversized markers, or undersized Delete controls. It measures field/helper text and checklist badges against their actual backgrounds with a 4.5:1 minimum; all pass. Forty-eight saved-record markers were checked across the matrix. Evidence is in `.impeccable/review/checklist-costs/matrix.json` and its screenshots.

Deployment `dpl_o6STrabmAnJ1eLJVqcjJY8MYamXV` is Ready at [House Checklist](https://house-checklist-three.vercel.app/). The remote production build succeeded using pnpm 11.25.0, and local personas were not enabled for deployment. Anonymous homepage/session routes return 200 with local authentication disabled. No schema migration or production rental-data edit was made for this audit.

The signed-in production workspace was reloaded and checked: original progress remains 7/87, the original optional ¥50,000 reference retains its name and amount, its two fields show Filled, and blank canonical inputs show Empty. Live computed colors confirm the contrast correction on both answered-card helper text and neutral status badges. The workspace reports Saved. Proof: `docs/deployment/checklist-cost-audit-live.jpg`.
