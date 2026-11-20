# AttendPro M1 — Stage 3: Visual Design System Comparison

- **Date:** 2026-10-16
- **Stage:** 3 of 6 in the product-owner UI/UX workflow
- **Baseline commit:** `f87ce1d` (M0), code state as of `c4ee602`
- **Milestone:** M1, pending owner approval
- **Owner:** UI Designer Agent
- **Companions:** `docs/attendpro/previews/design-comparison.html` (the mockups in this document), `docs/attendpro/M1-UI-AUDIT.md` (Stage 1), `docs/attendpro/M1-ROLE-EXPERIENCES.md` (Stage 2), `DESIGN.md`, `docs/DESIGN_PROPOSAL.md`, `src/index.css`
- **Status:** design only. No file under `src/` or `backend/` is modified. The mockup is a self-contained HTML artefact under `docs/` that imports nothing from `src/` and calls no API.

---

## 0. What the product owner decided on 2026-10-16

Five answers were given and are recorded here because Stage 3 and Stage 4 both depend on them.

| # | Question | Decision |
|---|---|---|
| 1 | Which design system governs | `DESIGN.md`, the Operations Console, is the **baseline for comparison**. Paper and Brass is evaluated against it during this stage. **Colours are not finalised until the owner reviews this comparison.** |
| 2 | Staff clock-in and clock-out | **Kiosk-only is absolute** for routine punches. The buttons come out of the staff portal. QR, PIN, and the location checks must not be bypassed. |
| 3 | Correction decisions | SUPERADMIN acts as a **backstop** when HR is unavailable or has a conflict of interest. No self-approval. Every decision is written to the audit log. The escalation rules are to be defined in the design. |
| 4 | SUPERADMIN home | Confirmed. A dedicated business overview focused on setup health, configuration, and operational readiness. Not the HR dashboard. |
| 5 | Profile and Settings | Confirmed. Both move from the sidebar into the account popover. |

Decision 3 needs rules that do not exist yet, so they are proposed in section 7. Decision 2 is a code change and is listed in section 8 as a Stage 4 dependency, not applied here.

---

## 1. Method

The owner asked for a documented comparison with actual mockups, colour palettes, accessibility, and industry suitability. The comparison therefore has four parts: what each system specifies, how each performs when measured, how each suits this particular product, and what the mockups show when both are rendered on the same screens.

Every contrast figure in this document was computed from the hex values rather than copied from a comment. The computation uses the WCAG 2.1 relative luminance formula and sRGB gamma correction, which is what WCAG 2.2 AA also references.

The two screens chosen for the mockups are the two that the owner's decisions most changed: the SUPERADMIN overview from decision 4, and the HR attendance table from Stage 2. Both are shown with identical fictional data so the only variable is the visual system.

---

## 2. System A — Operations Console

Specified in sections 1 to 5 of root `DESIGN.md`, owner-signed 2026-10-06. The archetype is a dense B2B back-office tool modelled on Linear.

| Layer | Value | Measured on its own ground |
|---|---|---|
| Canvas | `#010102` | — |
| Surface 1 (cards, sidebar) | `#0f1011` | — |
| Surface 2 (hover, elevated) | `#141516` | — |
| Ink | `#f7f8f8` | 19.61:1 on canvas, 17.15:1 on surface 1 |
| Ink muted | `#d0d6e0` | 14.28:1 on canvas |
| Ink subtle | `#8a8f98` | 6.42:1 on canvas, 5.62:1 on surface 1 |
| Ink tertiary | `#62666d` | 3.62:1 on canvas |
| Accent | `#5e6ad2` | 4.44:1 on canvas, 3.88:1 on surface 1 |
| Accent hover | `#828fff` | 7.27:1 on canvas |
| Hairline | `#23252a` | — |

Typography is a single system-ui stack at six weights, with `display-xl` at 48px and tight negative tracking. The spec also carries a light-mode exception for auth surfaces only.

Status colours are not defined in sections 1 to 5 of `DESIGN.md`. Section 5.4 and section 11, both added on 2026-10-15, define an eight-state status palette against dark tinted grounds. Section 9 of this document treats that separately, because it belongs to neither system as originally written.

---

## 3. System B — Paper and Brass

