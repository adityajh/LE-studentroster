# Architecture — LE Student Roster

> Last updated: 2026-04-13 (v1.7.0)

---

## Overview

A Next.js 16 App Router web application for Let's Enterprise (LE) to manage student admissions, fee tracking, and communications for the UG-MED programme. Hosted on Vercel, backed by Neon PostgreSQL via Prisma 7.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components) |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Database | Neon PostgreSQL (serverless) |
| ORM | Prisma 7 (adapter-neon, `prisma db push`) |
| Auth | NextAuth v5 — magic link via Gmail SMTP (nodemailer) |
| Email | Nodemailer (Gmail App Password, configurable via DB settings) |
| PDF | `@react-pdf/renderer` |
| Word | `docx` |
| File storage | Vercel Blob (student documents, **Public** store) |
| Hosting | Vercel (auto-deploy from `main`) |
| Cron | Vercel Cron (daily 03:00 UTC) |

---

## Repository Layout

```
src/
  app/
    (auth)/               — Login pages (magic link)
    (dashboard)/          — All internal app pages
      dashboard/          — Stats overview
      students/           — Student list, detail, enrol, offer
      fee-schedule/       — Fee schedule CRUD
      reminders/          — Reminder pipeline view
      audit-logs/         — Global audit log
      settings/           — Team / API Keys / Email / T&C's / Emails / Attachments / Reminders
    actions/              — Server actions (settings, team, api-keys, reminders)
    api/
      auth/               — NextAuth handler
      cron/               — Scheduled jobs
      fee-schedule/       — Admin fee schedule mutation endpoints
      preview/pdf/        — Sample PDF preview routes (offer-letter, fee-structure, receipt)
      students/           — Student mutation endpoints
      reminders/          — Email tracking pixel endpoint
      v1/                 — External API (API key auth)
  auth.ts                 — NextAuth config
  proxy.ts                — Route protection middleware (renamed from middleware.ts in Next.js 16)
  lib/
    prisma.ts             — Prisma client singleton (Neon adapter)
    students.ts           — getStudents, getStudentById, getEnrollmentFormData, formatters
    mail.ts               — All email send functions (SMTP via SystemSetting or env)
    fee-schedule.ts       — formatINR, fee calculation helpers
    fee-calc.ts           — Shared fee helpers: isSpreadCondition, splitWaivers
    fifo.ts               — Payment FIFO engine: computeFifo, computePaymentAllocation, syncFifoToDb
    pdf-generator.tsx     — Proposal PDF (react-pdf)
    receipt-pdf.tsx       — Payment receipt PDF (react-pdf)
    offer-letter-generator.tsx — Offer letter PDF (react-pdf)
    docx-generator.ts     — Proposal Word document (docx)
    button-variants.ts    — Shared button style helper
    utils.ts              — cn() tailwind merge
  components/
    students/             — RecordPaymentDialog, EnrollmentForm, CreateOfferForm,
                            SendOfferButton, ConfirmEnrolmentDialog, EditStudentForm,
                            InstallmentEditor, HistoryTab, PaymentsTab, RemindersTab, ProposalTab,
                            DocumentUpload, DocumentStatusStrip, OnboardWizard,
                            SendOnboardingLinkButton
    onboarding/           — SelfOnboardForm (student-facing self-onboard form)
    fee-schedule/         — FeeScheduleEditForm, NewFeeScheduleForm
    settings/             — TeamTab, ApiKeysTab, EmailTab, ProposalSettings, OfferSettings, AttachmentsTab, RemindersTab
    ui/                   — shadcn/ui components + brand components (Eyebrow, SoftCard, AdminCard)
prisma/
  schema.prisma
  seed.ts
```

---

## Database Schema

### Auth tables
`User`, `Account`, `Session`, `VerificationToken` — standard NextAuth v5 tables. `User` has a `role` field (`ADMIN` | `STAFF`).

