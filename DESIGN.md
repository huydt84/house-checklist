---
name: House Checklist
description: A restrained rental-search workspace for shared facts, evidence, and decisions.
colors:
  bg: "#f5f7f7"
  surface: "#fff"
  surface-soft: "#eef2f2"
  text: "#242e31"
  muted: "#606e71"
  line: "#dce3e3"
  accent: "#17675f"
  accent-hover: "#10534c"
  accent-soft: "#e6f1ed"
  accent-text: "#155a52"
  danger: "#a33737"
  danger-soft: "#fff0ee"
  amber: "#80541c"
  amber-soft: "#fbf0d9"
  dark-bg: "#141c1e"
  dark-surface: "#1b2528"
  dark-surface-soft: "#243033"
  dark-text: "#e1e9e9"
  dark-muted: "#a4b3b6"
  dark-line: "#354246"
  dark-accent: "#78c7b8"
  dark-accent-hover: "#99d8cc"
  dark-accent-soft: "#203e37"
  dark-accent-text: "#a0dece"
  dark-danger: "#f4a1a1"
  dark-danger-soft: "#3d2729"
  dark-amber: "#edd097"
  dark-amber-soft: "#423722"
typography:
  headline:
    fontFamily: "Geist, Noto Sans, Noto Sans JP, sans-serif"
    fontSize: "clamp(28px, 2.5vw, 36px)"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-1.3px"
  title:
    fontFamily: "Geist, Noto Sans, Noto Sans JP, sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.45px"
  subheading:
    fontFamily: "Geist, Noto Sans, Noto Sans JP, sans-serif"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "Geist, Noto Sans, Noto Sans JP, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  button:
    fontSize: "13px"
    fontWeight: 600
    lineHeight: 1.5
  input:
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.5
  detail:
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  tag: "4px"
  field: "5px"
  control: "6px"
  menu-trigger: "7px"
  panel: "8px"
  dialog: "10px"
spacing:
  compact: "8px"
  control-gap: "10px"
  small: "12px"
  medium: "16px"
  row-gap: "20px"
  section: "24px"
  panel: "28px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.surface}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-ghost:
    textColor: "{colors.text}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  button-danger:
    textColor: "{colors.danger}"
    typography: "{typography.button}"
    rounded: "{rounded.control}"
    padding: "10px 17px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.input}"
    rounded: "{rounded.field}"
    padding: "11px 12px"
  navigation-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    typography: "{typography.button}"
    rounded: "{rounded.field}"
    padding: "11px 13px"
  chip:
    backgroundColor: "{colors.surface-soft}"
    textColor: "{colors.muted}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  chip-teal:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-text}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  chip-amber:
    backgroundColor: "{colors.amber-soft}"
    textColor: "{colors.amber}"
    rounded: "{rounded.tag}"
    padding: "4px 8px"
  panel:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.panel}"
    padding: "28px"
  checklist-item:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "26px"
  segmented-selected:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.accent-text}"
    typography: "{typography.button}"
    rounded: "{rounded.tag}"
    padding: "9px 14px"
---

# Design System: House Checklist

## Overview

**Creative North Star: "Focused Operate workspace"**

The user-pinned direction is a quiet, practical workspace: cool neutral surfaces, graphite text, and one teal action family. Information density is moderate, with generous space around individual records and compact navigation. The hierarchy supports reading, editing, and comparing evidence on a phone during a viewing.

The system uses flat lists, fine dividers, restrained panels, Radix controls, and Phosphor icons. It supports light and dark themes with the same roles and hierarchy. The chosen direction excludes marketing heroes, scroll pinning, and decorative motion; the existing signed-out entry is a simple access screen, not a reusable display or marketing pattern. User pins remain variance 4, motion 3, and density 5.

**Key Characteristics:**

- Cool neutral fields with a single teal action family.
- Readable multilingual content and controls that reflow on phones.
- Flat records and panels, with lift reserved for overlays and floating controls.
- Facts, evidence, uncertainty, and personal suitability remain visibly distinct.