Specified in `docs/DESIGN_PROPOSAL.md`, produced 2026-10-08 and still carrying the header "PROPOSED — NOT APPROVED". Implemented in `src/index.css` and therefore in every page currently shipping.

Its central move is a polarity split. The Login page already has a dark brand panel on the left and a warm paper form on the right. This system makes that split permanent and structural: the brand panel becomes the sidebar, the paper form becomes the working surface.

| Layer | Value | Measured on its own ground |
|---|---|---|
| Paper (canvas) | `#fafaf9` | — |
| Paper raised (cards) | `#ffffff` | — |
| Paper sunken (headers, inputs) | `#f5f5f4` | — |
| Paper line | `#e7e5e4` | — |
| Paper line strong | `#d6d3d1` | — |
| Ink | `#0f172a` | 17.09:1 on paper, 16.36:1 on sunken |
| Ink muted | `#44403c` | 9.84:1 on paper |
| Ink subtle | `#78716c` | 4.59:1 on paper, 4.40:1 on sunken |
| Ink tertiary | `#a8a29e` | 2.41:1, documented as decorative only |
| Chrome | `#0f172a` | — |
| Brass | `#eab308` | 9.31:1 on chrome |
| Brass ink | `#b45309` | 4.81:1 on paper, 4.60:1 on sunken |

The accent splits by polarity, and the rule is explicit: `#eab308` never touches a light surface, `#b45309` never touches chrome. The measurement that forces the split is that brass on paper gives 1.84:1, where a focus ring needs 3:1.

Typography is a three-tier stack using a serif for display and a system sans for body, on a 4px rhythm.

---

## 4. What was actually measured

This section reports two findings that neither design document contains. One is a limitation of System A. The other is a defect in the shipped code that affects both.

### 4.1 System A's accent cannot carry text

The accent `#5e6ad2` measures 4.44:1 against the `#010102` canvas. WCAG 2.2 AA requires 4.5:1 for normal text. The accent therefore fails as a link colour, a metadata colour, or any other text role on the dark ground, and it fails more narrowly still on surface 1 at 3.88:1.

It survives as a button fill only in one direction: white text on `#5e6ad2` gives 4.70:1, which passes, while the canvas colour on the same fill gives 4.44:1 and fails. So a primary button in System A must use white text, and the darker of the two obvious choices is the wrong one.

This is a narrow miss rather than a broken system, and System A's hover value `#828fff` at 7.27:1 could carry text roles if a text accent token were added. The point is that the specification as signed does not include one, so adopting System A means adding a token rather than only recolouring.

### 4.2 The shipped status badges fail on dark surfaces

`src/index.css` lines 276 to 279 build the soft status backgrounds as a 12 per cent tint of the status colour composited over transparent. On the paper canvas that produces a light ground and the flat status text passes: success 4.80:1, warning 4.96:1, error 6.19:1.

The same class renders identically inside any dark surface. Composited over the chrome value `#0f172a`, the four status colours measure:

| Badge text | 12 per cent tint over chrome | Ratio | AA needs |
|---|---|---|---|
| Success `#15803d` | over `#0f172a` | 3.19:1 | 4.5 |
| Warning `#c2410c` | over `#0f172a` | 3.20:1 | 4.5 |
| Accent `#b45309` | over `#0f172a` | 3.25:1 | 4.5 |
| Error `#b91c1c` | over `#0f172a` | 2.63:1 | 4.5 |

Every one fails, and error fails even the 3:1 bar that applies to non-text interface components.

This matters more after the decisions in section 0 than it did before. Modals use chrome shells, so a status badge inside a confirmation dialog fails. The kiosk screen is a dark surface by design, and a status badge there fails. Both are in the M1 scope, so this is not hypothetical. It is recorded as defect **F8** in section 8.

The cause is that the soft tint is computed relative to the accent colour alone and never asks what it is sitting on. Whichever system is chosen, the fix is the same: status badges need a ground that is specified, not derived.

### 4.3 The status palette has three specifications, none fully implemented

The audit in Stage 1 found the status vocabulary stale in the code. This stage found that the vocabulary also disagrees across three documents.

