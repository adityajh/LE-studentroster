# Student Roster System — Project Plan

## Phase 1: Foundation ✅ COMPLETE
> Goal: Project scaffolding, database, auth, and basic layout

- [x] **1.1** Initialize Next.js 16 project with TypeScript, Tailwind, shadcn/ui
- [x] **1.2** Set up Neon PostgreSQL connection (env vars, Prisma Neon adapter)
- [x] **1.3** Define Prisma schema for all 15 tables, run initial migration to Neon
- [x] **1.4** Seed database with 2026 batch data (3 programs, 8 offers, 11 scholarships)
- [x] **1.5** Set up NextAuth v5 with magic link login (nodemailer provider)
- [x] **1.6** User table with ADMIN/STAFF roles, proxy middleware for route protection
- [x] **1.7** App shell: collapsible sidebar, dashboard layout, login page, dashboard stats stub
- [x] **1.8** Push to GitHub (`adityajh/LE-studentroster`), connect to Vercel

## Phase 2: Master Fee Schedule ✅ COMPLETE
> Goal: Admin can create, edit, view and lock a fee schedule per batch year

- [x] **2.1** Fee schedule list page (`/fee-schedule`) — list by year with locked/unlocked status
- [x] **2.2** Fee schedule detail page (`/fee-schedule/[year]`) — view programs, offers, scholarships
- [x] **2.3** Fee schedule edit page (`/fee-schedule/[year]/edit`) — admin only, blocked if locked
- [x] **2.4** Lock/unlock mechanism with confirmation dialog
- [x] **2.5** External API: `GET /api/v1/fee-schedule/[year]` with API key auth

## Phase 3: Student Roster & Enrollment ✅ COMPLETE
> Goal: CRUD for students, enrollment flow with fee calculation

- [x] **3.1** Student list page (`/students`) — search, filter by batch/program/status
- [x] **3.2** Student detail page (`/students/[id]`) — Profile, Financials, Installments, Documents
- [x] **3.3** Enrollment flow (`/students/new`):
  - Select batch → select program
  - Apply offers and scholarships
  - Add one-time deductions
  - System calculates net fee with year-wise breakdown (waivers spread across 3 years)
  - Select installment type (Annual / One-Time / Custom) → generates installment schedule
- [x] **3.4** Edit student profile — personal, address, parents, guardian (master fields locked)
- [x] **3.5** Roll number generation (auto-increment per batch, e.g. LE2026001)
- [x] **3.6** External API: `GET /api/v1/students` and `GET /api/v1/students/[rollNo]` with API key auth

## Phase 4: Payment Tracking ✅ COMPLETE
> Goal: Record payments, auto-calculate installment status

- [x] **4.1** Installments shown on student detail with status badges (UPCOMING / DUE / OVERDUE / PARTIAL / PAID)
- [x] **4.2** Record payment dialog (amount, date, method, notes)
- [x] **4.3** Partial payments — marks as PARTIAL when paidAmount < amount; shows balance in dialog
- [x] **4.4** Vercel Cron job at `/api/cron/update-statuses` — daily UPCOMING→DUE→OVERDUE with 7-day grace
- [x] **4.5** Dashboard wired to live data — overdue, due this month, collected this month, collection rate bar
- [x] **4.6** Payment receipt page at `/students/[id]/receipts/[installmentId]` — printable
- [x] **4.7** Overdue tab on students list

## Phase 5: Email Reminders ✅ COMPLETE
> Goal: Automated fee reminders via Gmail

- [x] **5.1** Gmail API / SMTP setup (App Password for Google Workspace)
- [x] **5.2** Email template for fee reminders (configurable plain-text body with tracking pixel)
- [x] **5.3** Vercel Cron job: daily reminder check
  - 30 days before due → ONE_MONTH reminder (if not already sent)
  - 7 days before due → ONE_WEEK reminder
  - On due date → DUE_DATE reminder
