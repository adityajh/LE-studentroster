import { prisma } from "./prisma"

export async function generateRollNo(batchYear: number): Promise<string> {
  const count = await prisma.student.count({
    where: { batch: { year: batchYear } },
  })
  const seq = String(count + 1).padStart(3, "0")
  return `LE${batchYear}${seq}`
}

export async function getStudents(opts?: {
  batchYear?: number
  search?: string
  status?: string
}) {
  return prisma.student.findMany({
    where: {
      ...(opts?.batchYear ? { batch: { year: opts.batchYear } } : {}),
      ...(opts?.status && opts.status !== "ALL"
        ? { status: opts.status as "ACTIVE" | "ALUMNI" | "WITHDRAWN" }
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
    },
    include: {
      batch: true,
      program: { select: { id: true, name: true } },
      financial: { select: { netFee: true, installmentType: true, registrationPaid: true } },
      installments: { select: { status: true } },
    },
    orderBy: [{ batch: { year: "desc" } }, { rollNo: "asc" }],
  })
}

export async function getStudentById(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      batch: true,
      program: true,
      financial: true,
      offers: { include: { offer: { select: { id: true, name: true, type: true, waiverAmount: true } } } },
      scholarships: { include: { scholarship: { select: { id: true, name: true, category: true } } } },
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
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
    DUE: { label: "Due", classes: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
    OVERDUE: { label: "Overdue", classes: "bg-rose-500/10 text-rose-700 border-rose-500/20" },
    PAID: { label: "Paid", classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
  }
  return map[status] ?? { label: status, classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" }
}

export function formatStudentStatus(status: string) {
  const map: Record<string, { label: string; classes: string }> = {
    ACTIVE: { label: "Active", classes: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
    ALUMNI: { label: "Alumni", classes: "bg-indigo-500/10 text-indigo-700 border-indigo-500/20" },
    WITHDRAWN: { label: "Withdrawn", classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" },
  }
  return map[status] ?? { label: status, classes: "bg-slate-500/10 text-slate-600 border-slate-500/20" }
}
