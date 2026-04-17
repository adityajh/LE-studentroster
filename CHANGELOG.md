# Changelog

All notable changes to the LE Student Roster system are documented here.

---

## [1.8.0] — 2026-04-17

### Stored Fee Letters, Students List Improvements, Audit Log Search & Email Fixes

#### Added
- **Stored fee letters** — `FeeLetterVersion` model (Vercel Blob + DB record) stores the official fee letter per student; auto-generated and saved at enrolment (both confirm-enrolment and direct-enrol paths); serves stored copy on subsequent downloads; falls back to fresh generation for older students with no stored letter
- **Fee letter version history** — every replaced letter is archived with its date, source, and who created it; visible in the Fee Letter tab with direct "View" links to Blob URLs
- **Admin fee letter upload** — admins can upload a PDF to replace the active letter; confirmation dialog warns the current letter will be archived before proceeding; Upload/Replace button is admin-only
- **Admin fee letter regenerate** — "Regenerate" button (or "Generate" when none exists) in the Fee Letter tab lets admins re-generate the letter from current financial data; amber warning dialog shown before proceeding; old letter moved to version history; `PUT /api/students/[id]/fee-letter` endpoint handles generation + save atomically; admin-only
- **Fee letter date + source display** — Fee Letter tab now shows when the active letter was created/uploaded and whether it was auto-generated or manually uploaded
- **`src/lib/fee-letter.ts`** — shared utility: `saveFeeLetterVersion()` (uploads to Blob, deactivates old versions, inserts DB record) and `getActiveFeeLetterVersion()`
- **`GET/POST/PUT /api/students/[id]/fee-letter`** — `GET` returns active letter metadata + history; `POST` (admin only) accepts a PDF upload and replaces the active letter; `PUT` (admin only) generates a fresh PDF from current data and saves it as the new active letter
- **Audit log search** — search bar queries the full DB (`OR` filter across student name, roll no, field, old/new value, reason, moderator name/email); results count shown; Clear link when query active
- **Audit log pagination** — 50 rows per page; numbered page links with ellipsis; Previous/Next; all via URL search params (`?search=…&page=…`) — no client JS required
- **Payment reminder email drafts** — proper copy written for all 3 reminder types (1 month before, 1 week before, on due date) with escalating urgency; updated in `prisma/seed-reminders.ts` with `update:` so re-running the seed applies them; merge fields: `{{studentName}}`, `{{installmentLabel}}`, `{{amount}}`, `{{dueDate}}`
- **Students list: Next Due Amt + Next Due Date columns** — replace the old Installments column; show the first unpaid installment's amount and due date; red text for overdue; PARTIAL installments show remaining balance (`amount − paidAmount`); `—` for students with no outstanding installments

#### Changed
- **`getStudents`** — installments select now includes `dueDate`, `amount`, `paidAmount` (ordered by `dueDate asc`) to power the new columns
- **`proposal/route.ts`** — checks for active `FeeLetterVersion` first and proxies the stored Blob PDF; falls back to fresh generation only when no stored letter exists; Word (`docx`) branch removed entirely
- **Fee Letter tab** — redesigned; Download PDF button hidden when no stored letter exists; Regenerate/Generate and Upload/Replace buttons are admin-only; non-admins see only Download PDF (when a letter exists)
- **Email separation** — student/parent-facing emails (offers, reminders, onboarding, confirmations) use the Hostinger SMTP account configured in Settings → Emails (`hi@letsenterprise.in`); admin login magic links use the separate Gmail account (`GMAIL_USER`); the `GMAIL_USER`/`GMAIL_APP_PASSWORD` env vars are no longer used as a fallback for student emails
- **Onboarding link route** — now checks and surfaces email send failures: returns `emailSent: false` + `emailSkipReason` when SMTP is not configured; `SendOnboardingLinkButton` shows a warning toast instead of a false "Sent" success

#### Removed
- **Word document download** — "Download Word" button removed from the Fee Letter tab; `docx` import and the `format=docx` branch removed from `proposal/route.ts`

---

## [1.7.0] — 2026-04-13

### Staff Roles, Settings Redesign, Email Templates & PDF Attachment Library