- [x] **5.4** ReminderLog: track sent / failed / bounced per installment
- [x] **5.5** Reminders tab on student detail — view full history of sent reminders
- [x] **5.6** Reminders dashboard — template management, stats, upcoming pipeline (next 30 days)

## Phase 6: Proposal Letter Generation ✅ COMPLETE
> Goal: Generate branded student proposal letters (PDF + Word)

- [x] **6.1** Design proposal letter template with all merge fields:
  - Student name, roll number, program, batch
  - Base fee (total + year-wise breakdown)
  - Offers applied (itemised)
  - Scholarships applied (itemised)
  - One-time deductions
  - Net fee (total + year-wise)
  - Installment schedule with dates and amounts
  - Terms and conditions
- [x] **6.2** PDF generation using `@react-pdf/renderer`
- [x] **6.3** Word generation using `docx` library
- [x] **6.4** Proposal page (`/students/[id]?tab=proposal`) — download PDF and Word
- [x] **6.5** Configurable T&C text in Settings (admin only)
- [x] **6.6** Dynamic Offers & Scholarships — admin can add/remove from fee schedule without code changes

## Phase 7: Settings & Admin ✅ COMPLETE
> Goal: Team management, API keys, email and system configuration

- [x] **7.1** Team members view — see all users, change roles (ADMIN ↔ STAFF)
- [x] **7.2** API key management — generate (shown once), revoke, view last-used timestamp
- [x] **7.3** Email configuration — SMTP user, App Password, display name, From address, payment URL (all stored in DB, no redeploy required)
- [x] **7.4** Settings hub — 4-tab layout: Team / API Keys / Email / Proposal

## Phase 8: Polish & Deploy ✅ COMPLETE
> Goal: Production-ready, fully tested

- [x] **8.1** Loading skeletons on all 5 routes (Dashboard, Students, Student detail, Reminders, Settings)
- [x] **8.2** Global error boundary (`error.tsx`) — catches runtime crashes, "Try Again" button
- [x] **8.3** Not-found page (`not-found.tsx`) — handles invalid IDs gracefully
- [x] **8.4** Mobile responsiveness — sidebar offcanvas drawer, tables scroll horizontally, reduced padding
- [x] **8.5** External API completion — `GET /api/v1/students/[rollNo]` with full financial + installment data
- [x] **8.6** Production database seeded and live on Vercel

---

## Phase 9: Polish & Audit ✅ COMPLETE
> Goal: Guided onboarding, financial locking, full audit trail, payment journal

- [x] **9.1** 3-step enrollment wizard with guided onboarding UX
- [x] **9.2** Financial plan locking (lock after enrollment, admin can unlock)
- [x] **9.3** StudentAuditLog — mandatory "reason for change" on any edit, full history tab
- [x] **9.4** Global audit log page (`/audit-logs`)
- [x] **9.5** Itemised fees display on student detail
- [x] **9.6** Delete student (soft audit, admin only)
- [x] **9.7** Mandatory parent contacts on enrollment
- [x] **9.8** Collapsible financial plan panel on student detail

---

## Phase 10: Offer → Enrolment Workflow ✅ COMPLETE

> Goal: Replace the "enroll first" model with the real admissions workflow:
> **Offer → Receive ₹50K Payment → Enrol → Onboard**
>
> A student exists in the system from the moment an offer is made — not just after enrolment.
> The ₹50K registration payment is the trigger that converts a candidate into an enrolled student.

---

### 10A — Schema & Data Alignment

**Schema migration (`prisma/schema.prisma`)**

1. Add `OFFERED` to `StudentStatus` enum (sits before `ACTIVE`).
2. Make `Student.rollNo` nullable (`String? @unique`) — assigned at enrolment confirmation, not at offer stage.
3. Add offer-window tracking fields to `Student`:
   ```
   offerSentAt          DateTime?   // when offer email was first sent
   offerExpiresAt       DateTime?   // = offerSentAt + 7 days
   offerReminder1SentAt DateTime?   // Day-3 nudge
   offerReminder2SentAt DateTime?   // Day-6 nudge
   offerRevised         Boolean     @default(false)  // true once 7-day waiver revoked on Day 8
   onboardingEmailSentAt DateTime?  // sent after ₹50K confirmed
   ```