This is a scan of the built implementation in `app/globals.css`, `app/layout.js`, shared controls, and workspace screens, checked against representative current captures. `PRODUCT.md` owns product truth; `.impeccable/surfaces/workspace.md` owns the surface direction. The finish verdicts ship the four reviewed corrections and the subsequent question-link target correction only. It does not certify the whole product, cloud providers, or physical iPhone Safari. See `docs/verification.md` for the verification boundary.

## Colors

The palette pairs cool paper and white in light mode with graphite fields in dark mode. Token names follow the source CSS roles. `dark-` entries describe the values applied to those same roles by the root dark-theme attribute; use semantic CSS variables in components rather than hard-coding a theme.

### Primary

- **Deep teal action:** `accent` and `accent-hover` identify primary actions and selected outlines. Dark mode uses a lighter teal for those same purposes.
- **Quiet teal state:** `accent-soft` and `accent-text` carry active navigation, selected status chips, and evidence-related actions. Primary button text uses the current theme's `surface` role.

### Neutral

- **Cool field:** `bg` is the page ground; `surface` holds controls, records, and panels.
- **Soft inset:** `surface-soft` distinguishes thumbnails, neutral chips, inactive segmented controls, and hover fills.
- **Graphite hierarchy:** `text` is primary information; `muted` is secondary explanation and metadata; `line` supplies dividers and control boundaries.

### Semantic states

`danger` and `danger-soft` belong to destructive actions, errors, and retry failures. `amber` and `amber-soft` carry warnings, incomplete calculations, and qualifying states. They are semantic colors, not additional brand accents. State labels remain visible alongside color.

**The Semantic Color Rule.** Reuse a color by its role and theme, with a written state label; do not assign new decorative accents to individual screens.

## Typography

**Primary font:** Geist. **Japanese:** Noto Sans JP. **Vietnamese:** Noto Sans. The three families are loaded in `app/layout.js`; language selectors put the relevant Noto family first. Labels and controls inherit the active language family.

The type ramp is compact and task-oriented, with semibold headings rather than a separate display face. The frontmatter captures shared desktop roles. Page headings become 29px with -1px tracking at 700px and below, and 26px below 360px. The mobile root size is 14px. Text inputs become 16px on phones, while labels remain smaller. Secondary metadata uses 10–12px locally; do not promote that range to body or editable input text.

- **Headline:** page identity, paired with a short muted description.
- **Title:** section headings; **subheading:** record and criterion titles.
- **Body:** prose and inherited reading text; explanations commonly use line-height 1.7–1.8.
- **Label:** field names and navigation; **detail:** secondary descriptions.
- **Button and input:** dedicated compact control typography without uppercase transformation.

Cost figures use restrained medium weights and selected tabular numerals for row amounts and counts. The entry screen's larger heading and the overview progress numeral are local compositions, not a general display scale.

**The Language First Rule.** Preserve the active locale's font, allow labels and content to wrap, and give editable names, destinations, and dates enough width before reducing type size.

## Layout

The desktop shell has a sticky sidebar beside a flexible workspace. The sidebar is 240px, reduces to 210px at 1250px, then 180px at 900px. The main content has a maximum width of 1580px and starts with 44px vertical and 48px horizontal padding. At 1700px and above, top padding increases to 60px and list columns widen. Settings use a narrower 880px content stack.

Page headers with PDF export stack their actions beneath the title at 1250px and below. The action row spans the content width and aligns left, wrapping only when its buttons need more space. This prevents Prepare for viewing from wrapping inside a half-width action group while unused space remains beside it. The scoped captures and measurements are in `.impeccable/review/header-responsive/`.