#### Added
- **Attachments tab** (new Settings tab between Emails and Reminders) — lists all 3 system PDFs (Offer Letter, Fee Structure, Payment Receipt); each card shows which emails it's attached to and which sections are configurable; "Preview PDF" button renders the actual PDF with placeholder student data (Ananya Sharma, Batch 2025) and embeds it inline at 700px using a browser `<iframe>` — no new tab needed
- **PDF preview routes** — `GET /api/preview/pdf/offer-letter`, `/fee-structure`, `/receipt`; render each PDF with mock data and return `Content-Type: application/pdf` for inline embedding; session-authenticated
- **T&C changelog** — saving T&Cs now appends a dated entry to `PROPOSAL_TERMS_CHANGELOG` (JSON array stored in SystemSetting, capped at 20 entries); an optional "note" field next to the Save button lets admins describe what changed; change history card shows last 8 entries below the editor
- **Enrolment Confirmation email now configurable** — new `ENROLMENT_CONFIRMATION_EMAIL_BODY` SystemSetting key; wired into `confirm-enrolment` route; `EnrolmentConfirmationEmailPayload` in `mail.ts` gains optional `bodyText`; merge fields: `{{studentName}}`, `{{programName}}`, `{{rollNo}}`, `{{onboardingExpiryDate}}`
- **Self-Onboarding Link email now configurable** — new `SELF_ONBOARDING_LINK_EMAIL_BODY` SystemSetting key; wired into `onboarding-link` route; `OnboardingLinkEmailPayload` in `mail.ts` gains optional `bodyText`; merge fields: `{{studentName}}`, `{{programName}}`, `{{onboardingExpiryDate}}`

#### Changed
- **Settings tabs renamed** — "Proposal" → "T&C's" (`?tab=tcs`); "Offers" → "Emails" (`?tab=emails`); "Attachments" inserted between Emails and Reminders
- **Emails tab redesigned** — all system emails grouped into sections (Admissions, Enrolment, Onboarding); Payments group removed (Fee Reminders managed in Reminders tab; Payment Receipt body is hardcoded); each email card is now **3-state**: collapsed (header only, showing trigger + recipients + attachment/link badges) → click to expand read-only preview of current effective body (DB override shown normally; built-in default shown in grey italic) → click Edit for editable textarea with merge-field chips, Reset to default, and Cancel; "Custom" badge appears on any card with a DB override active
- **Staff can now create offers and enrol directly** — "Create Offer" and "Enroll Directly" buttons on the Students list are now visible to all authenticated users (not just Admins); the `/students/offer/new` and `/students/new` pages were already unguarded
- **`roles.ts` descriptions updated** — Admin: manage team, settings, batches/programs, delete students, override financials, modify installments, plus all staff actions; Staff: make offers, enrol students, do onboarding, record payments, upload documents; cannot manage team/settings/batches/programs/delete/override financials

---

## [1.6.0] — 2026-04-13

### Student Self-Onboarding, Document Management & Onboarding Status Gate

#### Added
- **Student self-onboarding flow** — admin sends a secure tokenised link to the student; student fills their own profile (blood group, address, parents, guardian) and uploads documents via a public-facing form at `/onboard/[token]`
- **`OnboardingToken` model** — 32-byte raw token in URL, SHA-256 hash stored in DB; tokens expire after 7 days
- **`SelfOnboardingStatus` enum** — `NOT_STARTED` → `LINK_SENT` → `SUBMITTED` → `APPROVED`; tracked per student
- **Self-onboarding status badge** on student profile — shows Link Sent / Profile Submitted / Profile Approved with colour coding
- **`SendOnboardingLinkButton`** — sends the self-onboard link email; visible on ONBOARDING students; hidden once approved
- **`POST /api/onboard/[token]/submit`** — student submits profile; sets `selfOnboardingStatus = SUBMITTED`
- **`POST /api/students/[id]/approve-onboarding`** — admin approves submitted profile; sets `selfOnboardingStatus = APPROVED` and `status = ACTIVE`
- **`POST /api/students/[id]/complete-onboarding`** — new endpoint; admin manually completes onboarding via wizard; sets `status = ACTIVE` + audit log entry
- **`POST /api/students/[id]/send-onboarding-link`** — sends tokenised self-onboard link via email
- **Onboarding status gate** — confirm enrolment now sets `status = ONBOARDING` (not `ACTIVE`); student stays ONBOARDING until admin clicks Complete Onboarding or approves self-submitted profile
- **Onboard wizard: Student Photo** added to document types list (was missing entirely)
- **Onboard wizard: Complete Onboarding** button calls `/api/students/[id]/complete-onboarding` and navigates to profile; replaces previous no-op navigation; Resend Email demoted to small secondary action
- **Documents section on Edit page** — `DocumentUpload` widget now appears at the top of `/students/[id]/edit` so admins can upload/replace documents alongside editing personal details
- **Received + Pending columns** on Students list — shows total payments received (green) and amount outstanding (red) per student; sourced from the payments journal
- **Onboarding tab** on Students list — filters to students with `status = ONBOARDING`