4. Remove `REFERRAL` from `OfferType` enum (handled as scholarship instead — see data step below). Keep existing `StudentOffer` rows intact; referral simply won't appear as an offer type going forward.

**Fee schedule data alignment (seed / admin edit)**

Update the 2026 batch fee schedule to exactly match the UG-MED PDF:

| Item | Change |
|---|---|
| Year 1 due date | `7 August 2026` (was generic `1 Jul 2026`) |
| Year 2 due date | `15 May 2027` (was `1 Jul 2027`) |
| Year 3 due date | `15 May 2028` (was `1 Jul 2028`) |
| Early bird — 30 Mar 2026 | ₹1,00,000 — deadline `30 Mar 2026` |
| Early bird — 31 May 2026 | ₹50,000 — deadline `31 May 2026` |
| Full 3-year payment | Store as ₹1,35,000 (10% of ₹13,50,000); add note in `conditions` JSON |
| Scholarship: Young Innovator | ₹25,000–₹1,00,000 (Cat A) |
| Scholarship: Entrepreneurial Spirit | ₹0–₹1,00,000 (Cat A) |
| Scholarship: Leadership & Community Impact | ₹15,000–₹50,000 (Cat A) |
| Scholarship: Athlete Excellence | ₹15,000–₹50,000 (Cat A) — conditions JSON stores state/national/international tiers |
| Scholarship: Creative Talent | ₹15,000–₹50,000 (Cat A) |
| Scholarship: Referral | ₹25,000 per referral (Cat B) — **applied to referring student's record, not the new student's** |
| Scholarship: Defence | ₹25,000 (Cat B) |
| Scholarship: Single Parent | ₹25,000 (Cat B) |
| Scholarship: Learning Differences | ₹25,000 (Cat B) |
| Remove: NIOS scholarship | Was in seed, not in 2026 PDF |

---

### 10B — Offer Flow (UI + API)

**New "Create Offer" form** (`/students/new/offer` or modal from students list)

A lightweight 2-step form — only what's needed at offer stage:
- Step 1: Name, email, phone, city
- Step 2: Program selection + applicable offers + scholarships + intended installment type

On submit:
- Creates `Student` with `status = OFFERED`, no `rollNo`, no installments
- Sets `offerExpiresAt = now + 7 days`
- Offers/scholarships saved to `StudentOffer` / `StudentScholarship`
- Financial totals computed and saved to `StudentFinancial` (same as enrolment, minus installments)
- Redirects to student detail with "Send Offer Email" prompt

**Preserve direct-enrol path**

The existing 3-step enrollment wizard (`/students/new`) remains for cases where the student is already confirmed (retroactive entries, walk-ins). It creates an `ACTIVE` student with roll number and installments immediately, same as today.

**Student detail page — OFFERED state**

When `status = OFFERED`, show:
- Offer expiry countdown banner (e.g. "Offer expires in 4 days — ₹25K waiver at risk")
- "Send Offer Email" button (disabled after first send; shows "Resend" after)
- "Confirm Enrolment" primary CTA — opens a dialog to record the ₹50K registration payment

**Offer email** (`sendOfferEmail()` in `mail.ts`)

- Body: configurable template (SystemSetting key `OFFER_EMAIL_BODY`) with merge fields `{{studentName}}`, `{{programName}}`, `{{offerExpiryDate}}`, `{{bankDetails}}`
- Default body matches `OfferEmail.md`
- Attachment 1: **Offer Letter PDF** (new template — see 10D)
- Attachment 2 (optional, staff can toggle): **Proposal PDF** — the existing Phase 6 proposal generator, adapted to run pre-enrolment (without roll number/installments; shows fee breakdown with scholarships/offers applied). Replaces the manual "FinalPaymentScheme" breakdown currently sent as a separate email.
- On send: sets `Student.offerSentAt = now`, `offerExpiresAt = now + 7 days`