### Batch & Programme
```
Batch (year, name)
  └── Program[] (name, totalFee, year1Fee, year2Fee, year3Fee, yearWiseDetails JSON)
  └── FeeSchedule (isLocked, lockedBy)
        └── Offer[] (type, waiverAmount, deadline, conditions JSON)
        └── Scholarship[] (category A/B, name, minAmount, maxAmount)
```

`Program.yearWiseDetails` is a JSON field storing per-year due dates and fee breakdowns. For 2026: Year 1 due 7 Aug 2026, Year 2 due 15 May 2027, Year 3 due 15 May 2028.

### Student Roster
```
Student (rollNo?, name, firstName?, lastName?, email, contact, batchId, programId, status,
         selfOnboardingStatus, selfOnboardingSubmittedAt?)
  ├── profile: bloodGroup, city, address, localAddress
  ├── parents: parent1Name/Email/Phone, parent2Name/Email/Phone
  ├── guardian: localGuardianName/Phone/Email
  ├── social: linkedinHandle, instagramHandle, universityChoice, universityStatus
  ├── offer-window: offerSentAt, offerExpiresAt, offerReminder1SentAt,
  │                 offerReminder2SentAt, offerRevised, onboardingEmailSentAt
  ├── StudentFinancial (baseFee, totalWaiver, totalDeduction, netFee,
  │                     installmentType, customTerms, isLocked,
  │                     registrationFeeOverride?, registrationPaid, registrationPaidDate?)
  ├── StudentOffer[] (offerId, waiverAmount)
  ├── StudentScholarship[] (scholarshipId, amount)
  ├── StudentDeduction[] (description, amount)  ← manual admin-only deductions
  ├── Installment[] (year, label, dueDate, amount, status, paidDate, paidAmount)
  │     ├── Payment[] (date, amount, paymentMode, referenceNo)
  │     └── ReminderLog[] (type, sentAt, readAt, emailStatus)
  ├── StudentDocument[] (type, fileName, fileUrl, fileSize, uploadedById — Vercel Blob)
  ├── OnboardingToken[] (tokenHash, expiresAt) ← self-onboarding secure link tokens
  └── StudentAuditLog[] (field, oldValue, newValue, reason, changedBy)
```

`Student.rollNo` is **nullable** — assigned only when a student is confirmed enrolled (status transitions from `OFFERED` → `ONBOARDING`). Roll number format: `LE{year}{seq}` e.g. `LE2026001`.

`StudentFinancial.registrationFeeOverride` — admin can override the registration fee per-student (null = use `Program.registrationFee`). Stored separately so it can be pre-populated in the edit form and applied to the year=0 installment.

### Supporting tables
- `ApiKey` — hashed API keys for external API access
- `SystemSetting` — key/value store for runtime-configurable settings (SMTP, email templates, URLs)
- `ReminderSetting` — per-type reminder configuration (days out, subject, body)

### Enums
| Enum | Values |
|---|---|
| `StudentStatus` | `OFFERED` → `ONBOARDING` → `ACTIVE` → `ALUMNI` / `WITHDRAWN` |
| `SelfOnboardingStatus` | `NOT_STARTED` → `LINK_SENT` → `SUBMITTED` → `APPROVED` |
| `InstallmentStatus` | `UPCOMING` → `DUE` → `OVERDUE` / `PARTIAL` / `PAID` |
| `InstallmentType` | `ONE_TIME`, `ANNUAL`, `CUSTOM` |
| `OfferType` | `FIRST_N_REGISTRATIONS`, `EARLY_BIRD`, `ACCEPTANCE_7DAY`, `FULL_PAYMENT`, `REFERRAL` |
| `ScholarshipCategory` | `A` (merit, variable amount), `B` (circumstantial, flat ₹25K) |
| `Role` | `ADMIN`, `STAFF` |
| `PaymentMode` | `CASH`, `CHEQUE`, `NEFT`, `UPI`, `RTGS`, `OTHER` |
| `DocumentType` | `STUDENT_PHOTO`, `TENTH_MARKSHEET`, `TWELFTH_MARKSHEET`, `ACCEPTANCE_LETTER`, `AADHAR_CARD`, `DRIVERS_LICENSE` |

