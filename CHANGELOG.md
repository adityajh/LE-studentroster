# Changelog

All notable changes to the LE Student Roster system are documented here.

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

## Upcoming

### [0.2.0] — Phase 2: Master Fee Schedule
- Fee schedule list, detail, and edit pages
- Admin lock/unlock with confirmation
- External fee schedule API with API key auth

### [0.3.0] — Phase 3: Student Roster & Enrollment
- Student list with search and filters
- Enrollment flow with offer/scholarship application and fee calculation
- Installment schedule generation
- External student roster API

### [0.4.0] — Phase 4: Payment Tracking
- Record payments per installment
- Auto-status cron job (Upcoming → Due → Overdue)
- Dashboard wired to live data

### [0.5.0] — Phase 5: Email Reminders
- Gmail integration
- Automated reminders at 1 month, 1 week, and on due date
- Reminder log per installment

### [0.7.0] — Phase 7: Settings & Admin
- Team member management
- API key generation and management
- Email and system configuration

### [0.8.0] — Phase 8: Polish & Production
- Error handling, loading states, mobile responsiveness
- End-to-end production testing
