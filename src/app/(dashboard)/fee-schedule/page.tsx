import Link from "next/link"
import { getAllBatches } from "@/lib/fee-schedule"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Lock, Unlock, ChevronRight, Plus } from "lucide-react"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { buttonVariants } from "@/lib/button-variants"
import { cn } from "@/lib/utils"

export default async function FeeSchedulePage() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"
  const batches = await getAllBatches()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Fee Schedule</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Master fee schedules per batch year — programs, offers, and scholarships
          </p>
        </div>
        {isAdmin && (
          <Link href="/fee-schedule/new" className={cn(buttonVariants(), "bg-blue-600 hover:bg-blue-700")}>
            <Plus className="h-4 w-4 mr-2" />
            New Batch
          </Link>
        )}
      </div>

      {batches.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <p className="text-sm font-medium">No fee schedules yet</p>
            <p className="text-xs mt-1">Create a batch to get started</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {batches.map((batch) => (
            <Link key={batch.id} href={`/fee-schedule/${batch.year}`}>
              <Card className="shadow-sm hover:shadow-md transition-shadow cursor-pointer">
                <CardContent className="flex items-center justify-between py-4 px-6">
                  <div className="flex items-center gap-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-lg">
                          Batch {batch.year}
                        </span>
                        {batch.feeSchedule?.isLocked ? (
                          <Badge variant="outline" className="border-green-300 text-green-700 text-xs gap-1">
                            <Lock className="h-3 w-3" /> Locked
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs gap-1">
                            <Unlock className="h-3 w-3" /> Unlocked
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {batch._count.programs} program{batch._count.programs !== 1 ? "s" : ""} ·{" "}
                        {batch._count.students} student{batch._count.students !== 1 ? "s" : ""}
                        {batch.feeSchedule?.lockedAt && (
                          <> · Locked {new Date(batch.feeSchedule.lockedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</>
                        )}
                      </p>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
