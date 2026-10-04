# Rental search and viewing checklist app

Plan a web app for shortlisting rental apartments in Japan, recording viewing results, and comparing apartments against the same criteria. Do not implement yet.

## 1. Core requirements

- Sign in with Google.
- Each user can own at most one collection and join collections owned by other users. Joining a shared collection does not require creating a personal collection.
- A collection contains the apartments being considered, a shared checklist definition, and its members.
- The owner can invite people by email with view or edit permission, change their role, and revoke access.
- Viewers can read and compare. Editors can manage apartments, answer checklist items, and modify the shared checklist. Only the owner manages membership or deletes the collection.
- A collection starts with the default checklist in Section 5. Users can add, edit, reorder, or disable criteria.
- Each apartment has its own answers to the collection's checklist. The checklist is not a separate, independently editable copy for each apartment.
- Adding a criterion makes it available for every existing and future apartment in that collection, initially unanswered.
- Support mobile use during viewings and side-by-side comparison of apartments, including filters for unanswered criteria, requirements, and unresolved questions.
- Enforce collection access and editing permissions on the server, not just through the interface.

## 2. Apartment records and use

An apartment record contains:

- Property/building name, room number, address, listing URLs, map link, floor plan/photos or links to them, and agent/contact details.
- Basic property information: area, layout, floor, building age, and construction.
- Viewing date/time and status: considering, contacted, viewing scheduled, viewed, shortlisted, applied, selected, rejected, or unavailable.
- Last availability check, reasons for rejection, outstanding questions, and a brief summary of advantages/disadvantages.

Allow quick creation with just a name and completion later. Do not require a completed checklist to save an apartment.

Fields appearing in both the overview and checklist, such as rent or floor area, must share one source of truth.

During a viewing, users should be able to open the relevant checklist section, enter answers and notes quickly, and see whether changes have saved. Failed saves must not discard the current input. Concurrent edits must not silently overwrite each other.

Comparison should use the shared criteria as rows and selected apartments as columns, with a usable mobile alternative. Distinguish missing information, negative answers, and non-applicable criteria. A weighted score or automatic ranking is not required.

## 3. Collection-specific preferences

Keep budgets, destinations, furniture dimensions, priorities, target move-in date, and journey frequencies configurable. They are not universal requirements.

Examples from my own search:

- Around ¥140,000/month including management fees; approximately 25 m² or larger.
- Prefer walking to a station in about 10 minutes or less and commuting directly to Shin-Nihombashi without a train transfer. A direct bus can also be suitable.
- Futon approximately 1.3 × 1.8 m, left unfolded daily; a permanent study/work desk is required.
- My girlfriend keeps her own home and visits approximately twice weekly: once from work at Toyosu and once from home near Higashi-Nakayama. She returns to her own home, sometimes taking a taxi between the apartment and station.
- A company housing allowance of approximately ¥30,000/month may apply within a 5 km radius of the office. Eligibility and whether it can be combined with corporate leasing must be recorded as confirmed or unconfirmed, not assumed.

Other searches may prioritize lower rent and accept cycling farther to a station. Users must be able to change the settings and the importance of individual criteria accordingly.

## 4. Checklist and answer design

### Answer types

Required: checkbox/boolean and text. Also support numbers and single-select options where they make measurements and costs easier to compare.

Notation used in the default checklist:

- **B — Boolean:** Yes / No / Not checked, with Not applicable handled separately. An unchecked checkbox must not automatically mean No.
- **T — Text:** short or multiline text as appropriate.
- **N — Number:** with an explicit unit, such as JPY, m², m, minutes, or Mbps.
- **S — Single select:** a defined set of choices, with Other and an optional explanation where appropriate.

When an item calls for multiple measurements, such as walking distance and duration, use separate values with explicit units rather than an ambiguous number.

### Criterion definition

Each criterion has:

- A stable ID, independent of its label.
- Section, label, and description/input guidance.
- Answer type, unit where relevant, and choices for select fields.
- Display order.
- Importance: Requirement / Preference / Information.
- Applicable checking stages: Listing screening / Ask the agent / In-person viewing / Before signing. A criterion can apply to more than one stage.

The definition belongs to the collection. Each apartment's answer refers to that definition. The same criterion can therefore be compared across apartments without duplicating its definition or mixing their answers.

### Answer rules and supporting information