| Source | Style | Status values |
|---|---|---|
| `docs/DESIGN_PROPOSAL.md` §5.4 | light tint on paper, e.g. `#dcfce7` with `#166534` | five, the pre-reconciliation set |
| `DESIGN.md` §5.4 and §11, added 2026-10-15 | dark tint, e.g. `#0c2b2b` with `#5eead4` | eight, the reconciled set |
| `src/index.css` | flat text only: `#15803d`, `#b91c1c`, `#c2410c` | three |

The eight-value set in `DESIGN.md` section 11 is the correct vocabulary and it is the one the data model uses. Its measured contrast on its own tinted grounds is good, from 7.80:1 for absent to 9.56:1 for automatically closed. What is missing is the instruction for which ground those eight values are drawn for, which is the same gap section 4.1 describes for System A.

---

## 5. Industry suitability

Neither system is fashionable for its own sake, which is the standard the owner set. The question is which one serves a workforce product used in long shifts by people who are not designers.

### 5.1 The case for the Operations Console

Dark back-office consoles are the right answer where a screen is read continuously for hours and where the data is dense. Incident response, trading, and logistics dispatch all look this way for a reason: a dark ground reduces overall luminance and makes a coloured status marker read as an event rather than as decoration.

AttendPro has one strong claim on this. The kiosk is a public-facing screen mounted in a warehouse or on a reception desk, often in variable light, and it shows very little: a first name, an action, a result. A dark kiosk is more legible at distance and more forgiving under fluorescent light than a white one.

Against that, the HR user is not incident response. An HR user reads a table of forty-six employees, compares shift columns, and works a queue. Dense tabular reading is where dark themes cost the most, because hairline separation between rows does less work on a dark ground and the eye loses its place more often.

### 5.2 The case for Paper and Brass

The strongest argument for this system is not aesthetic. It is that the product already has a two-polarity identity and this system is the only one that explains it. The Login page was built this way, the sidebar already uses the chrome polarity, and the token layer is already measured against it. Adopting it costs nothing to implement.

Second, warm paper at `#fafaf9` rather than pure white reduces glare for a user who keeps the tab open all day, and it keeps the ledger metaphor the product's own language already leans on: attendance records are rows in a book, and the design treats them that way.

The weakness is the accent. Brass is a strong, distinctive choice, and it sits uncomfortably close in hue to the amber family that late and warning statuses also occupy. The proposal handles this by rule, restricting brass to solid fills, rules, and focus rings and never using it as a badge ground. That rule works, but it is a rule that must be held for the life of the product, and it is the kind of constraint that a future contributor will break by accident.

Third, the status badge grounds are specified for light paper and are measured. They ship today and they pass, except where section 4.2 found them failing on chrome.

### 5.3 What this product specifically needs

Three properties matter for an attendance product more than for a generic dashboard.

Status legibility is the first. A user scanning a table needs to separate six or eight attendance states at a glance, and the states must not be confusable with the brand colour. Both systems can do this, but Paper and Brass has the harder version of the problem because brass and late are both amber, and it solves it by restriction rather than by separation.

Table readability is the second. Attendance is a ledger. Paper with dark ink at 17.09:1 is the more comfortable surface for row comparison, and the existing `AttendanceTable` was built for it.

The kiosk is the third, and it is the one screen where the two systems genuinely disagree. The mockups in section 6 do not cover the kiosk, and Stage 4 should render it in both, because it is the only surface where a dark ground has a functional argument rather than a stylistic one.

### 5.4 What comparable products do

The honest observation is that both directions are well represented in this market and that the choice is not decidable by appeal to precedent. Attendance and workforce products split roughly evenly between light and dark. The products that read as most credible to a business buyer tend to share two properties that have nothing to do with hue: dense, well-aligned tables, and status colour that is used sparingly and consistently. Both systems here can deliver those.

---

## 6. The mockups

The comparison file is `docs/attendpro/previews/design-comparison.html`. It is a self-contained HTML document with no external requests. Opening it in a browser shows both systems on the same two screens with a switch in the header bar, so the two can be compared on identical data.

The two screens are the SUPERADMIN overview from decision 4 and the HR attendance table from Stage 2. Both use fictional data for a fictional business, Sakumono Logistics, with the sample names already used across the M1 documents. No live tenant data appears.

What the mockups are built to demonstrate:

