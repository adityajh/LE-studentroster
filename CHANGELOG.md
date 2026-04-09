# Changelog

All notable changes to the LE Student Roster system are documented here.

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
