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
- [ ] **2.5** External API: `GET /api/v1/fee-schedule/[year]` with API key auth

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
- [ ] **3.6** External API: `GET /api/v1/students` and `GET /api/v1/students/[rollNo]` with API key auth

## Phase 4: Payment Tracking ✅ COMPLETE
> Goal: Record payments, auto-calculate installment status

- [x] **4.1** Installments shown on student detail with status badges (UPCOMING / DUE / OVERDUE / PARTIAL / PAID)
- [x] **4.2** Record payment dialog (amount, date, method, notes)
- [x] **4.3** Partial payments — marks as PARTIAL when paidAmount < amount; shows balance in dialog
- [x] **4.4** Vercel Cron job at `/api/cron/update-statuses` — daily UPCOMING→DUE→OVERDUE with 7-day grace
- [x] **4.5** Dashboard wired to live data — overdue, due this month, collected this month, collection rate bar
- [x] **4.6** Payment receipt page at `/students/[id]/receipts/[installmentId]` — printable
- [x] **4.7** Overdue tab on students list

## Phase 5: Email Reminders
> Goal: Automated fee reminders via Gmail

- [ ] **5.1** Gmail API / SMTP setup (App Password for Google Workspace)
- [ ] **5.2** Email template for fee reminders (with configurable payment link)
- [ ] **5.3** Vercel Cron job: daily reminder check
  - 30 days before due → ONE_MONTH reminder (if not already sent)
  - 7 days before due → ONE_WEEK reminder
  - On due date → DUE_DATE reminder
- [ ] **5.4** ReminderLog: track sent / failed / bounced per installment
- [ ] **5.5** Reminders tab on student detail — view full history of sent reminders

## Phase 6: Proposal Letter Generation
> Goal: Generate branded student proposal letters (PDF + Word)

- [ ] **6.1** Design proposal letter template with all merge fields:
  - Student name, roll number, program, batch
  - Base fee (total + year-wise breakdown)
  - Offers applied (itemised)
  - Scholarships applied (itemised)
  - One-time deductions
  - Net fee (total + year-wise)
  - Installment schedule with dates and amounts
  - Terms and conditions
- [ ] **6.2** PDF generation using `@react-pdf/renderer`
- [ ] **6.3** Word generation using `docx` library
- [ ] **6.4** Proposal page (`/students/[id]/proposal`) — preview and download both formats
- [ ] **6.5** Configurable T&C text in Settings (admin only)

## Phase 7: Settings & Admin
> Goal: Team management, API keys, email and system configuration

- [ ] **7.1** Team members management — invite by email, assign ADMIN/STAFF role
- [ ] **7.2** API key management — generate, revoke, view last used
- [ ] **7.3** Email settings — sender name, payment link URL, reminder email template
- [ ] **7.4** System settings — roll number format/prefix per batch

## Phase 8: Polish & Deploy
> Goal: Production-ready, fully tested

- [ ] **8.1** Error handling and loading states across all pages
- [ ] **8.2** Mobile responsiveness check (staff may use on phone)
- [ ] **8.3** Vercel production deploy with all env vars configured
- [ ] **8.4** Seed production database with 2026 fee schedule (already done in Phase 1)
- [ ] **8.5** Create initial admin user, invite staff members
- [ ] **8.6** End-to-end test: enroll student → generate proposal → track payment → receive reminder

---

## Future Enhancements (post v1)

- **Razorpay integration** — auto-record payments via webhook
- **Bulk import** — CSV upload for existing 35 students
- **Audit log** — track who changed what and when
- **Student portal** — read-only view for students to check payment status
- **WhatsApp reminders** — via WhatsApp Business API
- **Multi-year fee schedule comparison** — view fee changes across batches

---

## Pre-Build Setup Checklist

- [x] Neon PostgreSQL — project created, connection strings configured
- [x] GitHub — repo `adityajh/LE-studentroster` created and connected
- [x] Vercel — project renamed `le-student-roster`, env vars set, auto-deploy from `main`
- [ ] Gmail App Password — for magic link + reminder emails (Google Account → Security → 2-Step Verification → App Passwords)
- [ ] LE Logo files — proper PNG/SVG files for proposal letter (currently using placeholder)
- [ ] Proposal Letter — sample/template with exact T&C wording for Phase 6