At 700px and below, the sidebar becomes a fixed bottom navigation bar, and the sticky workspace bar is 88px high rather than 62px. Main padding becomes 28px 20px with 110px below the content; below 360px, side padding becomes 15px. The bottom navigation includes the safe-area inset. The collection menu and save state stay in the top bar. Three independent controls sit at the top right: a language dropdown, a sun/moon button that switches light and dark, and a profile menu with the user’s name and sign out. On phones the language uses its short code, the profile uses an avatar with the full name in its menu, and save status occupies a second header row. New users initially follow the system theme; clicking the theme button saves an explicit light/dark preference.

Lists use aligned desktop columns and border-separated rows. On phones, each property uses a full-width identity area with costs and progress below it. Member names and emails occupy a full row before role and revoke controls. Preference forms use one column at 700px and below; generic two-column forms collapse below 360px, and dialog forms collapse at 700px. These changes preserve long values and native date controls.

Checklist navigation switches from a sticky side list to a section selector at 900px. The comparison table becomes an explicit pair view at 700px, with a sticky pair selector below the top bar. Tab strips may scroll within their own boundary; the document itself must not overflow horizontally. Full viewing mode removes the surrounding sidebar and bottom navigation and caps the main area at 1200px.

The frontmatter spacing entries are recurring measurements extracted from the build, not an invented uniform grid. Common gaps fall between 8px and 24px; panels use larger internal space. Preserve the relationships between field label, control, helper text, and section rather than forcing every local measurement onto a new scale.

**The Reflow Before Compression Rule.** Stack identity and form content on narrow screens before squeezing it into unreadable columns.

## Elevation & Depth

Most depth comes from the contrast between the page ground, surface, soft fill, and fine border. Resting record rows and panels are flat. Select menus, account menus, dialogs, and the comparison tray share one diffuse shadow. The dialog backdrop uses a translucent graphite overlay with a 3px blur. Exact shadow and overlay values live in `.impeccable/design.json` because the frontmatter schema does not support them.

**The Flat Workspace Rule.** Keep ordinary content flat; reserve shadow for a floating control or an overlay that must read above the current context.

Motion is limited to short color/border transitions and an overlay fade (150ms), plus a 1.8s loading pulse. Reduced-motion mode disables animation, transitions, and smooth scrolling. There is no decorative motion system or scroll pinning.

## Shapes

Corners are gently squared rather than pill-shaped: compact tags use the smallest shared radius; controls, fields, panels, and dialogs step upward as recorded in the frontmatter. A 1px semantic border is the recurring boundary. Avatars and question icons may be circular; that local identity language does not change the shape of actions and fields.

Phosphor icons are line-based and normally paired with text. Icon-only controls carry an accessible label. Property and file thumbnails have soft neutral grounds and restrained borders. When no real property photo is supplied, show the existing honest building placeholder; never fabricate listing imagery.

### Brand assets

The original house-and-check mark uses white rounded strokes on deep teal (`accent`, `#17675f`). Browser and installation icons share this geometry; the SVG and ordinary PNGs have a rounded teal field, while Apple and maskable icons use a full square field for platform masking. The 1200 × 630 sharing preview pairs the mark with Geist, cool paper (`bg`, `#f5f7f7`), and graphite (`text`, `#242e31`). Its copy describes the rental shortlist, viewing notes, and comparison purpose without exposing user or apartment data.

Regenerate committed assets with `pnpm assets:brand` from `scripts/brand-assets.mjs`: SVG, 16/32/48px favicon frames, 180px Apple icon, 192/512px installation icons, a 512px maskable icon, and the sharing preview. `assets/brand/README.md` records the vector provenance and bundled Geist font license. Preserve this shared mark and palette when extending browser, installation, or sharing assets.

## Components

### Buttons

Primary buttons are teal; secondary buttons are surface-filled with a fine border; ghost buttons keep a transparent ground; danger buttons use danger text and border. Controls have a minimum height of 44px, with 44px square icon controls. Primary hover deepens or lightens teal according to theme; secondary and ghost hover use the soft surface. Disabled buttons reduce opacity and expose a disabled cursor. Focus uses a 3px accent outline offset by 3px.

