import { notFound } from "next/navigation"
import Link from "next/link"
import { getFeeScheduleByYear, formatINR } from "@/lib/fee-schedule"
import { buttonVariants } from "@/lib/button-variants"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { cn } from "@/lib/utils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Lock, Pencil, ExternalLink, Unlock } from "lucide-react"
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
    <div className="space-y-8 max-w-[1200px]">
      {/* Breadcrumb + header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link href="/fee-schedule" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
              Fee Schedule
            </Link>
            <span className="text-slate-300">/</span>
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500">
              Batch {year}
            </span>
          </div>
          <h1 className="text-2xl font-extrabold text-slate-900">
            Batch {year}
          </h1>
          <div className="flex items-center gap-2 mt-1.5">
            {isLocked ? (
              <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 text-emerald-700 border border-emerald-500/20 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg">
                <Lock className="h-3 w-3" />
                Locked
                {batch.feeSchedule?.lockedBy && (
                  <> · {batch.feeSchedule.lockedBy.name ?? batch.feeSchedule.lockedBy.email}</>
                )}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 bg-amber-500/10 text-amber-700 border border-amber-500/20 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg">
                <Unlock className="h-3 w-3" /> Editable
              </span>
            )}
          </div>
        </div>

        {isAdmin && (
          <div className="flex items-center gap-2">
            {!isLocked && (
              <Link
                href={`/fee-schedule/${year}/edit`}
                className={cn(buttonVariants({ variant: "outline", size: "sm" }), "border-slate-300 text-slate-700 hover:bg-slate-50")}
              >
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
        <TabsList className="bg-slate-100 border border-slate-200">
          <TabsTrigger value="programs" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Programs ({batch.programs.length})
          </TabsTrigger>
          <TabsTrigger value="offers" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Offers ({batch.feeSchedule?.offers.length ?? 0})
          </TabsTrigger>
          <TabsTrigger value="scholarships" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            Scholarships ({batch.feeSchedule?.scholarships.length ?? 0})
          </TabsTrigger>
        </TabsList>

        {/* Programs */}
        <TabsContent value="programs" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {batch.programs.map((program) => (
              <div key={program.id} className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                  Program
                </p>
                <h3 className="text-base font-extrabold text-slate-900 mb-1">{program.name}</h3>
                {program.targetStudents && (
                  <p className="text-xs font-medium text-slate-400 mb-3">
                    Target: {program.targetStudents} students
                  </p>
                )}
                <p className="text-3xl font-black text-indigo-600 mb-4">
                  {formatINR(program.totalFee)}
                </p>
                <div className="space-y-1.5 border-t border-slate-100 pt-3">
                  {[
                    { label: "Registration", value: program.registrationFee },
                    { label: "Year 1 — Growth", value: program.year1Fee },
                    { label: "Year 2 — Projects", value: program.year2Fee },
                    { label: "Year 3 — Work", value: program.year3Fee },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between items-center">
                      <span className="text-xs font-medium text-slate-400">{label}</span>
                      <span className="text-sm font-bold text-slate-700">{formatINR(value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* Offers */}
        <TabsContent value="offers" className="mt-4">
          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="border-slate-100 hover:bg-transparent">
                  <TableHead className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Offer</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Type</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Waiver</TableHead>
                  <TableHead className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Condition / Deadline</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {batch.feeSchedule?.offers.map((offer) => (
                  <TableRow key={offer.id} className="border-slate-100">
                    <TableCell className="font-semibold text-slate-800">{offer.name}</TableCell>
                    <TableCell>
                      <span className="bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 text-[10px] uppercase tracking-wider font-bold px-2 py-1 rounded">
                        {offer.type.replace(/_/g, " ")}
                      </span>
                    </TableCell>
                    <TableCell className="font-extrabold text-emerald-600">
                      {formatINR(offer.waiverAmount)}
                    </TableCell>
                    <TableCell className="text-sm font-medium text-slate-400">
                      {offer.deadline
                        ? new Date(offer.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                        : offer.conditions
                        ? JSON.stringify(offer.conditions)
                        : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <p className="text-xs font-medium text-slate-400 mt-3">
            All offers are cumulative and distributed evenly across 3 program years.
          </p>
        </TabsContent>

        {/* Scholarships */}
        <TabsContent value="scholarships" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {["A", "B"].map((cat) => {
              const items = batch.feeSchedule?.scholarships.filter((s) => s.category === cat) ?? []
              return (
                <div key={cat} className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-sm">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                    Scholarship
                  </p>
                  <h3 className="text-base font-extrabold text-slate-900 mb-1">Category {cat}</h3>
                  <p className="text-xs font-medium text-slate-400 mb-4">
                    {cat === "A"
                      ? "Merit-based · ₹15K to ₹50K"
                      : "Equity-based · ₹25K flat"}
                  </p>
                  <div className="space-y-2">
                    {items.map((s) => (
                      <div key={s.id} className="flex items-center justify-between">
                        <span className="text-sm font-medium text-slate-600">{s.name}</span>
                        <span className="text-sm font-bold text-indigo-600">
                          {s.minAmount.toString() === s.maxAmount.toString()
                            ? formatINR(s.minAmount)
                            : `${formatINR(s.minAmount)} – ${formatINR(s.maxAmount)}`}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-xs font-medium text-slate-400 mt-3">
            Students may apply for 1 scholarship per category. Distributed across 3 program years.
          </p>
        </TabsContent>
      </Tabs>

      {/* External API note */}
      <div className="border border-dashed border-slate-200 rounded-2xl p-4 flex items-center gap-3">
        <ExternalLink className="h-4 w-4 text-slate-400 shrink-0" />
        <p className="text-xs font-medium text-slate-400">
          External API:{" "}
          <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">
            GET /api/v1/fee-schedule/{year}
          </code>{" "}
          — requires{" "}
          <code className="bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded text-xs font-mono">
            x-api-key
          </code>{" "}
          header
        </p>
      </div>
    </div>
  )
}
