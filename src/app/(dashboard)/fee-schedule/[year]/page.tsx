import { notFound } from "next/navigation"
import Link from "next/link"
import { getFeeScheduleByYear, formatINR } from "@/lib/fee-schedule"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { buttonVariants } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Lock, Pencil, ExternalLink } from "lucide-react"
import { cn } from "@/lib/utils"
import { LockToggleButton } from "@/components/fee-schedule/lock-toggle-button"

export default async function FeeScheduleYearPage({
  params,
}: {
  params: Promise<{ year: string }>
}) {
  const { year: yearStr } = await params
  const year = parseInt(yearStr)
  if (isNaN(year)) notFound()

  const batch = await getFeeScheduleByYear(year)
  if (!batch) notFound()

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true, id: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"
  const isLocked = batch.feeSchedule?.isLocked ?? false

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/fee-schedule" className="text-sm text-muted-foreground hover:text-foreground">
              Fee Schedule
            </Link>
            <span className="text-muted-foreground">/</span>
            <span className="text-sm font-medium">Batch {year}</span>
          </div>
          <h1 className="text-2xl font-semibold text-gray-900 mt-1">
            Batch {year} — Fee Schedule
          </h1>
          <div className="flex items-center gap-2 mt-1">
            {isLocked ? (
              <Badge variant="outline" className="border-green-300 text-green-700 text-xs gap-1">
                <Lock className="h-3 w-3" /> Locked
                {batch.feeSchedule?.lockedBy && (
                  <> by {batch.feeSchedule.lockedBy.name ?? batch.feeSchedule.lockedBy.email}</>
                )}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-amber-300 text-amber-700 text-xs">
                Unlocked — editable
              </Badge>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {!isLocked && (
              <Link href={`/fee-schedule/${year}/edit`} className={cn(buttonVariants({ variant: "outline", size: "sm" }))}>
                <Pencil className="h-4 w-4 mr-1" /> Edit
              </Link>
            )}
            {batch.feeSchedule && (
              <LockToggleButton
                feeScheduleId={batch.feeSchedule.id}
                isLocked={isLocked}
                userId={dbUser?.id ?? ""}
              />
            )}
          </div>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs ({batch.programs.length})</TabsTrigger>
          <TabsTrigger value="offers">
            Offers ({batch.feeSchedule?.offers.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="scholarships">
            Scholarships ({batch.feeSchedule?.scholarships.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Programs tab */}
        <TabsContent value="programs" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {batch.programs.map((program) => (
              <Card key={program.id} className="shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{program.name}</CardTitle>
                  {program.targetStudents && (
                    <p className="text-xs text-muted-foreground">
                      Target: {program.targetStudents} students
                    </p>
                  )}
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="text-2xl font-bold text-gray-900">
                    {formatINR(program.totalFee)}
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between text-muted-foreground">
                      <span>Registration</span>
                      <span className="font-medium text-gray-700">{formatINR(program.registrationFee)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Year 1 — Growth</span>
                      <span className="font-medium text-gray-700">{formatINR(program.year1Fee)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Year 2 — Projects</span>
                      <span className="font-medium text-gray-700">{formatINR(program.year2Fee)}</span>
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>Year 3 — Work</span>
                      <span className="font-medium text-gray-700">{formatINR(program.year3Fee)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        {/* Offers tab */}
        <TabsContent value="offers" className="mt-4">
          <Card className="shadow-sm">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Offer</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Waiver</TableHead>
                    <TableHead>Deadline / Condition</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {batch.feeSchedule?.offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell className="font-medium">{offer.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-xs">
                          {offer.type.replace(/_/g, " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold text-green-700">
                        {formatINR(offer.waiverAmount)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {offer.deadline
                          ? new Date(offer.deadline).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })
                          : offer.conditions
                          ? JSON.stringify(offer.conditions)
                          : "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground mt-3">
            All offers are cumulative and distributed evenly across 3 program years.
          </p>
        </TabsContent>

        {/* Scholarships tab */}
        <TabsContent value="scholarships" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["A", "B"].map((cat) => {
              const items = batch.feeSchedule?.scholarships.filter((s) => s.category === cat) ?? []
              return (
                <Card key={cat} className="shadow-sm">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">Category {cat}</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      {cat === "A"
                        ? "Merit-based — ₹15K to ₹50K (amount decided by admissions team)"
                        : "Equity-based — ₹25K flat"}
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {items.map((s) => (
                        <div key={s.id} className="flex items-center justify-between text-sm">
                          <span>{s.name}</span>
                          <span className="font-medium text-blue-700">
                            {s.minAmount.toString() === s.maxAmount.toString()
                              ? formatINR(s.minAmount)
                              : `${formatINR(s.minAmount)} – ${formatINR(s.maxAmount)}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Students may apply for 1 scholarship per category. Distributed across 3 program years.
          </p>
        </TabsContent>
      </Tabs>

      {/* External API note */}
      <Card className="shadow-sm border-dashed">
        <CardContent className="flex items-center gap-3 py-3 px-4">
          <ExternalLink className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            External API:{" "}
            <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">
              GET /api/v1/fee-schedule/{year}
            </code>{" "}
            — requires <code className="bg-gray-100 px-1 py-0.5 rounded text-xs">x-api-key</code> header
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