Text actions use the accent-text role and a minimum height of 44px, including apartment links within question rows. The follow-up target review measured all 12 sampled question links at or above 44px across six locale/theme combinations.

### Chips

Compact rectangular chips carry neutral, teal, or amber state labels. They wrap text and have no independent interaction behavior. Use explicit labels for uncertain, confirmed, and workflow states instead of relying on hue alone.

### Cards / Containers

Use bordered surface panels for related editable information. Standard panel padding is the frontmatter value and becomes 21px 18px on phones. Checklist items use the tighter control radius and their own inset. Keep list rows as rows rather than placing each fact in a separate card. Image placeholders and file previews use the soft surface.

### Inputs / Fields

Labels sit above full-width controls with a 7px gap. Text fields have a fine border, surface fill, 44px minimum height, and the field radius. Hover changes the border to muted; focus uses the shared accent outline. Textareas resize vertically and begin at 88px. Native date fields retain room for their calendar affordance. Radix select triggers match the field vocabulary; highlighted menu options use the quiet teal fill.

Errors use a uniform danger border and a soft danger background with an alert role. Do not reintroduce the removed accented-edge error treatment.

### Navigation

Apartment rows and every detail tab expose the same Status and Viewing status
dropdowns. Decisions are Considering (the creation default), Disqualified, or
Shortlisted; Viewed / Not Viewed is independent of scheduling and decisions.
Owners and editors can Archive or Restore from either surface. Archived details
show an explicit Archived label. The controls wrap on phones and remain read-only
for viewers. Add apartment includes Name, Address, and Google Maps URL; Address
and Google Maps URL can also be changed in the Overview edit form.

Rows with a saved Google Maps URL expose a MapPin link beside the property facts,
opening the saved destination in a new tab. Archive uses the danger color in both
the list and detail controls and opens a confirmation dialog naming the property.
The dialog explains that data is retained and can be restored, focuses Cancel on
opening, and accepts Cancel or Escape without changing the property. Restore
remains a secondary action. Copy is available in EN/JA/VI. The property-state
browser tests verify both browser engines, light/dark themes, and widths of 320,
390, 1440, and 1920px; build, lint, domain, and database tests also pass.

The collection menu includes Rename collection for owners and editors on both
desktop and phone. Property headers offer Rename property across detail tabs.
Both use the shared focused dialog with one prefilled name field, Cancel, and
Save changes. Names update in navigation and lists after saving on the device;
the existing top-bar synchronization state reports server progress.

Desktop navigation uses muted text and line icons. Hover adds soft fill; the active item has quiet teal fill and semibold accent text. Detail tabs use a thin active underline rather than a filled card. Mobile navigation uses icons with short labels and a clear teal active state. Preserve the functional collection selector label; it identifies a control rather than decorating a page title.

### Collections navigation

The top-bar collection name links to that collection's Apartments list. House Checklist links to Collections (`/?page=collections`) from the desktop sidebar and beside save status on the second mobile header row. The first mobile row separates the collection link from its 44px square switcher; long header names truncate while the list shows the full name. Native links retain URL/history behavior and the existing unsaved-form guard; entering a collection clears property and filter scope. Collection links and the mobile brand retain 44px minimum heights, shared visible keyboard focus, and accent/underline hover feedback.

Collections use flat divided rows with a semibold name-and-Phosphor-arrow link (18px desktop, 16px phone), a written role chip, and an Edit collection secondary action for owners/editors into the chosen collection's existing Preferences form. Phone rows stack identity above Edit collection; the page title stacks above Create collection. Create collection reuses the existing focused name dialog with a 120-character limit, and its list-page button is disabled offline with explanatory text. The empty state uses the shared treatment. The mobile brand's 11px text preserves the compact header role; these local sizes do not extend shared tokens. `.impeccable/review/collections-navigation/finish-review.md` records ship at this extension's scope after inspecting all 11 captures in its `matrix.json`.