---

## Fee Calculation

All fee math is centralised in `src/lib/fee-calc.ts`.

### `splitWaivers(offers, scholarships)`

Splits waivers into spread-per-year and one-time-year-1 amounts:

```
spreadPerYear = round((spreadOfferWaiver + spreadSchWaiver) / 3)
onetimeTotal  = onetimeOfferWaiver + onetimeSchWaiver
```

An offer is **spread** when `Offer.conditions` is null or has no `spreadAcrossYears: false` flag. A scholarship is **spread** when `Scholarship.spreadAcrossYears = true`.

### ANNUAL installment formula

```
Year 0 (Registration) = registrationFeeOverride ?? program.registrationFee
Year 1                = max(0, program.year1Fee − spreadPerYear − onetimeTotal − totalDeductions)
Year 2                = max(0, program.year2Fee − spreadPerYear)
Year 3                = max(0, program.year3Fee − spreadPerYear)
```

`totalDeductions` = sum of all `StudentDeduction.amount` records. Applied to Year 1 only.

### Outstanding

`outstanding = max(0, StudentFinancial.netFee − totalPaid)`

`netFee = baseFee − totalWaiver − totalDeduction` (computed and stored at save time).

### FIFO Payment Engine (`src/lib/fifo.ts`)

All payment allocation is FIFO (first-in, first-out) over installments sorted by `dueDate ASC`.

- **`computeFifo(totalPaid, installments)`** — returns a Map of `installmentId → { allocated, status }`. Status is `PAID` / `PARTIAL` / `UNPAID`.
- **`computePaymentAllocation(paymentId, allPayments, installments)`** — computes what a single payment contributed to each installment (delta between FIFO state before and after the payment). Used for per-payment receipts.
- **`syncFifoToDb(tx, studentId)`** — runs inside a Prisma transaction after every payment change; writes `PAID` / `PARTIAL` back to installment rows. Time-based statuses (`UPCOMING`, `DUE`, `OVERDUE`) are preserved on unpaid installments and remain the cron's responsibility.

**Authority split:**
| Status | Set by |
|---|---|
| `PAID`, `PARTIAL` | `syncFifoToDb` (pay route + installment editor) |
| `UPCOMING`, `DUE`, `OVERDUE` | Cron `update-statuses` |

### Schedule tab (display-only)

Fees are recomputed from the live scheme on every page render via `expectedInstFee()` — this ensures the display is always correct even if DB installment amounts are stale. Received/pending amounts come from FIFO-derived `inst.paidAmount` written by `syncFifoToDb`.

---

## Admissions & Onboarding Flow

```
Create Offer (/students/offer/new)
    │  status = OFFERED, rollNo = null
    │  StudentFinancial created (no installments)
    ▼
Send Offer Email (button on student detail)
    │  Attaches: Offer Letter PDF + optional Proposal PDF
    │  Sets offerSentAt, offerExpiresAt = +7 days
    ▼
7-Day Window (automated via daily cron)
    │  Day 3: Reminder 1 email (4 days left)
    │  Day 6: Reminder 2 email (1 day left)
    │  Day 8+: Revoke ACCEPTANCE_7DAY waiver, send Revised Offer email
    ▼
Confirm Enrolment (dialog on student detail)
    │  Records registration payment, assigns rollNo (LE{year}{seq})
    │  Creates installment schedule
    │  status → ONBOARDING, isLocked = true
    ▼
Admin Onboard Wizard (/students/[id]/onboard) — 3 steps
    │  Step 1: Fill student profile (blood group, address, parents, guardian)
    │  Step 2: Upload documents (photo, marksheets, Aadhar, etc.)
    │  Step 3: Send onboarding email (attaches Proposal PDF)
    │
    │  [optional parallel path via Send Self-Onboarding Link]
    │  Student fills own profile at /onboard/[token]
    │  selfOnboardingStatus: NOT_STARTED → LINK_SENT → SUBMITTED
    │  Admin clicks Approve Profile → selfOnboardingStatus = APPROVED
    ▼
Complete Onboarding (wizard button OR admin approval)
    │  POST /api/students/[id]/complete-onboarding  (wizard path)
    │  POST /api/students/[id]/approve-onboarding   (self-onboard path)
    │  status → ACTIVE
    │  Onboard buttons hidden from profile page
    ▼
Active Student — fee tracking, reminders, payments
```