- Not checked is different from an explicit No.
- Not applicable is different from a failed requirement.
- Zero is a valid numeric answer. A missing number must not become zero.
- Whitespace-only text counts as unanswered.
- An answer can include optional notes, a source/link, the date of observation or confirmation, and who last updated it and when.
- Sources can include a listing, agent, direct observation, document/contract, or estimate.
- Preserve the distinction between an advertised claim, something an agent said, something observed in person, and something confirmed in a contract. An agent's statement must not automatically become contract-verified information.
- When information changes, retain enough history to understand the previous value and the correction.
- Write boolean labels so their meaning is clear. True must not automatically mean favorable: “Noise is present” and “Sound insulation meets my needs” describe different things. Keep observed facts separate from the user's assessment of suitability.

Completion measures how much has been checked, not how much passes:

- An explicit No is still an answered item.
- Exclude Not applicable items from the denominator.
- Exclude archived criteria from normal progress calculations.
- If no criteria are applicable, show that explicitly rather than dividing by zero or implying that the apartment passed everything.

### Changes to the shared checklist

- Adding a criterion exposes it on all apartments with an initial Not checked state.
- Renaming, changing descriptions, moving sections, or reordering criteria preserves existing answers.
- Do not use criterion labels as database keys.
- Archive criteria with existing answers rather than silently deleting their data. Archived criteria should disappear from normal entry and progress views while their answers remain recoverable.
- Changing the answer type after answers exist must be blocked or handled through an explicit conversion that preserves data. Do not silently coerce incompatible values.
- Changes affect every apartment in the collection. Make this clear when users edit the shared checklist.
- The app-wide default template is used to initialize a collection. Later template updates must not overwrite an existing collection's customized checklist.

## 5. Default checklist

This is the default checklist content, not merely illustrative examples. Preserve the individual checks; do not collapse each section into one general notes field.

Thresholds, destinations, furniture dimensions, and importance levels come from collection settings. New apartments start unanswered; do not infer positive answers from an address, building type, or the user's preferences.

### A. Initial screening and overall suitability

- **[S] Availability and confirmation:** available / unavailable / unknown, when last checked, and the source.
- **[N · m²] Advertised floor area:** note anything that needs measurement or further confirmation.
- **[S] Actual layout:** 1R / 1K / 1DK / 1LDK / 2K / Other.
- **[N · m] Usable width of the main room.**
- **[T] Floor, construction, building year, and unresolved basic details:** reuse the apartment's overview data.
- **[T] Earliest availability versus the desired move-in date.**
- **[B] Applicant eligibility:** whether the applicant can rent under their circumstances, with any conditions needing confirmation.
- **[B] Guest/partner stays:** whether the intended frequency of overnight stays is compatible with the contract.
- **[T] Requirements currently unmet or still unchecked.**

### B. Travel for each person

The collection defines destinations and journey scenarios. Each apartment records its own route information for those scenarios; do not reduce this section to one “distance to station” field.

- **[T] Stations, train lines, and bus stops actually used:** include the route between the apartment and those access points.
- **[N · m and minutes] Walking distance and duration from the apartment door to the station/bus stop:** record distance and time separately; note whether the endpoint is the station entrance or platform when known.
- **[N · minutes] Door-to-door commute to the renter's workplace.**
- **[N] Number of transfers:** distinguish a direct train from a train-plus-bus journey.
- **[T] Direct bus to work or another important destination:** stop, route, travel time, and practical convenience.
- **[T] Service frequency, last departures, and operating hours:** include weekend differences where relevant.
- **[N · JPY] One-way and return cost for each journey scenario:** keep employer-reimbursed portions separate.
- **[T] Partner/co-searcher's arrival from their own home.**
- **[T] Partner/co-searcher's arrival from their workplace.**
- **[T] Partner/co-searcher's return to their own home:** do not assume it reverses the arrival route.
- **[N · JPY] Taxi for the apartment–station segment:** include known booking/pickup surcharges and the quote/source.
- **[N · minutes] Cycling time to stations/destinations:** include relevant bicycle-parking arrangements.
- **[T] Alternatives for rain, fatigue, or a missed service:** bus, taxi, or another route.
- **[T] Continuous walking, stairs, level changes, and comfort for each person.**

### C. Layout, futon, desk, and belongings