#### Changed
- **Confirm Enrolment** — sets `status = ONBOARDING` on confirmation (was `ACTIVE`); triggers ONBOARDING → ACTIVE transition only when admin explicitly completes onboarding
- **Onboard buttons** (Onboard Student, Send Link) — shown only when `status = ONBOARDING`; hidden once student is `ACTIVE`
- **Approve Profile button** — shown on student profile when `selfOnboardingStatus = SUBMITTED`; hidden otherwise
- **ConfirmEnrolmentDialog offers** — only `EARLY_BIRD` and `ACCEPTANCE_7DAY` offer types are auto-checked by default; all other types (`FULL_PAYMENT`, `FIRST_N_REGISTRATIONS`, `REFERRAL`) start unchecked
- **ConfirmEnrolmentDialog Annual plan** — Total row added at the bottom of the Year 1/2/3 breakdown table
- **`send-onboarding` route** — now accepts both `ONBOARDING` and `ACTIVE` status (was ACTIVE only)
- **Student profile buttons** — changed to `flex-wrap` to prevent overlap when multiple action buttons are visible
- **`getStudents`** — now includes `payments: { select: { amount: true } }` for Received/Pending computation

#### Fixed
- **Vercel Blob upload error "The string did not match the expected pattern"** — root cause: blob store was Private; `access: "public"` requires a Public store. New Public blob store created and token updated. Additionally, `file.name` is sanitised before passing to `put()` — spaces and special chars replaced with hyphens, leading/trailing hyphens stripped
- **TIF file support** — `.tif` and `.tiff` added to `accept=` in all three upload surfaces: admin document panel, admin onboard wizard, and student self-onboard form; `.webp` removed for consistency

---

## [1.5.0] — 2026-04-13

### PDF Redesign, Workflow Restructure & LE Branding

#### Added
- **Onboard workflow page** (`/students/[id]/onboard`) — 3-step journey for ACTIVE students: (1) profile completion by team member, (2) document uploads (Aadhaar, PAN, 10th/12th marksheets, signature stored on Vercel Blob), (3) send onboarding email with proposal PDF attached
- **`OnboardWizard` component** — multi-step wizard with profile fields, file upload/delete per document type, and onboarding email trigger; shown only for ACTIVE students without `onboardingEmailSentAt`
- **`POST /api/students/[id]/send-onboarding`** — generates proposal PDF, stamps `onboardingEmailSentAt`, sends email to student + parent
- **LE logo in all emails** — `EMAIL_HEADER` (logo + "Work is the Curriculum" tagline, brand-blue divider) and `EMAIL_FOOTER` (address, website, phone) injected into every outbound email template: offer, offer reminder, onboarding, fee reminder, and receipt emails

#### Changed
- **Confirm Enrolment dialog** restructured as 4-step wizard: (1) Benefits (confirm offers + scholarships, add one-off deductions), (2) Payment Plan (choose annual/semester/trimester/custom), (3) Registration Payment, (4) Review & Confirm
- **Offer workflow** — payment plan and final fee confirmation removed; now only captures offer eligibility (indicative); final fee locked at enrolment
- **PDF fee schedule** — logo header (`le-logo-light.png`, base64-embedded), "Work is the Curriculum" tagline, full address footer; `Rs.` replacing `₹` for Helvetica compatibility; grey deductions column; placeholder row when no installments exist; filename pattern `LE-{Program}-{Student}-FeeDetails.pdf`
- **Offer letter PDF** — same logo/footer treatment; `Rs.` instead of `₹`; `"use client"` directive removed (server-side only)
- **Email attachment filenames** standardised — `LE-{Program}-{Student}-OfferLetter-{Date}.pdf` and `LE-{Program}-{Student}-FeeDetails.pdf`