Direct enrolment path (`/students/new`) still exists for retroactive entries — creates `ACTIVE` student with roll number and installments immediately.

### Self-Onboarding Token Security
- Raw 32-byte token lives only in the URL — never stored in DB
- DB stores `SHA-256(rawToken)` as `tokenHash` in `OnboardingToken`
- On each request: hash the URL token, look up by hash, validate expiry
- Expired or unknown tokens return 404/410; no information leakage

---

## API Routes

### Internal (session-authenticated)

| Method | Route | Description |
|---|---|---|
| POST | `/api/students/create-offer` | Create OFFERED student |
| POST | `/api/students/[id]/send-offer` | Send offer email + PDF |
| POST | `/api/students/[id]/confirm-enrolment` | Record ₹50K payment, assign roll no, activate |
| POST | `/api/students/enroll` | Direct enrolment (legacy path) |
| PATCH/DELETE | `/api/students/[id]` | Update or delete student |
| POST | `/api/students/[id]/pay` | Record payment (runs FIFO write-back) |
| PATCH | `/api/students/[id]/installments` | Admin: edit installment schedule |
| GET | `/api/students/[id]/pay/[paymentId]/receipt` | Generate receipt PDF |
| GET | `/api/students/[id]/proposal` | Generate proposal PDF or DOCX |
| POST | `/api/students/[id]/documents` | Upload document to Vercel Blob (public store) |
| DELETE | `/api/students/[id]/documents` | Delete document from Vercel Blob + DB |
| POST | `/api/students/[id]/send-onboarding-link` | Generate OnboardingToken + send self-onboard link email |
| POST | `/api/students/[id]/send-onboarding` | Send onboarding email with Proposal PDF attached |
| POST | `/api/students/[id]/complete-onboarding` | Set status ACTIVE (admin completes wizard) + audit log |
| POST | `/api/students/[id]/approve-onboarding` | Approve student self-submitted profile; set selfOnboardingStatus=APPROVED + status=ACTIVE |
| POST | `/api/onboard/[token]/submit` | Student submits self-onboard profile (token auth) |
| POST | `/api/onboard/[token]/documents` | Student uploads document via self-onboard link (token auth) |
| DELETE | `/api/onboard/[token]/documents` | Student deletes document via self-onboard link (token auth) |
| POST | `/api/fee-schedule/create` | Create a new batch with programs, offers, scholarships |
| POST | `/api/fee-schedule/lock` | Lock/unlock fee schedule |
| POST | `/api/fee-schedule/update` | Update programs, offers, scholarships for a batch |
| GET | `/api/audit-logs` | Global audit log (admin) |
| GET | `/api/preview/pdf/offer-letter` | Render Offer Letter PDF with sample data (admin preview) |
| GET | `/api/preview/pdf/fee-structure` | Render Fee Structure PDF with sample data (admin preview) |
| GET | `/api/preview/pdf/receipt` | Render Payment Receipt PDF with sample data (admin preview) |

### Cron (Bearer token)

| Method | Route | Schedule | Description |
|---|---|---|---|
| GET | `/api/cron/update-statuses` | Daily 03:00 UTC | Installment status transitions + offer window automation |
| GET | `/api/cron/reminders` | Daily 08:00 UTC | Send fee payment reminder emails |