- **[T] Usable length × width:** include columns, awkward corners, and door-opening areas.
- **[B] The configured futon/mattress fits without being folded every day.**
- **[B] A permanent study/work desk fits, including clearance to pull out and use the chair.**
- **[B] Walkways, cupboards, and doors remain usable with the futon laid out.**
- **[T] Proposed arrangement of the futon, desk, chair, and workspace:** do not infer fit from tatami count or total floor area alone.
- **[B] Room divisions/partitions suit daily use:** note whether rooms can be opened up or adapted.
- **[B] Adequate storage for clothes, bedding, suitcases, and household items.**
- **[B] Suitable space for the fan, bookshelf, and other existing belongings.**
- **[T] Comfort when two people stay:** seating, circulation, and privacy.

### D. Light, ventilation, and noise

- **[S] Window/balcony orientation:** do not infer actual light quality from orientation alone.
- **[T] Actual daylight and direct sunlight:** record viewing time and weather.
- **[T] Nearby obstructions:** facing buildings, separation distance, window height, and visible sky.
- **[T] View and privacy with curtains open.**
- **[B] Ventilation meets the user's needs:** whether windows open and can be used conveniently.
- **[T] Dampness, mold, condensation, and unusual smells:** distinguish observations from assumptions.
- **[T] External noise:** schools, roads, trains, restaurants, or construction.
- **[T] Noise from corridors, neighbors, and upstairs:** record when it was checked.
- **[T] Building structure, party walls, and evidence of sound insulation:** reinforced-concrete construction alone does not establish quietness.

### E. Kitchen, bathroom, washing, and drying

- **[B] The kitchen can be separated from sleeping/working areas to limit cooking smells.**
- **[N] Number of burners:** include burner type and condition in supporting details.
- **[T] Preparation space:** usable space for a chopping board, appliances, and practical cooking tasks.
- **[T] Refrigerator position and available dimensions:** distance from the cooking area and any intervening wall.
- **[B] Extractor ventilation and kitchen storage suit the user's cooking needs.**
- **[T] Bathroom, toilet, and washbasin:** layout, cleanliness, water pressure, hot water, and smells requiring investigation.
- **[T] Washing-machine location and dimensions:** water supply and drainage connections.
- **[B] Indoor drying space or equipment is available for days without sunlight.**
- **[T] Balcony drying:** space, sunlight, privacy, and restrictions.

### F. Air conditioning, electricity, and internet

- **[T] Included air conditioning:** number of units, location, condition, and repair responsibility.
- **[T] Power outlets:** availability and convenience near the desk, futon, kitchen equipment, and router.
- **[S] Internet arrangement:** included / separate contract required / unknown.
- **[T] Actual connection to the apartment and provider:** distinguish verified details from advertised availability.
- **[N · JPY/month] Recurring internet cost:** conditions required to obtain that price.
- **[N · JPY] Activation, installation, and equipment charges:** amounts payable upfront.
- **[T] Service availability date, installation permission, and expected waiting time.**
- **[T] Existing contract transfer, minimum term, cancellation, and equipment-return conditions.**
- **[T] Measured download/upload speeds, latency, and stability:** time, method, and supporting evidence.
- **[T] Mobile reception/Wi-Fi at the workspace and a temporary connection before installation.**

### G. Neighborhood amenities and moving access

- **[T] Nearest supermarket:** distance, walking route, and opening hours to verify.
- **[T] Lower-cost grocery or bulk-shopping options.**
- **[T] Restaurants suitable for regular meals:** food types, distance, and opening hours.
- **[T] Convenience stores and other amenities the user actually needs.**
- **[B] Suitable bicycle parking:** availability of spaces and registration conditions.
- **[N · JPY/month] Bicycle-parking cost:** distinguish parking at home from parking at a station.
- **[T] Elevator/stairs, doorway dimensions, and the route for bringing in the mattress, desk, and bookshelf.**
- **[T] Moving restrictions:** permitted hours, vehicle stopping space, reservations, and protection of shared areas.
- **[T] Moving estimate based on actual belongings:** weekday versus weekend options.

### H. Upfront, recurring, and move-out costs

