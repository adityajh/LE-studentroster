# Architecture — LE Student Roster

> Last updated: 2026-04-10 (v1.0.0, Phase 10 complete)

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
| File storage | Vercel Blob (student documents) |
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
      settings/           — Team / API keys / Email / Proposal / Offers
    actions/              — Server actions (settings, team, api-keys, reminders)
    api/
      auth/               — NextAuth handler
      cron/               — Scheduled jobs
      fee-schedule/       — Admin fee schedule mutation endpoints
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
    pdf-generator.tsx     — Proposal PDF (react-pdf)
    receipt-pdf.tsx       — Payment receipt PDF (react-pdf)
    offer-letter-generator.tsx — Offer letter PDF (react-pdf)
    docx-generator.ts     — Proposal Word document (docx)
    button-variants.ts    — Shared button style helper
    utils.ts              — cn() tailwind merge
  components/
    students/             — RecordPaymentDialog, EnrollmentForm, CreateOfferForm,
                            SendOfferButton, ConfirmEnrolmentDialog
    settings/             — TeamTab, ApiKeysTab, EmailTab, ProposalSettings, OfferSettings
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
Student (rollNo?, name, email, contact, batchId, programId, status)
  ├── offer-window: offerSentAt, offerExpiresAt, offerReminder1SentAt,
  │                 offerReminder2SentAt, offerRevised, onboardingEmailSentAt
  ├── StudentFinancial (baseFee, totalWaiver, netFee, installmentType, isLocked)
  ├── StudentOffer[] (offerId, waiverAmount)
  ├── StudentScholarship[] (scholarshipId, amount)
  ├── StudentDeduction[] (description, amount)
  ├── Installment[] (year, label, dueDate, amount, status, paidDate, paidAmount)
  │     ├── Payment[] (date, amount, paymentMode, referenceNo)
  │     └── ReminderLog[] (type, sentAt, readAt, emailStatus)
  ├── StudentDocument[] (type, fileUrl — Vercel Blob)
  └── StudentAuditLog[] (field, oldValue, newValue, reason, changedBy)
```

`Student.rollNo` is **nullable** — assigned only when a student is confirmed enrolled (status transitions from `OFFERED` → `ACTIVE`). Roll number format: `LE{year}{seq}` e.g. `LE2026001`.

### Supporting tables
- `ApiKey` — hashed API keys for external API access
- `SystemSetting` — key/value store for runtime-configurable settings (SMTP, email templates, URLs)
- `ReminderSetting` — per-type reminder configuration (days out, subject, body)

### Enums
| Enum | Values |
|---|---|
| `StudentStatus` | `OFFERED` → `ACTIVE` → `ALUMNI` / `WITHDRAWN` |
| `InstallmentStatus` | `UPCOMING` → `DUE` → `OVERDUE` / `PARTIAL` / `PAID` |
| `InstallmentType` | `ONE_TIME`, `ANNUAL`, `CUSTOM` |
| `OfferType` | `FIRST_N_REGISTRATIONS`, `EARLY_BIRD`, `ACCEPTANCE_7DAY`, `FULL_PAYMENT` |
| `ScholarshipCategory` | `A` (merit, variable), `B` (circumstantial, flat ₹25K) |
| `PaymentMode` | `CASH`, `CHEQUE`, `NEFT`, `UPI`, `RTGS`, `OTHER` |
| `DocumentType` | `STUDENT_PHOTO`, `TENTH_MARKSHEET`, `TWELFTH_MARKSHEET`, `ACCEPTANCE_LETTER`, `AADHAR_CARD`, `DRIVERS_LICENSE` |

---

## Admissions Flow

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
    │  Records ₹50,000 registration payment
    │  Assigns rollNo (LE{year}{seq})
    │  Creates installment schedule
    │  status → ACTIVE, isLocked = true
    ▼
Onboarding Email (optional, prompted at enrolment)
    │  Attaches: Proposal PDF (now with rollNo + schedule)
    │  Sets onboardingEmailSentAt
    ▼
Active Student — fee tracking, reminders, payments
```

Direct enrolment path (`/students/new`) still exists for retroactive entries — creates `ACTIVE` student with roll number and installments immediately.

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
| POST | `/api/students/[id]/pay` | Record installment payment |
| GET | `/api/students/[id]/pay/[paymentId]/receipt` | Generate receipt PDF |
| GET | `/api/students/[id]/proposal` | Generate proposal PDF or DOCX |
| POST | `/api/students/[id]/documents` | Upload document to Vercel Blob |
| POST | `/api/fee-schedule/lock` | Lock/unlock fee schedule |
| POST | `/api/fee-schedule/update` | Update fee schedule |
| GET | `/api/audit-logs` | Global audit log (admin) |

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

| Function | Trigger | Attachments |
|---|---|---|
| `sendMagicLinkEmail` | Auth sign-in | — |
| `sendPaymentReminderEmail` | Cron reminders | — |
| `sendReceiptEmail` | After payment recorded | Receipt PDF |
| `sendOfferEmail` | "Send Offer Email" button | Offer Letter PDF + optional Proposal PDF |
| `sendOfferReminderEmail` | Cron Day 3 / Day 6 | — |
| `sendRevisedOfferEmail` | Cron Day 8+ | Offer Letter PDF |
| `sendOnboardingEmail` | After enrolment confirmed | Proposal PDF |

SMTP credentials are read from `SystemSetting` at send time (`SMTP_USER`, `SMTP_PASSWORD`, `SMTP_FROM_NAME`, `SMTP_FROM_EMAIL`), falling back to environment variables.

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
| Offer emails | `OFFER_EMAIL_BODY`, `OFFER_LETTER_BODY`, `OFFER_REMINDER_1_BODY`, `OFFER_REMINDER_2_BODY` |
| Onboarding | `ONBOARDING_EMAIL_BODY`, `BANK_DETAILS`, `ONBOARDING_HANDBOOK_URL`, `ONBOARDING_WELCOME_KIT_URL`, `ONBOARDING_YEAR1_URL` |
| Proposal | `PROPOSAL_TERMS` |

Email body templates support merge fields: `{{studentName}}`, `{{programName}}`, `{{batchYear}}`, `{{rollNo}}`, `{{daysLeft}}`, `{{offerExpiryDate}}`.

---

## Auth & Access Control

- **Authentication**: NextAuth v5 magic link. Users must already exist in the `User` table; no self-registration.
- **Roles**: `ADMIN` — full access including settings, lock/unlock, delete, role management. `STAFF` — can manage students and record payments, but cannot access settings or destructive actions.
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
