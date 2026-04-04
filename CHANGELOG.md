# Changelog

All notable changes to the LE Student Roster system are documented here.

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

### [0.6.0] — Phase 6: Proposal Letter Generation
- PDF and Word generation with all fee merge fields
- Downloadable from student detail page

### [0.7.0] — Phase 7: Settings & Admin
- Team member management
- API key generation and management
- Email and system configuration

### [0.8.0] — Phase 8: Polish & Production
- Error handling, loading states, mobile responsiveness
- End-to-end production testing