---

### 10C — 7-Day Window Automation (extend existing cron)

Extend `/api/cron/update-statuses` (already runs daily) to process `OFFERED` students:

| Day | Condition | Action |
|---|---|---|
| Day 3 | `offerReminder1SentAt` is null AND `offerRevised` is false | Send Reminder 1 email: "Your offer expires in 4 days — seat not yet secured" |
| Day 6 | `offerReminder2SentAt` is null AND `offerRevised` is false | Send Reminder 2 email: "Offer expires tomorrow — ₹25K waiver will be lost" |
| Day 8+ | `offerRevised` is false AND status is still `OFFERED` | Revoke ₹25K ACCEPTANCE_7DAY offer: remove from `StudentOffer`, recalculate `StudentFinancial` net fee, set `offerRevised = true`, send Revised Offer Email (see below) |

**Reminder email** (`sendOfferReminderEmail()`)
- Configurable template (SystemSetting keys `OFFER_REMINDER_1_BODY`, `OFFER_REMINDER_2_BODY`)
- Merge fields: `{{studentName}}`, `{{daysLeft}}`, `{{offerExpiryDate}}`

**Revised Offer Email** (`sendRevisedOfferEmail()`)
- Same format as offer email but without the 7-day waiver
- Attachment: regenerated Offer Letter PDF (and optionally Proposal PDF) reflecting the revised net fee
- Subject line: "Updated Offer — Working BBA 2026"

---

### 10D — Offer Letter PDF

**New PDF template** (`src/lib/offer-letter-generator.tsx`)

Generates the formal offer letter matching `OfferEmailAttachmentLetter.pdf`:
- LE letterhead / logo
- Student name, program name, batch year
- "About Working BBA" section (static body text, configurable via SystemSetting `OFFER_LETTER_BODY`)
- Program Expectations section (static)
- Acknowledgement line at bottom

This is intentionally simpler than the Proposal PDF — it's a welcome/admission letter, not a financial document. The financial breakdown is handled by the existing Proposal PDF (Phase 6).

---

### 10E — Enrolment Confirmation & Onboarding

**"Confirm Enrolment" action** (on OFFERED student detail)

Dialog flow:
1. Staff records ₹50K registration payment (amount, date, mode, reference no)
2. On confirm:
   - Payment saved to `Payment` table
   - `StudentFinancial.registrationPaid = true`, `registrationPaidDate = now`
   - Roll number generated (existing `generateRollNo()`)
   - Installments created (existing logic from enrol route)
   - `Student.status → ACTIVE`
   - `StudentFinancial.isLocked = true`
   - Prompt: "Send onboarding email now?" (yes/no)

**Onboarding email** (`sendOnboardingEmail()`)
- Body: configurable template (SystemSetting key `ONBOARDING_EMAIL_BODY`)
- Default body matches `OnboardingEmail.rtf`
- Merge fields: `{{studentName}}`, `{{programName}}`
- Attachment: Proposal PDF (existing Phase 6 generator — now has roll number and installment schedule)
- Configurable resource links stored in SystemSettings: `ONBOARDING_HANDBOOK_URL`, `ONBOARDING_WELCOME_KIT_URL`, `ONBOARDING_YEAR1_URL`
- On send: sets `Student.onboardingEmailSentAt = now`
- "Send Onboarding Email" button also available manually on student detail if `onboardingEmailSentAt` is null

---

### 10F — Settings Additions

New entries in **Settings → Email** tab:

| Key | Label | Default |
|---|---|---|
| `OFFER_EMAIL_BODY` | Offer email body | (from OfferEmail.md) |
| `OFFER_LETTER_BODY` | Offer letter body (PDF) | (from OfferEmailAttachmentLetter.pdf) |
| `OFFER_REMINDER_1_BODY` | Day-3 reminder body | Generic nudge |
| `OFFER_REMINDER_2_BODY` | Day-6 reminder body | Urgency nudge |
| `ONBOARDING_EMAIL_BODY` | Onboarding email body | (from OnboardingEmail.rtf) |
| `BANK_DETAILS` | Payment bank details block | ICICI / Storysells details |
| `ONBOARDING_HANDBOOK_URL` | Handbook PDF link | — |
| `ONBOARDING_WELCOME_KIT_URL` | Welcome Kit link | — |
| `ONBOARDING_YEAR1_URL` | Year 1 program flow link | — |

---

### 10G — Students List Updates

- Add **"Offered"** tab alongside All / Active / Overdue
- Each offered student row shows a **"X days left"** badge (yellow → red as expiry nears)
- Expired offers (Day 8+, `offerRevised = true`) shown with a "Revised" badge
- Dashboard: add "Pending Offers" count card

---

### 10H — Owner Actions (before going live)

- [ ] Configure SMTP in Settings → Email if not already done
- [ ] Set bank payment details (`BANK_DETAILS` in Settings → Email)
- [ ] Set onboarding resource links (`ONBOARDING_HANDBOOK_URL`, etc.) in Settings → Email
- [ ] Review and customise offer email body template
- [ ] Review and customise offer letter PDF body text
- [ ] Update fee schedule due dates and scholarship amounts to match UG-MED PDF
- [ ] Verify referral scholarship appears as Category B and test adding it to a referring student

---

---

## Phase 11: Batch & Fee Schedule Management ✅ COMPLETE

> Goal: Admin can create and manage batches without touching seed files

- [x] **11.1** New Batch page (`/fee-schedule/new`) — create a batch with programs, offers, and scholarships in a single form; duplicate year returns a 409 error; batch name defaults to `"Batch {year}"`
- [x] **11.2** Program management in fee schedule editor — add / remove programs from existing batches; deleting a program with enrolled students blocked with a descriptive error
- [x] **11.3** Offer condition display — fee schedule view shows "Spread" / "Year 1 Only" badges instead of raw JSON
- [x] **11.4** `spreadAcrossYears` checkbox per scholarship in both new-batch and edit-fee-schedule forms
- [x] **11.5** Batch filter dropdown on students list

---

## Phase 12: Fee Calculation Correctness & Schedule UX ✅ COMPLETE

> Goal: All fee math is provably correct; schedule tab is the primary payment view

- [x] **12.1** Centralise waiver-split logic in `src/lib/fee-calc.ts` (`isSpreadCondition`, `splitWaivers`)
- [x] **12.2** ANNUAL redistribution in PATCH route uses `splitWaivers`; deductions subtracted from Year 1
- [x] **12.3** Schedule tab redesigned — table layout (Type / Fee / Received / Pending / Actions); FIFO allocation from payments journal
- [x] **12.4** Schedule fees computed from live scheme (`expectedInstFee`) — not stale DB amounts
- [x] **12.5** Outstanding = `max(0, netFee − totalPaid)` — previously summed installment amounts, ignoring deductions
- [x] **12.6** Admin financial plan form: registration fee pre-populated from `registrationFeeOverride`; `baseFee` only sent when year fields explicitly changed (prevents silent reset)
- [x] **12.7** LinkedIn, Instagram, University Choice/Status fields on student profile

---

## Phase 13: Full FIFO Engine, Installment Editor & UX Fixes ✅ COMPLETE

> Goal: Payment allocation is fully FIFO-based; admins can edit the installment schedule; receipts are per-payment