### External (API key via `x-api-key` header)

| Method | Route | Description |
|---|---|---|
| GET | `/api/v1/students` | List all active students |
| GET | `/api/v1/students/[rollNo]` | Get single student by roll number |
| GET | `/api/v1/fee-schedule/[year]` | Get fee schedule for a batch year |

---

## Cron Jobs

### `/api/cron/update-statuses` (daily 03:00 UTC)

1. **Installment transitions**
   - `UPCOMING` → `DUE`: dueDate has passed
   - `DUE` → `OVERDUE`: past dueDate + 7-day grace period
   - `PARTIAL` → `OVERDUE`: same condition

2. **Offer window automation** (for all `OFFERED` students with `offerSentAt` set)
   - 4 days left + no reminder 1 sent → send Reminder 1, stamp `offerReminder1SentAt`
   - 1 day left + no reminder 2 sent → send Reminder 2, stamp `offerReminder2SentAt`
   - Expired + `offerRevised = false` → delete `ACCEPTANCE_7DAY` StudentOffer, recalculate `StudentFinancial`, create audit log entry, set `offerRevised = true`, send Revised Offer email

### `/api/cron/reminders` (daily 08:00 UTC)

Sends fee payment reminders at 30 days, 7 days, and 0 days before installment due dates. Logs each send to `ReminderLog`. Emails are plain-text with a hidden tracking pixel for read receipts.

---

## Email Functions (`src/lib/mail.ts`)

| Function | Trigger | Recipients | Attachments / Links |
|---|---|---|---|
| `sendMagicLinkEmail` | Auth sign-in | User | — |
| `sendFeeReminder` | Cron reminders | Student | — |
| `sendReceiptEmail` | After payment recorded | Student | Receipt PDF |
| `sendOfferEmail` | "Send Offer Email" button | Student + parent | Offer Letter PDF (with fee appendix) |
| `sendOfferReminderEmail` | Cron Day 3–5 / Day 0–2 | Student + parent | — |
| `sendRevisedOfferEmail` | Cron Day 8+ (waiver lapsed) | Student | Revised Offer Letter PDF |
| `sendEnrolmentConfirmationEmail` | Auto on registration payment confirmed | Student (CC parent) | Fee Structure PDF, Onboarding link |
| `sendOnboardingLinkEmail` | "Send Onboarding Link" button | Student | Onboarding link |
| `sendOnboardingEmail` | Complete Onboarding wizard | Student (CC parent) | Fee Structure PDF, Resource links |
| `sendOnboardingSubmittedAlert` | Student submits self-onboard form | All admins | Student profile link |

All body text (except receipts and alert emails) is configurable via `SystemSetting` keys. SMTP credentials are read from `SystemSetting` at send time (`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`), falling back to environment variables.

---

## PDF / Document Generation

| Generator | Output | Used in |
|---|---|---|
| `offer-letter-generator.tsx` | Offer Letter PDF | Send Offer Email, Revised Offer Email |
| `pdf-generator.tsx` | Proposal / Fee Breakdown PDF | Proposal download, Offer Email (optional), Onboarding Email |
| `receipt-pdf.tsx` | Payment Receipt PDF | Receipt page, Receipt email |
| `docx-generator.ts` | Proposal Word document | Proposal download |

All react-pdf generators are called via `renderToBuffer(createElement(Component, props) as any)` — the `as any` cast is required because `@react-pdf/renderer`'s `DocumentProps` type is incompatible with custom component props.

---

## Settings System

All runtime-configurable values are stored in `SystemSetting` (key/value). Read via `getSetting(key, default)` / `getSettings(keys[])` server actions. Written via `updateSetting(key, value)` (admin-only).

Key groups:

| Group | Keys |
|---|---|
| SMTP | `SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`, `REMINDER_PAYMENT_URL` |
| Admissions emails | `OFFER_EMAIL_BODY`, `OFFER_LETTER_BODY`, `OFFER_REMINDER_1_BODY`, `OFFER_REMINDER_2_BODY` |
| Enrolment emails | `ENROLMENT_CONFIRMATION_EMAIL_BODY` |
| Onboarding emails | `ONBOARDING_EMAIL_BODY`, `SELF_ONBOARDING_LINK_EMAIL_BODY` |
| Onboarding resources | `BANK_DETAILS`, `ONBOARDING_HANDBOOK_URL`, `ONBOARDING_WELCOME_KIT_URL`, `ONBOARDING_YEAR1_URL` |
| T&Cs | `PROPOSAL_TERMS`, `PROPOSAL_TERMS_CHANGELOG` (JSON array of `{date, note}` entries) |
| System state | `CRON_LAST_RUN_UPDATE_STATUSES`, `CRON_LAST_RUN_FEE_REMINDERS` |

Email body templates support merge fields (varies by email type): `{{studentName}}`, `{{programName}}`, `{{batchYear}}`, `{{rollNo}}`, `{{daysLeft}}`, `{{offerExpiryDate}}`, `{{onboardingExpiryDate}}`. Available merge fields are shown per-email in Settings → Emails.

---

## Auth & Access Control

- **Authentication**: NextAuth v5 magic link. Users must already exist in the `User` table; no self-registration.
- **Roles**: `ADMIN` — full access: manage team, settings, batches/programs, delete students, override financials, modify installments, plus all staff actions. `STAFF` — can make offers, enrol students, do onboarding, record payments, and upload documents; cannot manage team, settings, batches/programs, delete students, or modify financial overrides.
- **Route protection**: `proxy.ts` (Next.js 16 middleware) redirects unauthenticated requests to `/login`.
- **API key auth**: External `/api/v1/*` routes require `x-api-key` header. Keys are stored as SHA-256 hashes; raw key shown once at creation.
- **Cron auth**: Cron routes check `Authorization: Bearer ${CRON_SECRET}` header.

---

## Key Conventions

- **`prisma db push`** — used instead of `migrate dev` due to schema drift in the dev database. Never use `migrate dev` in this project.
- **`$Enums` import** — always import enum types from `@prisma/client` as `$Enums.EnumName` for Prisma filter type safety.
- **Decimal fields** — Prisma `Decimal` fields are passed as plain JS numbers; never import `Decimal` from `@prisma/client/runtime/library`.
- **Nullable `rollNo`** — `Student.rollNo` is `String? @unique`. Always guard display with `rollNo ?? "—"` or `rollNo ?? "Pending Enrolment"`.
- **Financial locking** — `StudentFinancial.isLocked = true` after enrolment confirmation. Mutations to locked records require admin role + audit log entry with reason.
- **Fee calculation** — all waiver-split logic lives in `src/lib/fee-calc.ts` (`isSpreadCondition`, `splitWaivers`). Never inline the spread/one-time formula in routes or components.
- **Outstanding** — always compute as `max(0, netFee − totalPaid)`. Never sum installment amounts for this — they may not match `netFee` (deductions are not distributed to all installments).
- **Schedule display** — always recompute per-installment fees from the live scheme via `expectedInstFee()` on the detail page; don't trust `inst.amount` for display (it may be stale from before a financial plan edit).
- **FIFO is the sole source of PAID/PARTIAL** — never set `inst.status = PAID` or `PARTIAL` directly. Always call `syncFifoToDb(tx, studentId)` inside the transaction after any payment change.
- **Payment recording entry points** — the "Record Payment" header button has been removed; payments are recorded via the Schedule tab (per-installment) and the Payments tab (general/advance).
- **`type="button"` on all non-submit buttons** — all `<button>` elements that are not form submits must have `type="button"` to prevent accidental browser form validation (Safari treats omitted type as `type="submit"`).