- The **SUPERADMIN overview** leads with setup health rather than a chart wall. The headline states how much of the configuration is finished, the checklist shows what is missing and links to the screen that finishes it, and the queue on the left is the operational work. This is the screen decision 4 asked for, and it has no equivalent in the current application.
- The **HR attendance table** is exception-led. The default filter is Exceptions at seven rows rather than All at forty-six, the exception chips carry counts, and the columns follow the PRD section 8 field set. HR cannot edit a cell; the action column opens a workflow.
- **Status badges** are rendered in both systems across six of the eight reconciled states, so the owner can judge the legibility argument in section 5 directly.
- **Navigation** is shown in the grouped form Stage 2 proposed, with the role-specific difference between HR and SUPERADMIN visible in the two sidebars.

Two things the mockups deliberately do not show. They do not show the kiosk, for the reason in section 5.3. And they do not show motion or hover behaviour beyond a simple hover state, because the comparison is about the static system.

---

## 7. Escalation rules for correction decisions

Decision 3 gave SUPERADMIN a backstop role and asked for the rules to be defined. They are proposed here for approval, and they are design only.

The constraint set is: `O17` forbids self-approval, PRD section 4.2 puts correction decisions with HR, the permission matrix grants SUPERADMIN audit access, and decision 3 now adds a backstop. The rules must satisfy all four.

| Rule | Proposal |
|---|---|
| Default decision-maker | HR decides every correction in its own scope. This stays the normal path and is unchanged. |
| Condition 1: HR unavailable | SUPERADMIN may decide when the correction has been unclaimed for 24 hours. The waiting time is visible on the item before the override is offered. |
| Condition 2: conflict of interest | SUPERADMIN may decide when the correction concerns an HR user, or when every available HR approver is excluded by the self-approval rule. |
| Condition 3: escalation by HR | HR may explicitly hand a correction to SUPERADMIN. The handoff is recorded with the HR user who made it. |
| Exclusion | The no-self-approval rule applies to SUPERADMIN without exception. A super admin who submitted a correction can never decide it, and the item routes to HR. |
| Trace | Every decision records the actor, the role the actor held when deciding, the timestamp, and which condition justified the override. A backstop decision carries a reason field that is required, not optional. |
| Visibility | Backstop decisions are marked distinctly in the audit log so that a reviewer can filter for them without reading every entry. |

One consequence worth naming. Condition 1 means a business with no HR user at all has every correction routed to the super admin after 24 hours. That is probably correct for a small business that has not hired HR yet, but it turns the backstop into the primary path for that tenant. If the owner would rather such a business have no correction path until HR exists, condition 1 should be dropped and only conditions 2 and 3 kept.

---

## 8. Recommendation

**Recommendation: adopt System B, Paper and Brass, as the governing visual system, and fold it into root `DESIGN.md` so that one document governs. Carry the eight-state status vocabulary from `DESIGN.md` section 11 into it, which is the part of section 11 that is genuinely right.**

The reasons, in the order they matter.

First, cost and truthfulness. The shipped frontend is already Paper and Brass. Its token layer is measured, its status badges pass on the surfaces they were designed for, and its button primitives exist. Adopting System A means restyling every page in the product and adding at least one missing token, for a result that is narrower in contrast headroom in two measured places.

Second, the two-polarity rule is an identity, not a colour choice. System A has a light-mode exception for auth pages. System B explains why the login page is split and makes that split the product's structure. The first alternative is a compromise inside a system; the second is the system.

Third, the product is a ledger. Attendance rows are the centre of gravity for two of the three roles, and dark ink on warm paper at 17.09:1 is the more comfortable surface for sustained row comparison.

Fourth, System A's accent limitation in section 4.1 is fixable but unfixed, and System B's amber collision in section 5.2 is a rule that must be maintained. These are comparable costs. The tiebreaker is that System B's cost is already paid.

The recommendation is conditional on two repairs, both of which are Stage 4 work and neither of which is a colour decision.

**Repair 1, defect F8:** status badges need a specified ground rather than a 12 per cent tint over whatever is underneath, so that badges pass on chrome surfaces, in modals, and on the kiosk. Section 4.2 gives the failing measurements.

**Repair 2, defect F9:** `DESIGN.md` section 5.4 and section 11 must be reconciled into whichever system wins, carrying forward the eight-state vocabulary and its measured grounds. As long as three status specifications coexist, no contributor can implement a status badge correctly.