- [x] **13.1** `src/lib/fifo.ts` — `computeFifo`, `computePaymentAllocation`, `syncFifoToDb`; PAID/PARTIAL status exclusively FIFO-derived
- [x] **13.2** Pay route updated — `syncFifoToDb` runs in transaction after every payment; per-installment status update block removed
- [x] **13.3** Cron `update-statuses` — added clarifying comments; logic unchanged (WHERE clauses already exclude PAID)
- [x] **13.4** `PATCH /api/students/[id]/installments` — admin-only schedule editor; PAID-delete guard; `changeReason` required on locked records; runs FIFO + audit log
- [x] **13.5** `InstallmentEditor` component — collapsible panel on Edit Student; staff read-only, admin inline-editable; PAID rows locked
- [x] **13.6** Per-payment receipt page (`/students/[id]/receipts/payments/[paymentId]`) — FIFO allocation breakdown table per payment
- [x] **13.7** PaymentsTab — "View Receipt" stub replaced with real link to per-payment receipt
- [x] **13.8** Schedule tab — installment-scoped Receipt links removed; receipts live in Payments tab
- [x] **13.9** Header "Record Payment" button removed — redundant; recording available in Schedule tab (per-installment) and Payments tab
- [x] **13.10** `SendOfferButton` — all buttons given `type="button"`; route wrapped in try-catch; fixes Safari form validation error

---

---

## Phase 14: Student Self-Onboarding & Document Management ✅ COMPLETE

> Goal: Students can fill their own profile and upload documents via a secure link; admins can manage documents from the Edit page

- [x] **14.1** `OnboardingToken` model — 32-byte raw token in URL, SHA-256 hash in DB, 7-day TTL
- [x] **14.2** `SelfOnboardingStatus` enum — `NOT_STARTED` → `LINK_SENT` → `SUBMITTED` → `APPROVED`
- [x] **14.3** Student self-onboard form at `/onboard/[token]` — profile fields + document uploads
- [x] **14.4** `POST /api/onboard/[token]/submit` — student submits profile; sets status SUBMITTED
- [x] **14.5** `POST /api/students/[id]/send-onboarding-link` — generates token, sends link email
- [x] **14.6** `SendOnboardingLinkButton` component — resend-safe, shows current status
- [x] **14.7** Self-onboarding status badge on student profile header
- [x] **14.8** `POST /api/students/[id]/approve-onboarding` — admin approves; sets APPROVED + ACTIVE
- [x] **14.9** `DocumentUpload` + `DocumentStatusStrip` components — upload/replace/delete per type; photo thumbnail; status indicators; 1 MB client + server limit
- [x] **14.10** Documents section added to `/students/[id]/edit` — admins can manage files alongside personal details
- [x] **14.11** Document uploads accept `.pdf`, `.jpg`, `.jpeg`, `.png`, `.tif`, `.tiff`
- [x] **14.12** Vercel Blob pathname sanitisation — spaces and special chars in filenames replaced with hyphens before calling `put()` to prevent pattern errors
- [x] **14.13** Vercel Blob store must be **Public** — `access: "public"` in all `put()` calls

---

## Phase 15: Onboarding Status Gate ✅ COMPLETE

> Goal: Status correctly reflects where a student is in the pipeline; ONBOARDING → ACTIVE only via explicit admin action

- [x] **15.1** `ONBOARDING` added to `StudentStatus` enum (sits between OFFERED and ACTIVE)
- [x] **15.2** Confirm Enrolment sets `status = ONBOARDING` (was ACTIVE)
- [x] **15.3** `POST /api/students/[id]/complete-onboarding` — sets ACTIVE + audit log; called by wizard
- [x] **15.4** `send-onboarding` route accepts both ONBOARDING and ACTIVE status
- [x] **15.5** `OnboardWizard` Complete Onboarding button calls complete-onboarding API + navigates to profile; Resend Email is a secondary action
- [x] **15.6** Student profile page: Onboard Student + Send Link buttons shown only when `status = ONBOARDING`; hidden once ACTIVE
- [x] **15.7** Onboarding tab on students list shows all ONBOARDING students
- [x] **15.8** Received + Pending columns on students list (payments journal source of truth)

