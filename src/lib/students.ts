import { prisma } from "./prisma"
import { $Enums, Prisma } from "@prisma/client"

/**
 * Next roll number for a batch year = (highest existing suffix) + 1 — NOT a
 * count. Count-based numbering collides whenever a numbered student is deleted
 * (the count lags the real max), which is exactly the bug that blocked an
 * enrolment. Roll numbers are permanent and never reused: gaps left by
 * withdrawn/deleted students stay retired.
 *
 * MUST run inside the enrolment transaction (pass the `tx` client) so the
 * read-then-assign is atomic for a single request; pair the surrounding
 * transaction with {@link withRollNoRetry} to resolve the rare race between two
 * concurrent enrolments in the same batch.
 */
export async function generateRollNo(
  client: Prisma.TransactionClient | typeof prisma,
  batchYear: number,
): Promise<string> {
  const rows = await client.student.findMany({
    where: { batch: { year: batchYear }, rollNo: { not: null } },
    select: { rollNo: true },
  })
  let maxSeq = 0
  for (const { rollNo } of rows) {
    const m = /^LE\d{4}(\d+)$/.exec(rollNo ?? "")
    if (m) maxSeq = Math.max(maxSeq, Number(m[1]))
  }
  const seq = String(maxSeq + 1).padStart(3, "0")
  return `LE${batchYear}${seq}`
}

/**
 * Run an enrolment transaction, retrying when it fails on a roll-number unique
 * collision (Prisma P2002 on `rollNo`). That can only happen when two
 * enrolments in the same batch race; each retry regenerates the number from the
 * freshly-read max, so it converges. Non-collision errors propagate immediately.
 */
export async function withRollNoRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn()
    } catch (err) {
      const isRollNoCollision =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === "P2002" &&
        String((err.meta as { target?: unknown } | undefined)?.target ?? "").includes("rollNo")
      if (isRollNoCollision && attempt < attempts) continue
      throw err
    }
  }
}

export async function getStudents(opts?: {
  batchYear?: number
  search?: string
  status?: string
  overdueOnly?: boolean
}) {
  return prisma.student.findMany({
    where: {
      ...(opts?.batchYear ? { batch: { year: opts.batchYear } } : {}),
      ...(opts?.status && opts.status !== "ALL"
        ? { status: opts.status as $Enums.StudentStatus }
        : {}),
      ...(opts?.search
        ? {
            OR: [
              { name: { contains: opts.search, mode: "insensitive" } },
              { email: { contains: opts.search, mode: "insensitive" } },
              { rollNo: { contains: opts.search, mode: "insensitive" } },
              { contact: { contains: opts.search, mode: "insensitive" } },
            ],
          }
        : {}),
      ...(opts?.overdueOnly
        ? { installments: { some: { status: "OVERDUE" } } }
        : {}),
    },
    include: {
      batch: true,
      program: { select: { id: true, name: true, registrationFee: true, year1Fee: true, year2Fee: true, year3Fee: true } },
      financial: { select: { netFee: true, installmentType: true, registrationPaid: true, registrationFeeOverride: true } },
      installments: { select: { id: true, status: true, dueDate: true, amount: true, paidAmount: true, year: true }, orderBy: { year: "asc" } },
      payments: { select: { amount: true } },
      offers: { include: { offer: true } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
    },
    orderBy: [{ batch: { year: "desc" } }, { rollNo: "asc" }],
  })
}

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      batch: {
        include: {
          feeSchedule: {
            include: {
              offers: { orderBy: { waiverAmount: "desc" } },
              scholarships: { orderBy: [{ category: "asc" }, { minAmount: "asc" }] },
            },
          },
        },
      },
      program: true,
      financial: true,
      offers: { include: { offer: { select: { id: true, name: true, type: true, waiverAmount: true, conditions: true } } } },
      scholarships: { include: { scholarship: { select: { id: true, name: true, category: true, spreadAcrossYears: true } } } },
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
      documents: { orderBy: { uploadedAt: "desc" } },
      payments: {
        include: { 
          recordedBy: { select: { name: true } },
          installment: { select: { label: true } }
        },
        orderBy: { date: "desc" }
      },
      auditLogs: {
        include: { changedByUser: { select: { name: true, email: true, role: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
  })
}

export async function getEnrollmentFormData() {
  return prisma.batch.findMany({
    include: {
      programs: { orderBy: { totalFee: "asc" } },
      feeSchedule: {
        include: {
          offers: { orderBy: { waiverAmount: "desc" } },
          scholarships: { orderBy: [{ category: "asc" }, { minAmount: "asc" }] },
        },
      },
    },
    orderBy: { year: "desc" },
  })
}

export function formatInstallmentStatus(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    UPCOMING: { label: "Upcoming", classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
    DUE:      { label: "Due",      classes: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    OVERDUE:  { label: "Overdue",  classes: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
    PARTIAL:  { label: "Partial",  classes: "bg-orange-500/10 text-orange-700 border-orange-500/20" },
    PAID:     { label: "Paid",     classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  }
  return map[status] ?? { label: status, classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" }
}

export function formatStudentStatus(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    OFFERED:    { label: "Offered",    classes: "bg-violet-500/10 text-violet-700 border-violet-500/20" },
    ACTIVE:     { label: "Active",     classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    ONBOARDING: { label: "Onboarding", classes: "bg-[#25BCBD]/10 text-[#25BCBD] border-[#25BCBD]/30" },
    ALUMNI:     { label: "Alumni",     classes: "bg-[#3663AD]/10 text-[#3663AD] border-[#3663AD]/20" },
    WITHDRAWN:  { label: "Withdrawn",  classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  }
  return map[status] ?? { label: status, classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" }
}
