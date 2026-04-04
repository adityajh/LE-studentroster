# LE Student Roster

Internal student enrollment and fee management system for **Let's Enterprise**.

Built to manage the 3-year Working BBA program — tracking student financials, installment schedules, fee proposals, and automated payment reminders.

---

## What it does

- **Student Roster** — Central student registry with roll numbers, contact details, batch, and program
- **Fee Management** — Track base fees, scholarships, offers, deductions, and net fee per student
- **Installment Tracking** — Auto-status updates (Upcoming → Due → Overdue → Paid) with payment recording
- **Proposal Letters** — Generate branded PDF and Word proposal letters with merged fee details
- **Email Reminders** — Automated fee reminders at 1 month, 1 week, and on due date via Gmail
- **Master Fee Schedule** — Locked annual fee schedule (programs, offers, scholarships) with external API access
- **External API** — Read-only REST API for other systems to access student roster and fee schedule

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Framework | Next.js 16 (App Router) |
| Database | PostgreSQL on Neon (serverless) |
| ORM | Prisma v7 with Neon adapter |
| Auth | NextAuth v5 — magic link login |
| UI | Tailwind CSS + shadcn/ui |
| Email | Gmail (Google Workspace SMTP) |
| PDF | `@react-pdf/renderer` |
| Word | `docx` |
| Hosting | Vercel |
| Cron | Vercel Cron Functions |

---

## Getting Started

### Prerequisites
- Node.js 18+
- A Neon PostgreSQL database
- A Google Workspace account (for magic link + reminder emails)

### Setup

**1. Clone and install**
```bash
git clone https://github.com/adityajh/LE-studentroster.git
cd LE-studentroster
npm install
```

**2. Configure environment**
```bash
cp .env.example .env.local
# Fill in your values — see .env.example for all required keys
```

**3. Run database migration**
```bash
npm run db:migrate
```

**4. Seed 2026 batch data**
```bash
npm run db:seed
```

**5. Start development server**
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) — you'll be redirected to login.

---

## Environment Variables

See `.env.example` for the full list. Key variables:

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | Neon pooler connection string |
| `DATABASE_URL_UNPOOLED` | Neon direct connection string (for migrations) |
| `AUTH_SECRET` | NextAuth secret (`openssl rand -base64 32`) |
| `NEXTAUTH_URL` | App URL (e.g. `https://your-app.vercel.app`) |
| `GMAIL_USER` | Gmail address for sending emails |
| `GMAIL_APP_PASSWORD` | Gmail App Password (not your account password) |
| `API_KEY_SECRET` | Secret for hashing external API keys |

---

## NPM Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run db:migrate` | Run Prisma migrations |
| `npm run db:seed` | Seed 2026 batch data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run db:generate` | Regenerate Prisma client |

---

## Project Structure

```
src/
├── app/
│   ├── (auth)/login/          — Magic link login page
│   ├── (dashboard)/           — Protected app pages
│   │   ├── dashboard/         — Overview stats
│   │   ├── students/          — Student list and detail
│   │   ├── fee-schedule/      — Master fee schedule management
│   │   └── settings/          — Team, API keys, email config
│   └── api/
│       ├── auth/              — NextAuth handlers
│       ├── v1/                — External REST API (API key auth)
│       └── cron/              — Vercel Cron endpoints
├── components/
│   ├── layout/                — Sidebar, top bar
│   └── ui/                    — shadcn/ui components
├── lib/
│   ├── prisma.ts              — Prisma client singleton
│   └── utils.ts               — Shared utilities
├── auth.ts                    — NextAuth configuration
└── proxy.ts                   — Route protection middleware
prisma/
├── schema.prisma              — Database schema (15 tables)
├── seed.ts                    — 2026 batch seed data
└── migrations/                — Migration history
```

---

## Roles

| Role | Access |
|------|--------|
| **Admin** | Everything — fee schedule, team management, API keys |
| **Staff** | Student management, payment recording, proposal generation |

Login is via magic link — enter your email, click the link sent to your inbox.

---

## External API

All endpoints require an `x-api-key` header. API keys are generated in Settings (Admin only).

| Endpoint | Description |
|----------|-------------|
| `GET /api/v1/students` | Full student roster |
| `GET /api/v1/students/[rollNo]` | Single student by roll number |
| `GET /api/v1/fee-schedule/[year]` | Fee schedule for a batch year |

---

## Deployment

Deployed on Vercel. Every push to `main` triggers an automatic deployment.

Cron jobs run daily at 3:00 AM UTC:
- `/api/cron/update-statuses` — Updates installment statuses (Upcoming → Due → Overdue)
- `/api/cron/send-reminders` — Sends email reminders for upcoming and due installments

---

## Key Business Rules

- All offers and scholarships are **distributed evenly across 3 program years**
- Students can hold **max 1 scholarship per category** (Category A and Category B)
- The master fee schedule is **locked per batch year** — no edits after locking
- Roll numbers follow the format `LE[YEAR]-[NNN]` (e.g. `LE2026-001`)
- Installment types: **One-time** (full 3 years, gets 1L waiver), **Annual** (3 payments), or **Custom** (agreed schedule)