#### Fixed
- **`₹` rendering as `¹`** in PDFs — Helvetica built-in font lacks the rupee glyph; replaced with `Rs.` in both PDF generators
- **Template variables appearing literally in offer letter PDF** — `{{studentName}}` etc. were not substituted before passing `bodyText` to the PDF renderer; substitution now happens in the route before PDF render
- **`"use client"` in `offer-letter-generator.tsx`** causing null-prop errors in react-pdf — directive removed; file is server-side only

---

## [1.4.0] — 2026-04-13

### Full FIFO Payment Engine, Installment Schedule Editor & UX Fixes

#### Added
- **Full FIFO engine** (`src/lib/fifo.ts`) — `computeFifo`, `computePaymentAllocation`, `syncFifoToDb`; PAID/PARTIAL status is now exclusively FIFO-derived; cron only owns time transitions (UPCOMING→DUE→OVERDUE)
- **Installment schedule editor** — collapsible panel on the Edit Student page (visible to all, editable by admin); inline rows with PAID amount locked, PARTIAL warning, add/delete; footer shows total vs netFee
- **PATCH `/api/students/[id]/installments`** — admin-only schedule editor API; guards: cannot delete PAID installments, `changeReason` required on locked records; runs `syncFifoToDb` + audit log after every save
- **Per-payment receipt page** (`/students/[id]/receipts/payments/[paymentId]`) — shows FIFO allocation table for each payment (what it contributed to which installments), payment metadata, and print button
- **Receipt links in Payments tab** — "Receipt →" stub replaced with real links to the per-payment receipt page

#### Changed
- **Pay route** — removed per-installment status update block; transaction now runs `syncFifoToDb` after creating each payment
- **Schedule tab** — removed installment-scoped "Receipt →" links; receipts now live in the Payments tab
- **Header "Record Payment" button removed** — button was redundant; payment recording is available in the Schedule tab (per-installment) and the Payments tab (general)

#### Fixed
- **`SendOfferButton` browser form validation error** — all three buttons lacked `type="button"`, defaulting to `type="submit"` and triggering Safari's native patternMismatch validation on nearby forms; all buttons now explicitly `type="button"`
- **`send-offer` route unhandled exceptions** — added top-level try-catch so unexpected errors (e.g. PDF render failures) always return a JSON error body instead of an HTML 500 page

---

## [1.3.0] — 2026-04-13

### Fee Calculation Correctness, Schedule Tab Redesign & Form Persistence

#### Fixed
- **Outstanding amount** — was summing non-PAID `installment.amount` values, which never included manual deductions; now computed as `max(0, netFee − totalPaid)` so deductions are always reflected
- **Deductions in Schedule tab** — `expectedInstFee` for ANNUAL plans now subtracts `StudentDeduction` total from Year 1; PATCH route installment redistribution does the same so DB values stay in sync
- **Fee breakdown tooltip** on Year 1 now shows offer waiver + one-time waiver + manual deductions as a single combined reduction line
- **Admin financial plan form not pre-populating** — `registrationFeeOverride` is now loaded into the Registration Fee input when the edit form opens (was always blank before)
- **Silent baseFee reset** — edit form previously sent `baseFee = programY1+Y2+Y3` on every admin save even if year fields were untouched, which could silently reset a custom baseFee; now only sends `baseFee` when a year fee field was explicitly changed
- **`isFinancialChanged` reg fee comparison** — now compares against the stored initial override value instead of `""` so the "reason for change" prompt triggers correctly

#### Added
- **`registrationFeeOverride`** added to `Student.financial` type in `EditStudentForm` so the value flows through correctly

---

## [1.2.0] — 2026-04-13

### Batch Management, Scholarship Spread, Student Profile & UX Polish

#### Added
- **New Batch page** (`/fee-schedule/new`) — single form to create a new batch with programs, offers, and scholarships in one step; duplicate year blocked with a 409 error
- **Program management in fee schedule editor** — admin can add and remove programs from an existing batch; new programs get a `new-` prefix and are created on save; deleting a program with enrolled students shows a descriptive error
- **Batch name field** on the New Batch form alongside Year; defaults to `"Batch {year}"` if left blank
- **Batch filter dropdown** on the Students list page — filter by batch year alongside the existing program/status filters
- **LinkedIn, Instagram, University Choice, University Status** fields on the Student model — shown in a "Social & University" card on student detail and editable in the edit form
- **Schedule tab redesign** — replaced the old card layout with a clean table: Type / Fee (with breakdown + due date) / Received / Pending / Actions; default tab on student detail
- **FIFO payment allocation** on Schedule tab — total payments walk through installments in year order (0→1→2→3); each row shows scheme-computed fee (not stale DB amount), amount received, and amount pending

