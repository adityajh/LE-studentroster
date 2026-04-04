import { notFound, redirect } from "next/navigation"
import { getFeeScheduleByYear } from "@/lib/fee-schedule"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { FeeScheduleEditForm } from "@/components/fee-schedule/fee-schedule-edit-form"

export default async function FeeScheduleEditPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year: yearStr } = await params
  const year = parseInt(yearStr)
  if (isNaN(year)) notFound()

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") redirect(`/fee-schedule/${year}`)

  const batch = await getFeeScheduleByYear(year)
  if (!batch) notFound()
  if (batch.feeSchedule?.isLocked) redirect(`/fee-schedule/${year}`)

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <a href="/fee-schedule" className="hover:text-foreground">Fee Schedule</a>
          <span>/</span>
          <a href={`/fee-schedule/${year}`} className="hover:text-foreground">Batch {year}</a>
          <span>/</span>
          <span>Edit</span>
        </div>
        <h1 className="text-2xl font-semibold text-gray-900">Edit Batch {year}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Update programs, offers, and scholarships. Lock the schedule when enrollments begin.
        </p>
      </div>
      <FeeScheduleEditForm batch={batch} />
    </div>
  )
}
