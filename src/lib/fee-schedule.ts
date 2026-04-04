import { prisma } from "@/lib/prisma"

export async function getFeeScheduleByYear(year: number) {
  const batch = await prisma.batch.findUnique({
    where: { year },
    include: {
      programs: { orderBy: { totalFee: "asc" } },
      feeSchedule: {
        include: {
          offers: { orderBy: { waiverAmount: "desc" } },
          scholarships: { orderBy: { category: "asc" } },
          lockedBy: { select: { name: true, email: true } },
        },
      },
    },
  })
  return batch
}

export async function getAllBatches() {
  return prisma.batch.findMany({
    orderBy: { year: "desc" },
    include: {
      feeSchedule: { select: { isLocked: true, lockedAt: true } },
      _count: { select: { students: true, programs: true } },
    },
  })
}

export function formatINR(amount: number | string | { toNumber: () => number }) {
  const num = typeof amount === "object" ? amount.toNumber() : Number(amount)
  if (num >= 100000) {
    return `₹${(num / 100000).toFixed(num % 100000 === 0 ? 0 : 2)}L`
  }
  if (num >= 1000) {
    return `₹${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`
  }
  return `₹${num.toLocaleString("en-IN")}`
}