---

## Phase 16: ConfirmEnrolment UX Polish ✅ COMPLETE

- [x] **16.1** Offer auto-check: only EARLY_BIRD and ACCEPTANCE_7DAY auto-checked by default; FULL_PAYMENT, FIRST_N_REGISTRATIONS, REFERRAL start unchecked
- [x] **16.2** Annual plan Total row — bold total row at bottom of Year 1/2/3 breakdown table
- [x] **16.3** `offer.type` passed from student page to dialog (was missing; needed for auto-check logic)
- [x] **16.4** Profile page button area changed to `flex-wrap` to prevent overlap on narrow screens

---

## Phase 17: Staff Roles, Settings Redesign & Email Templates ✅ COMPLETE

> Goal: Staff team members can use the full admissions + onboarding workflow; all system emails are visible and configurable in one place; admins can preview PDFs without leaving settings

- [x] **17.1** Staff can now access Create Offer and Enroll Directly (removed Admin-only guard on student list buttons and `/students/offer/new`, `/students/new` pages)
- [x] **17.2** `roles.ts` descriptions updated to reflect actual permission sets for Admin and Staff
- [x] **17.3** Settings tabs renamed: "Proposal" → "T&C's" (`?tab=tcs`), "Offers" → "Emails" (`?tab=emails`)
- [x] **17.4** T&C changelog — saving T&Cs appends a dated + noted entry to `PROPOSAL_TERMS_CHANGELOG`; last 8 entries shown below the editor
- [x] **17.5** Emails tab redesigned — all system emails in 4 sections (Admissions, Enrolment, Onboarding, Payments); Payments section removed (Fee Reminders in Reminders tab)
- [x] **17.6** Email cards are 3-state: collapsed → read-only preview (effective body with built-in default fallback) → editable textarea with merge-field chips; "Custom" badge, Reset to default, Cancel
- [x] **17.7** `ENROLMENT_CONFIRMATION_EMAIL_BODY` — new SystemSetting key; wired into `confirm-enrolment` route; `mail.ts` payload updated
- [x] **17.8** `SELF_ONBOARDING_LINK_EMAIL_BODY` — new SystemSetting key; wired into `onboarding-link` route; `mail.ts` payload updated
- [x] **17.9** Attachments tab (new) — lists all 3 system PDFs with "attached to" + "configurable sections" info
- [x] **17.10** PDF preview routes (`/api/preview/pdf/*`) — render each PDF with mock student data; embedded inline via `<iframe>` on click

---

## Pending (owner: Aditya)

- [ ] Upload LE Logo / Letterhead for Proposal PDF (currently placeholder)
- [ ] Set Gmail App Password via Settings → Email tab
- [ ] Draft final proposal letter body text in Settings → Proposal tab
- [ ] Refine Offers, Scholarships, and T&C wording in Fee Schedule
- [ ] End-to-end test: enroll student → generate proposal → record payment → confirm reminder
- [ ] Configure onboarding resource links (Handbook, Welcome Kit, Year 1 flow) in Settings → Email

---

## Future Enhancements (post v1)

- **Razorpay integration** — auto-record payments via webhook
- **Student portal** — read-only view for students to check payment status
- **WhatsApp reminders** — via WhatsApp Business API
- **Multi-year fee schedule comparison** — view fee changes across batches
- **Invite-by-email flow** — formal staff onboarding with magic link invite

---

## Pre-Build Setup Checklist

- [x] Neon PostgreSQL — project created, connection strings configured
- [x] GitHub — repo `adityajh/LE-studentroster` created and connected
- [x] Vercel — project renamed `le-student-roster`, env vars set, auto-deploy from `main`
- [ ] Gmail App Password — configure via Settings → Email (no redeploy needed)
- [ ] LE Logo files — PNG/SVG for proposal letter header
- [ ] Proposal Letter copy — final body text and T&C wording
