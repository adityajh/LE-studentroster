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

## Pending (owner: Aditya)

- [ ] Upload LE Logo / Letterhead for Proposal PDF (currently placeholder)
- [ ] Set Gmail App Password via Settings → Email tab
- [ ] Draft final proposal letter body text in Settings → Proposal tab
- [ ] Refine Offers, Scholarships, and T&C wording in Fee Schedule
- [ ] End-to-end test: enroll student → generate proposal → record payment → confirm reminder

---

## Future Enhancements (post v1)

- **Razorpay integration** — auto-record payments via webhook
- **Bulk import** — CSV upload for existing 35 students
- **Audit log** — track who changed what and when
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
