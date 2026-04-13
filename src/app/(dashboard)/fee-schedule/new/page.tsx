import { redirect } from "next/navigation"
import Link from "next/link"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { NewFeeScheduleForm } from "@/components/fee-schedule/new-fee-schedule-form"

export default async function NewFeeSchedulePage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") redirect("/fee-schedule")

  return (
    <div className="space-y-6 max-w-[1200px]">
      <div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
          <Link href="/fee-schedule" className="hover:text-foreground">Fee Schedule</Link>
          <span>/</span>
          <span>New</span>
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900">New Fee Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Create a new batch with programs, offers, and scholarships.
        </p>
      </div>
      <NewFeeScheduleForm />
    </div>
  )
}