#### Fixed
- **`spreadAcrossYears` on scholarships** — enroll, confirm-enrolment, and PATCH routes now correctly split scholarship waivers into spread-per-year vs one-time-year-1, matching how offers are handled
- **Fee schedule create/update APIs** now persist `spreadAcrossYears` on scholarships
- **Scholarship tab redesign** — now displayed as a table matching the offers layout; Year 1 deduction badge shown for one-time scholarships
- **Offers condition display** — fee schedule view now shows "Spread" / "Year 1 Only" badges instead of raw JSON in the Condition column
- **Schedule fees computed from live scheme** — `expectedInstFee()` computes from current offers/scholarships rather than stale `inst.amount` DB values (fixes cases where a fee edit left installment records stale)

#### Refactored
- **`src/lib/fee-calc.ts`** (new) — centralises `isSpreadCondition`, `splitWaivers` helpers; used by enroll, confirm-enrolment, PATCH route, and both client forms; eliminates 4 copies of the same waiver-split logic
- Removed dead imports (`Trash2`, `AlertTriangle`, `DeleteStudentButton`) from student detail page
- Removed unreachable `else if` branch in PATCH route
- Fixed `HistoryTab` `AuditLog.role` type to use `Role` from `@prisma/client`
- Fixed session `as any` cast in edit page — replaced with typed narrowing

---

## [1.1.0] — 2026-04-11

### Fee Override & Spread Waiver Improvements

#### Added
- **Per-year fee overrides** in Create Offer form and Edit Student → Manage Financial Plan — separate inputs for Registration, Year 1, Year 2, Year 3 fees; amber total badge appears when any override is active
- **`spreadAcrossYears` checkbox on offers** in Fee Schedule editor — unchecked means the waiver is deducted in full from Year 1 only; stored in `Offer.conditions` JSON; label updates in real-time
- **Registration Fee row** in student Schedule tab — always visible at the top; uses the actual year=0 installment if it exists, otherwise synthesises from `financial.registrationPaid` + `registrationFeeOverride ?? program.registrationFee`
- **Registration fee override** — admin can set a per-student registration fee in the financial plan; stored as `StudentFinancial.registrationFeeOverride`; used by confirm-enrolment when creating the year=0 installment; updates year=0 installment if unpaid
- **Admin fee overrides panel** in Create Offer form — Registration + Y1/Y2/Y3 inputs wrapped in a styled "Admin Only" section consistent with the edit form

#### Fixed
- **Spread vs one-time waiver logic** in `enroll`, `confirm-enrolment`, and PATCH routes — replaced the blanket `totalWaiver / 3` with correct split: one-time offers deduct fully from Year 1, spread offers divide across 3 years; scholarships always spread
- **Fee overrides not sent to API** — Create Offer form was applying Y1/Y2/Y3 overrides only locally (preview); now correctly sends them to `create-offer` API which uses them in `baseFee` calculation
- **Waiver breakdown text** on Schedule tab — now shows implied waiver per installment (`programYearFee − instalmentAmount`) instead of hardcoded `totalWaiver / 3`, so it is accurate for mixed spread/one-time configurations
- **Hardcoded ₹50,000 registration note** in offer form fee summary replaced with the actual registration fee (override if set, else programme default)

#### Refactored
- `depositAmount` / `depositPaid` / `depositPaidDate` (dead fields from Phase 1) removed from `StudentFinancial`; replaced by `registrationFeeOverride Decimal?` with a clear, accurate name

---

## [1.0.0] — 2026-04-10

### Phase 10: Offer → Enrol → Onboard Workflow ✅