### Checklist management

Owners and editors can open Edit checklist from the collection menu. Preferences includes a checklist panel with help text and an Edit checklist link for owners/editors or a view-only Checklist link for viewers. The checklist header names the active collection. The existing editor already supports adding, editing, reordering, archiving, and restoring checks while keeping apartment answers; this extension makes that editor easier to reach. After a successful save, the list follows the saved check's section and archive state. New checks append after all criteria in their section, including archived criteria. These entry points reuse the shared menu, link, and panel treatments.

### Checklist answers and evidence

Each item keeps its criterion, answer, supporting fields, evidence disclosure, and manual suitability in one context. The answer control varies by data type; boolean and suitability choices use segmented controls with a bordered surface for the selected choice. Evidence opens within the same item. Stable criterion identifiers and source labels are functional metadata.

Keep the displayed answer, evidence source, verification state, and personal suitability distinct. Unchecked and not-applicable answers remain explicit. Cost records use type-aware summaries: a full exemption includes its target and period rather than being labeled as an unknown amount.

Checklist completion uses persistent icon-and-text status badges at every width, a teal surface and outline for answered items, and a neutral inset for not-applicable items. Section navigation and the mobile selector include answered/applicable counts; the section heading keeps its count on phones. Evidence-only notes do not mark an item answered.

Individual data fields inside apartment cards use Filled/Empty markers with a checkmark or open circle, plus teal input styling for filled values. This applies to Overview metadata and editing, checklist answer/support/evidence fields, Costs forms, Travel forms, and external-link dialogs. Markers update immediately, treat zero and No as meaningful values, and treat whitespace-only text as empty. Not-applicable checklist cards retain their own neutral state. Field names remain unchanged for assistive technology; status is exposed as a description. Navigation and filter controls do not carry data-entry completion markers.

Sections D and E use a simpler entry form: the same three suitability choices,
visible notes, and characteristic fields only (orientation, burner count,
appliance availability and space dimensions, and gas provider type). E04/E07
offer mutually exclusive Available/Not available checkboxes; clearing the selected
choice restores an unknown value. E10 offers Toshi, Propane and Other, with a
free-text input shown only for Other. They omit the duplicate descriptive or Yes/No
answer, not-applicable checkbox, evidence accordion, and per-item question,
upload, and history actions. Suitability determines completion in these sections;
editing notes or characteristic fields preserves it. Existing descriptive answers
appear alongside notes and remain available in comparison and PDF reports.

Monthly housing is the derived rent plus management fee, with unknown inputs kept unknown and explicit not-applicable fees treated as zero. All entries in the final optional Costs section are reference records excluded from every automatic total, regardless of their names, types, or links to checklist amounts. The cost summary has three figures: upfront personal cash, monthly housing, and a manually entered 24-month expense estimate. The estimate has its own input, remains unknown until entered, and does not depend on dates or other charges. Costs has no benefit creation control or separate benefit summary. Cost rows offer Delete with Undo; phone descriptions occupy a full-width line above amounts and actions.

### Apartment criteria search and Travel placement

The apartment-wide Search criteria field sits to the right of Archive beneath Prepare for viewing. It uses the existing labelled input, muted placeholder, focus treatment, and teal/neutral roles; its flexible desktop width is capped at 460px. At 700px and below it occupies a full-width row. The clear action is 44px square. Escape or Clear restores the current tab; changing tabs clears the search.

Results group viewing, cost, and travel criteria with section and person context, reusing the full answer control and manual suitability rather than a separate editing form. Matching ignores case and accents, including Vietnamese đ, and covers criterion codes, labels, guidance, supporting field labels, and journey names, people, origins, and destinations. Optional cost, payment, and adjustment records use flat text links into Costs. A matching journey criterion without an active journey offers the existing Add journey action.

Search uses every stored translation of criterion labels, guidance, supporting fields, and section names, independently of the interface language. For example, “deposit” finds H03 in Vietnamese; results keep the selected interface language. Mixed-language keywords and Vietnamese text without accents are supported.