- **[N · JPY/month] Rent.**
- **[N · JPY/month] Management/common-area fees.**
- **[N · JPY] Security deposit (敷金):** refund conditions and possible deductions.
- **[N · JPY] Key money (礼金).**
- **[T] Brokerage fee (仲介手数料):** amount/formula, tax, discounts, and payee.
- **[T] Separately mentioned “agency fee” and “broker fee”:** whether they refer to the same charge; flag potential duplication until resolved.
- **[T] Initial guarantor fee:** amount/formula, calculation base, and whether an exemption is confirmed.
- **[T] Monthly, annual, and renewal guarantor charges:** record each frequency separately.
- **[T] Foreigner-specific surcharges:** amount, frequency, and applicability.
- **[N · JPY] Lock replacement.**
- **[T] 24-hour support, registration, administration, disinfection, and other packages:** distinguish mandatory from optional charges.
- **[T] Fire insurance:** cost, coverage period, payee, and when it must be paid again.
- **[T] Move-in/move-out cleaning and air-conditioner cleaning:** payment timing and possible duplication.
- **[T] Free rent/promotions:** amount or months, charges covered, conditions, and potential repayment/clawback.
- **[T] Rent commencement and first-month proration:** distinguish contract charging from key handover and the physical moving date.
- **[T] Lease renewal fees and other charges repeated at renewal.**
- **[T] Early-termination penalties, notice period, and related charges.**
- **[T] Other move-out costs or unexplained charges.**
- **[T] Quote coverage and payment arrangements:** whether each charge is included, who collects it, whether paid separately, deadlines, and required payment references.
- **[T] Confirmation status:** estimated, confirmed by the agent, or present in the documents.

For cost items expressed as text, retain a numeric amount, frequency, and/or formula where available; the explanation should not prevent reliable comparisons.

### I. Lease conditions and pre-signing checks

- **[T] Contract type, term, renewal conditions, and effective date.**
- **[T] Required documents, Japanese-language requirements, and applicable guarantor conditions.**
- **[B] The landlord/management accepts the intended lease arrangement, including corporate leasing when relevant.**
- **[T] Frequent guests, additional occupants, and resident-declaration requirements.**
- **[T] Rules affecting intended daily use:** working from home, cooking, drying laundry, or other property-specific restrictions.
- **[T] Discrepancies between the listing, agent's answers, and contract documents.**
- **[T] Questions still needing an agent's response:** responsible contact and resolution status.

### J. Corporate leasing and housing allowance — optional section

- **[B] The property is accepted under the employer's corporate-lease scheme.**
- **[T] Parties involved:** agent, management, leasing service, and HR; the next action for each.
- **[T] Processing time and the date corporate leasing becomes effective.**
- **[T] Contract-holder change or personal-to-corporate conversion fees:** when they apply.
- **[T] Guarantor company required or exempted:** evidence and exactly which fees are waived.
- **[N · km] Distance to the office for allowance eligibility:** straight-line radius versus actual travel distance.
- **[N · JPY/month] Expected/confirmed housing allowance.**
- **[T] Allowance conditions and compatibility with corporate leasing:** do not assume both benefits can be combined.
- **[T] Personally paid upfront amounts, payroll deductions, temporary holds, refunds, and their timing.**
- **[T] Responsibility for lease renewal, insurance, and other recurring charges.**
- **[T] Payroll treatment requiring HR confirmation:** how rent/allowance appears in payroll; do not automatically calculate tax savings.

### K. Additional suggested checks

These are optional additions, not previously confirmed personal requirements. Keep them separate from the core checklist and do not automatically mark them as requirements.

Users may choose to enable:

- Entrance security, locks, and intercom.
- Parcel reception.
- Waste-disposal rules.
- The route home at night.
- Area-specific hazards to check against official information.
- Insects/pests.
- Pet or smoking rules when relevant.

## 6. Cost and travel comparison rules

Support comparison of upfront cash required, recurring costs, and a 24-month total. Show assumptions and incomplete information.

- Distinguish refundable deposits/temporary holds from nonrefundable costs.
- Do not count prepaid rent twice.
- Missing amounts are unknown, not zero. Label a partial sum as a total of known charges, not a complete total.
- Apply free rent and confirmed exemptions only to the charges they cover.
- Flag potentially duplicate charges for resolution instead of automatically adding or deleting them.
- Include charges according to their timing, with an explicit rule for renewals at the end of the comparison period.
- Separate personal payments, allowances, reimbursements, and payroll deductions. A temporary payroll hold is not automatically an additional final expense.
- Travel costs depend on each person's journey scenario, arrival/return routes, frequency, and reimbursed portion. Do not assume every month is exactly four weeks.
- Do not infer tax savings, legal eligibility, or immigration consequences; retain confirmed inputs and unanswered questions for the appropriate contact.

## 7. Planning output

Return the user flows, screens, data model, and implementation steps. Include the shared-checklist/individual-answer relationship and a seed specification preserving Section 5's criteria, types, units, guidance, and checking stages.

Keep optional additions such as automatic scoring, listing scraping, and advanced integrations separate from the core plan.