#### Added
- **Offer-first admissions flow** — students now enter the system as `OFFERED` before enrolment; `rollNo` is nullable and assigned only after the ₹50K registration payment is confirmed
- **Create Offer page** (`/students/offer/new`) — 3-step form: candidate details → program/offers/scholarships → review & submit; creates `OFFERED` student with financial totals but no installments
- **Send Offer Email button** on student detail — sends branded offer email with offer letter PDF attached; optional fee breakdown proposal PDF; stamps `offerSentAt` / `offerExpiresAt` (7 days)
- **Offer Letter PDF** (`src/lib/offer-letter-generator.tsx`) — LE-branded formal admission letter with fee summary box and expiry notice
- **Day-3 & Day-6 automated reminders** — cron job (`/api/cron/update-statuses`) now sends configurable reminder emails at 4 days left and 1 day left within the 7-day window
- **Day-8+ offer revision** — cron auto-revokes the `ACCEPTANCE_7DAY` waiver, recalculates net fee, logs to audit trail, and sends a revised offer letter email
- **Confirm Enrolment dialog** — records ₹50K registration payment, assigns roll number, creates installment schedule, transitions student to `ACTIVE`, optionally sends onboarding email; all in a single transaction
- **Onboarding email** — sent after enrolment confirmation; attaches the full proposal PDF (now with roll number and installment schedule); body and resource links are configurable
- **Offers tab** on students list — shows all `OFFERED` students with expiry countdown badges (violet → amber → rose → "Expires today" → "Expired")
- **Pending Offers stat card** on dashboard — violet card linking to the Offers tab
- **Offers settings tab** in Settings — editable templates for all 5 automated emails (offer, letter body, reminder 1 & 2, onboarding), bank details block, and 3 onboarding resource URLs

#### Changed
- Fee schedule seed updated to match UG-MED 2026 PDF: corrected year due dates (Aug 7 / May 15 / May 15), offer amounts, and all scholarship tiers
- `REFERRAL` removed from `OfferType`; referral is now a Category B scholarship applied to the **referring** student's record
- Students list table: `rollNo` column handles null (shows `—`); payments column shows expiry countdown for `OFFERED` students instead of installment counts
- `students.ts` `generateRollNo()` counts only students with non-null `rollNo`
- All `renderToBuffer(createElement(...))` calls cast to `any` to satisfy `@react-pdf/renderer` `DocumentProps` constraint
- `tsconfig.json` excludes `scratch/` and `dump_students.ts` from TypeScript compilation

---

## [0.9.0] — 2026-04-10

### Phase 9: Guided Student Onboarding & Audit Log ✅

#### Added
- **3-Step Enrollment Wizard** — Refactored `/students/new` into a guided stepper:
  1. **Details**: Student and guardian contact info.
  2. **Fee Plan**: Program selection, offers/scholarships, payment plans, and custom T&C overrides.
  3. **Review**: Full enrollment summary before final submission.
- **Financial Locking** — All new enrollments are now "locked" by default (`isLocked`); protects core financial commitments from accidental modification.
- **Full Audit History** — Every change to sensitive fields (Email, Contact, Base Fee, Custom Terms) is tracked in the `StudentAuditLog`.
- **History Tab** — A new tab on the student detail page showing a chronological, user-attributed log of all record mutations with "Reason for Change" transparency.
- **Admin Change Reasons** — Mandatory "Reason for Change" input in `EditStudentForm` when an admin modifies a locked record; enforced at the API level.
- **Student-Specific Terms** — Ability to override global Proposal Terms & Conditions per student during enrollment; these custom terms are automatically prioritized during PDF/DOCX generation.

#### Fixed / Improved
- **Receipt Logic** — Ensured consistent rounding in payment receipts even for partial payments.
- **Proposal API** — Optimized term fetching to prioritize `customTerms` fallback chain.

---

## [0.8.0] — 2026-04-10

### Phase 8: Polish & Deploy ✅

#### Added
- **Loading skeletons** — animated pulse skeletons on all 5 main routes (Dashboard, Students list, Student detail, Reminders, Settings) so the UI never shows a blank white screen mid-load.
- **Global error boundary** (`error.tsx`) — catches any runtime crash inside the dashboard segment and presents a clean "Something went wrong / Try Again" screen with the Vercel error digest ID for debugging.
- **Not-found page** (`not-found.tsx`) — gracefully handles invalid student IDs or removed records with a helpful "Go to Dashboard" CTA instead of a raw 404.
- **`GET /api/v1/students/[rollNo]`** external API endpoint — returns the full student record (profile, financials, installments, offers, scholarships) authenticated by `x-api-key` header, matching the same key infrastructure as the existing list and fee-schedule APIs.