One part of the recommendation is deliberately left open, per the owner's instruction in decision 1. **The final colour values are not settled by this document.** Section 3 lists what Paper and Brass specifies today, and section 4 lists what fails. The owner should review the mockups and either confirm those values or direct a change. Stage 4 does not begin its screen work until that answer arrives, because every screen depends on it.

### Open defects for Stage 4

| Ref | Finding | Where |
|---|---|---|
| F8 | Status badges fail AA on every dark surface: error 2.63:1, success 3.19:1, warning 3.20:1, accent 3.25:1 | `src/index.css` lines 276–279 |
| F9 | Three coexisting status specifications, none fully implemented | `DESIGN.md` §5.4, §11; `DESIGN_PROPOSAL.md` §5.4; `src/index.css` |
| F10 | Staff clock-in and clock-out buttons break the kiosk-only rule | `src/pages/Dashboard.tsx` lines 112–136, 225–234 |
| F11 | Status vocabulary stale: `PRESENT`, `ON_LEAVE` present; eight reconciled states absent | `src/types/index.ts` line 8; `src/components/ui/StatBadge.jsx` |
| F12 | Auto clock-out message hardcodes 11:59 PM against a rule that forbids it | `src/pages/Dashboard.tsx` line 96 |
| F13 | Attendance rate divides by a hardcoded 22 working days | `src/pages/Dashboard.tsx` line 184 |
| F14 | Two contradicting governing design documents | `DESIGN.md`; `docs/DESIGN_PROPOSAL.md` |

---

## 9. Achievements on the HR and SUPERADMIN dashboards

The owner asked for achievements to be removed from the SUPERADMIN and HR dashboards. The audit looked for them and did not find them.

Neither dashboard contains a section, component, or label named achievements. `src/pages/HrDashboard.tsx` holds three KPIs, a weekly overview chart, and the attendance table. `src/pages/SuperAdminDashboard.jsx` holds four KPIs, a weekly overview, a monthly report, and the attendance table. Neither has a badge, streak, or recognition element.

Three related things do exist elsewhere in the frontend, and they are the likely source of the instruction.

| Element | Location | What it is |
|---|---|---|
| Attendance streak | `src/pages/Dashboard.tsx` line 152 | Counts consecutive closed sessions backwards from today, and shows it as a metric on the staff dashboard |
| Badge grid skeleton | `src/components/ui/Skeleton.jsx` line 96 | Named `BadgeGridSkeleton`, and its loading placeholder reads "Loading achievement" |
| Badge grid usage | `src/pages/Profile.tsx` line 272 | The one place the badge grid skeleton is rendered |

So gamification exists on the **staff** dashboard and on the Profile page, not on the two dashboards named. The instruction has been recorded as stated and Stage 4 will not add any achievement, badge, streak, or recognition element to the HR or SUPERADMIN dashboards.

Two follow-ups were put to the owner, who answered on 2026-10-16: **both are removed.**

1. The staff attendance streak at `src/pages/Dashboard.tsx` line 152 is removed. It is the same class of element as an achievement badge, and removing it is consistent with the Stage 1 verdict that the staff dashboard is too playful for the role.
2. The Profile Achievements section is removed. It is larger than the audit first described: `src/pages/Profile.tsx` line 253 renders a full section with a "Achievements" heading, an earned count, and a grid of four `BadgeCard`s from a `BADGES` array defined at line 29. The four badges are On Fire, Early Bird, Perfect Month, and Veteran. Each is computed client-side from the attendance `records` array, and the 19-model target contains no badge or achievement entity, so the whole section is derived UI with no persistence. Its removal also retires the `BadgeGridSkeleton` in `src/components/ui/Skeleton.jsx` line 96, which existed only to load it.

With both confirmed, no gamification remains anywhere in version one, and `O24` in the decision register is fully settled.

---

## 10. What Stage 4 needs before it starts

1. The owner's review of the mockups and a decision on the final colour values, per decision 1.
2. Answers to the two questions in section 9 about the streak and the Profile badge grid.
3. The correction-escalation rules in section 7, approved or amended.
4. A decision on whether the kiosk is rendered in both systems, which section 5.3 argues for.