Section B journey criteria live in Travel, where each active journey retains its full controls. The apartment viewing checklist and its completion badge exclude journey criteria. Editing an answer or its evidence preserves the user's manual suitability. This extension introduces no new visual tokens or raster assets; `.impeccable/review/criteria-search-review.md` records a scoped ship verdict and its verification limits.

### Conflicts and save state

The persistent top bar distinguishes saved, local draft, synchronization, and retry states. Conflict resolution places the saved value beside an editable local draft on desktop and stacks them on phones. Keep both versions and explicit resolution controls legible; preserve the user's ability to understand what will be kept.

## Do's and Don'ts

### Do:

- **Do** use semantic theme roles and the active locale's font.
- **Do** preserve 44px targets for reusable controls and visible keyboard focus.
- **Do** give identities, long text, and native dates full width when narrow columns impair reading.
- **Do** keep evidence, uncertainty, and manual suitability visible as separate information.
- **Do** verify affected layouts at 320, 390, 1440, and 1920px in both themes and the supported locales.
- **Do** use authentic supplied property images or the honest neutral placeholder.

### Don't:

- **Don't** add a marketing hero, scroll pinning, or decorative motion to this Operate workspace.
- **Don't** reintroduce decorative labels above page headings; functional selector labels and stable identifiers remain valid.
- **Don't** encode missing values as zero, known exemptions as unknown amounts, or state through color alone.
- **Don't** replace flat records with nested cards or add shadows to ordinary content panels.
- **Don't** treat the scoped finish verdicts as whole-product or cloud-release certification.


## October 2026 UX audit

The shortlist identifies Monthly housing and explains missing rent or management
fees with a direct Costs link. Compact mobile thumbnails leave room for long
names, and the cost column starts at the row edge. The light muted token is now
`#606e71` (4.69:1 on the shaded surface). Navigation uses native links and URL
state; detail tabs support arrow keys and labelled panels. Explicit-save forms
show unsaved status and protect against accidental navigation. Mobile comparison
keeps distinct properties and includes travel summaries and property links.
See `docs/ux-audit.md` for scope, performance measurements and verification.

## Actual layout

The actual-layout answer includes a “Has loft” checkbox beneath the room-type
selector. It saves independently of the room type and appears in property
summaries, comparison, history, conflict resolution, and PDF exports. Existing
answers without a saved loft fact remain compatible; not-applicable answers
disable the checkbox. The control uses the existing native checkbox and label
with a 44px target and EN/JA/VI text.

## Property ordering

The shortlist defaults to entry time, oldest first, with an ID tie-breaker for
equal timestamps. Renaming or editing a property keeps its position. Owner and
editor rows include a 44px Reorder handle alongside the existing state actions;
viewers see the saved order without editing controls. Dragging supports mouse
and touch, highlights the moving row, and scrolls at the viewport edges. Space
or Enter picks up/drops a row, arrows change its position, and Escape cancels.
A live region announces the property and position. Handles use the existing
neutral/teal tokens in both themes and EN/JA/VI labels.

Each collection saves its own order with an independent revision so reordering
does not invalidate checklist suitability or overwrite property edits. Filtered
reordering replaces visible slots only; hidden and archived rows keep theirs.
New properties append in entry-time order. Offline moves use the existing draft
queue. Conflicts show the server and local property lists with the existing
Keep server / Save my draft choices.

## Bicycle parking

The Neighborhood & moving checklist keeps bicycle parking availability (G05)
and the monthly numeric fee in JPY/month (G06) available during in-person viewing.
They reuse the existing Yes/No/Not checked control and numeric input; No and zero
remain saved facts. The fee shares its answer with Costs. Existing collections
receive definition changes through the normal change feed, preserving answers,
custom labels, supporting fields, and archive state. Missing definitions are added
without creating duplicates. No new visual tokens or components are introduced.