#### Fixed / Improved
- **Mobile sidebar** — switched from `collapsible="icon"` to `collapsible="offcanvas"` so the sidebar opens as a full-screen drawer on phones instead of collapsing to icon-only.
- **Table horizontal scroll** — students table (and all data tables) now scroll horizontally on small viewports instead of overflowing or compressing text illegibly.
- **Responsive padding** — page content padding reduces from `p-6` on desktop to `p-4` on mobile.

---

## [0.7.0] — 2026-04-10

### Phase 7: Settings & Admin ✅

#### Added
- **Settings hub** — rebuilt `/settings` as a 4-tab control panel: Team / API Keys / Email / Proposal.
- **Team management** (`/settings?tab=team`) — view all registered users with role badges; change any user's role (ADMIN ↔ STAFF) inline via a dropdown; self-demotion blocked.
- **API key management** (`/settings?tab=api-keys`) — generate cryptographically signed keys (`le_<48 hex chars>`); key is shown exactly once at creation with a copy button; keys can be revoked; last-used timestamp displayed per key.
- **Email configuration** (`/settings?tab=email`) — SMTP Gmail address, App Password (stored in DB, not env vars), display name, From address override, and payment instructions URL; all configurable without a Vercel redeploy.
- **Dynamic SMTP in mailer** — `src/lib/mail.ts` now reads SMTP credentials from `SystemSetting` DB first, falls back to env vars for backwards compatibility.
- **Server actions** — `src/app/actions/team.ts` (role management) and `src/app/actions/api-keys.ts` (key generation/revocation), both admin-gated.

---

## [0.6.0] — 2026-04-09


### Phase 6: Proposal Letter Generation & Phase 5 Reminders Upgrade ✅

#### Added
- **Global Settings** — `SystemSetting` DB model added. A settings dashboard page created at `/settings` allowing real-time modification of system defaults like Proposal T&Cs.
- **Dynamic Fee Schedule Overhaul** — Refactored the `Fee Schedule / Edit` page to dynamically construct Offers and Scholarships from the UI rather than relying on seeded data. 
- **Automated PDF Generator** — Leveraging `@react-pdf/renderer` to dynamically generate a branded LE Proposal PDF including dynamically mapped fee and installment information.
- **Automated MS Word Generator** — Leveraging `docx` to create a Microsoft Word version of the Proposal document for ad-hoc editability locally.
- **Download UI** — Included a Proposal view within individual Student pages to quickly click and download the formats.
- **Reminders Upgrade: Clean Simple Emailing** — Modified the outbound email processor to convert heavy marketing-banner HTML templates into completely unstyled, standard Plain-Text format messaging for Reminders while quietly keeping the `<img>` tracking pixel inside to retain Read Receipt observability.
- **Reminders Upgrade: Pipeline Dashboard** — Injected a highly visual table covering the `Reminders` Dashboard detailing exactly which Students have `UPCOMING` or `PARTIAL` payments hitting within the next 30 days.

---

## [0.5.0] — 2026-04-05

### Phase 4: Payment Tracking ✅

#### Added
- **PARTIAL payment status** — new `InstallmentStatus` enum value; pay route sets PARTIAL when `paidAmount < amount`
- **Record Payment dialog** — real-time balance display and "will mark as Partial" hint when entering a partial amount
- **Payment receipt page** at `/students/[id]/receipts/[installmentId]` — printable, shows student photo, installment details, partial notice, and notes; accessible via "Receipt →" link on each paid/partial installment row
- **PrintButton** client component — triggers `window.print()`, hidden in print output
- **Print CSS** — `@media print` rule hides nav/sidebar; `.print:hidden` utility works server-side
- **Cron job** at `/api/cron/update-statuses` — daily at 03:00 UTC (Vercel Cron); transitions UPCOMING→DUE→OVERDUE with 7-day grace period; also handles PARTIAL→OVERDUE; protected by `Authorization: Bearer ${CRON_SECRET}`
- **Dashboard rewrite** — live stat cards (Active Students, Overdue, Due This Month, Collected This Month); overall collection rate progress bar; Overdue Payments list (top 10, with days overdue); Recent Payments panel (last 8, with PARTIAL badge)
- **Overdue tab** on Students list (`/students?tab=overdue`) — filters to students with at least one OVERDUE installment
- **PARTIAL badge** (orange) in the payments column of the student list

