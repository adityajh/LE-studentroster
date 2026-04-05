import Link from "next/link"
import { getAllBatches } from "@/lib/fee-schedule"
import { buttonVariants } from "@/lib/button-variants"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Lock, Unlock, ChevronRight, Plus } from "lucide-react"

export default async function FeeSchedulePage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"
  const batches = await getAllBatches()

  return (
    <div className="space-y-8 max-w-[1200px]">
      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Configuration
          </p>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-0.5">
            Fee Schedule
          </h1>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Programs, offers, and scholarships per batch year
          </p>
        </div>
        {isAdmin && (
          <Link
            href="/fee-schedule/new"
            className={cn(buttonVariants(), "bg-indigo-600 hover:bg-indigo-700 text-white")}
          >
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Link>
        )}
      </div>

      {batches.length === 0 ? (
        <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-16 text-center">
          <p className="text-sm font-semibold text-slate-500">No fee schedules yet</p>
          <p className="text-xs font-medium text-slate-400 mt-1">Create a batch to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/fee-schedule/${batch.year}`}>
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm hover:shadow-md hover:border-slate-300 transition-all cursor-pointer p-5 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-extrabold text-slate-900">
                        Batch {batch.year}
                      </span>
                      {batch.feeSchedule?.isLocked ? (
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
                          <Lock className="h-3 w-3" /> Locked
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded-md">
                          <Unlock className="h-3 w-3" /> Unlocked
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-400 mt-0.5">
                      {batch._count.programs} program{batch._count.programs !== 1 ? "s" : ""} ·{" "}
                      {batch._count.students} student{batch._count.students !== 1 ? "s" : ""}
                      {batch.feeSchedule?.lockedAt && (
                        <> · Locked {new Date(batch.feeSchedule.lockedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                      )}
                    </p>
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 text-slate-400" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