#### Changed
- `getStudents()` accepts `overdueOnly?: boolean` — adds `installments: { some: { status: "OVERDUE" } }` filter
- `formatInstallmentStatus()` includes PARTIAL → orange badge styles
- Student detail installment rows: `isPaid` now covers both PAID and PARTIAL statuses

---

## [0.4.0] — 2026-04-04

### Phases 2 & 3: Fee Schedule, Enrollment, Student Profile

#### Added
- **Student edit page** at `/students/[id]/edit` — editable personal, address, parent/guardian fields; master fields (roll no, batch, program) shown read-only
- **City** as a separate field on Student model; address section moved under Parents & Guardian card
- **Expanded student profile** — split first/last name, blood group, city, address, local address, parent 1 & 2 (name/email/phone), local guardian, document uploads
- **Document uploads** via Vercel Blob — STUDENT_PHOTO, 10th/12th Marksheet, Acceptance Letter, Aadhar Card, Drivers License
- **STUDENT_PHOTO** shown as circular avatar in student detail header; initials fallback
- **Custom installment schedule** — third payment plan tab with per-installment year dropdown; auto-fills remaining amount on add/delete
- **Waiver breakdown** shown inline on Annual installment rows (₹yearFee − ₹waiver = ₹net)
- **All amounts rounded** to the nearest rupee throughout the enrollment form and detail page

#### Fixed
- `Module not found: @prisma/client/runtime/library` — removed `Decimal` import; plain numbers passed to Prisma Decimal fields
- `AUTH_URL Invalid URL` — env var must include `https://` prefix
- `Cannot find name 'isPhoto'` TypeScript build error in `document-upload.tsx`

---

## [0.1.0] — 2026-04-04

### Phase 1: Foundation

#### Added
- **Next.js 16** project scaffold with TypeScript, Tailwind CSS v4, and shadcn/ui
- **Prisma v7** schema with 15 tables across auth, batch/program, fee schedule, student roster, financials, installments, and API keys
- **Neon PostgreSQL** integration using `@prisma/adapter-neon` (required for Prisma v7)
- **NextAuth v5** magic link authentication via Gmail SMTP (nodemailer provider)
- **Role-based access control** — ADMIN and STAFF roles enforced via Next.js proxy middleware
- **App shell** — collapsible sidebar (shadcn/ui Sidebar), top bar, responsive layout
- **Login page** — magic link email input with post-send confirmation screen
- **Dashboard page** — stat cards for Active Students, Overdue Payments, Due This Month, Paid This Month
- **Stub pages** for Students, Fee Schedule, and Settings (to be built in subsequent phases)
- **2026 batch seed data**:
  - 3 programs: Entrepreneurial Jobs (₹13.5L), Family Business (₹17.5L), Venture Builder (₹19.5L)
  - 8 offers: First 10 Registrations, 4 Early Bird tiers, Acceptance 7-Day, Full Payment, Referral
  - 11 scholarships: 7 Category A (₹15K–₹50K), 4 Category B (₹25K flat)
- **Vercel Cron stubs** for daily status updates and reminder emails (`vercel.json`)
- **External API stubs** — architecture for `/api/v1/students` and `/api/v1/fee-schedule/[year]`
- **Architecture doc** (`ARCHITECTURE.md`) — full schema, flow diagrams, page structure, API design
- **Project plan** (`PROJECT_PLAN.md`) — 8-phase build plan with task-level tracking
- **GitHub repo** — `adityajh/LE-studentroster`, connected to Vercel for auto-deploy

#### Technical decisions
- Switched from Supabase to **Neon** for PostgreSQL (avoids 2-project free tier limit on Supabase)
- Using **NextAuth v5 beta** with magic link instead of Supabase Auth
- **Prisma v7** requires adapter-based client construction — no bare `new PrismaClient()` without adapter
- `.npmrc` set to `legacy-peer-deps=true` to resolve nodemailer peer dependency conflict between `@auth/core` versions bundled by next-auth
- Next.js 16 renames `middleware.ts` to `proxy.ts`

---

## Future Enhancements

- **Razorpay integration** — auto-record payments via webhook
- **Student portal** — read-only view for students to check payment status
- **WhatsApp reminders** — via WhatsApp Business API
- **Multi-year fee schedule comparison** — view fee changes across batches
- **Bulk import** — CSV upload for existing students
