import { notFound } from "next/navigation"
import Link from "next/link"
import { getStudentById } from "@/lib/students"
import { formatInstallmentStatus, formatStudentStatus } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { RecordPaymentDialog } from "@/components/students/record-payment-dialog"
import { DocumentUpload } from "@/components/students/document-upload"
import { RemindersTab } from "@/components/students/reminders-tab"
import { ProposalTab } from "@/components/students/proposal-tab"
import { HistoryTab } from "@/components/students/history-tab"
import { PaymentsTab } from "@/components/students/payments-tab"
import { cn } from "@/lib/utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Phone, Mail, Calendar, MapPin, Users, Droplets, Pencil, Bell, FileText, History, Trash2, AlertTriangle, Wallet } from "lucide-react"
import { DeleteStudentButton } from "@/components/students/delete-student-button"

export default async function StudentDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ tab?: string }>
}) {
  const { id } = await params
  const { tab = "installments" } = await searchParams
  const student = await getStudentById(id)
  if (!student) notFound()

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const canRecord = !!dbUser

  // Fetch reminder logs for this student's installments
  const reminderLogs = await prisma.reminderLog.findMany({
    where: { installment: { studentId: id } },
    include: { installment: { select: { label: true, dueDate: true } } },
    orderBy: { sentAt: "desc" },
  })

  const fin = student.financial
  const statusStyle = formatStudentStatus(student.status)

  // Use payments journal as source of truth for total paid
  const totalPaid = (student.payments || []).reduce((s, p) => s + Number(p.amount), 0)
  const totalDue = student.installments
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + Math.round(i.amount.toNumber()), 0)

  const waiverPerYear = fin ? Math.round(fin.totalWaiver.toNumber() / 3) : 0
  const yearFees: Record<number, number> = {
    1: student.program.year1Fee.toNumber(),
    2: student.program.year2Fee.toNumber(),
    3: student.program.year3Fee.toNumber(),
  }

  const photo = student.documents.find((d) => d.type === "STUDENT_PHOTO")
  const hasAddress = student.city || student.address || student.localAddress
  const hasParents = student.parent1Name || student.parent2Name || student.localGuardianName

  return (
    <div className="space-y-8 max-w-[1000px]">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/students" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
            Students
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 font-mono">
            {student.rollNo}
          </span>
        </div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo.fileUrl} alt={student.name} className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center shrink-0">
                <span className="text-lg font-black text-indigo-500">
                  {student.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-extrabold text-slate-900">{student.name}</h1>
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className={cn(
                  "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg border",
                  statusStyle.classes
                )}>
                  {statusStyle.label}
                </span>
                <span className="bg-indigo-500/10 text-indigo-700 border border-indigo-500/20 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg">
                  {student.program.name}
                </span>
                <span className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg font-mono">
                  {student.rollNo}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {dbUser?.role === "ADMIN" && (
              <DeleteStudentButton studentId={student.id} studentName={student.name} />
            )}
            {canRecord && (
              <Link
                href={`/students/${student.id}/edit`}
                className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-slate-200 text-sm font-bold text-slate-600 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50 transition-all shrink-0"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-1 space-y-4">

          {/* Contact */}
          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-5 space-y-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Contact</p>
            <div className="flex items-center gap-2.5 text-sm">
              <Phone className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-700">{student.contact}</span>
            </div>
            <div className="flex items-center gap-2.5 text-sm">
              <Mail className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-semibold text-slate-700">{student.email}</span>
            </div>
            {student.bloodGroup && (
              <div className="flex items-center gap-2.5 text-sm">
                <Droplets className="h-4 w-4 text-slate-400 shrink-0" />
                <span className="font-semibold text-slate-700">{student.bloodGroup}</span>
              </div>
            )}
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-500">
                Enrolled {new Date(student.enrollmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Address, Parents & Guardian */}
          {(hasAddress || hasParents) && (
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-5 space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Address, Parents & Guardian</p>

              {/* Address */}
              {hasAddress && (
                <div className="space-y-2">
                  {(student.city || student.address) && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-slate-400 shrink-0 mt-0.5" />
                      <div>
                        {student.city && (
                          <p className="text-sm font-bold text-slate-700">{student.city}</p>
                        )}
                        {student.address && (
                          <p className="text-xs font-medium text-slate-500 whitespace-pre-line mt-0.5">{student.address}</p>
                        )}
                      </div>
                    </div>
                  )}
                  {student.localAddress && (
                    <div className="flex items-start gap-2.5">
                      <MapPin className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 mb-0.5">Local Address</p>
                        <p className="text-xs font-medium text-slate-500 whitespace-pre-line">{student.localAddress}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Parent 1 */}
              {student.parent1Name && (
                <div className={cn("space-y-1", hasAddress && "pt-3 border-t border-slate-100")}>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">{student.parent1Name}</p>
                  </div>
                  {student.parent1Phone && <p className="text-xs font-medium text-slate-500 pl-5">{student.parent1Phone}</p>}
                  {student.parent1Email && <p className="text-xs font-medium text-slate-500 pl-5">{student.parent1Email}</p>}
                </div>
              )}

              {/* Parent 2 */}
              {student.parent2Name && (
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">{student.parent2Name}</p>
                  </div>
                  {student.parent2Phone && <p className="text-xs font-medium text-slate-500 pl-5">{student.parent2Phone}</p>}
                  {student.parent2Email && <p className="text-xs font-medium text-slate-500 pl-5">{student.parent2Email}</p>}
                </div>
              )}

              {/* Local Guardian */}
              {student.localGuardianName && (
                <div className="space-y-1 pt-3 border-t border-slate-100">
                  <p className="text-[10px] uppercase tracking-wider font-bold text-amber-600 mb-1">Local Guardian</p>
                  <div className="flex items-center gap-2">
                    <Users className="h-3.5 w-3.5 text-slate-400" />
                    <p className="text-sm font-bold text-slate-700">{student.localGuardianName}</p>
                  </div>
                  {student.localGuardianPhone && <p className="text-xs font-medium text-slate-500 pl-5">{student.localGuardianPhone}</p>}
                  {student.localGuardianEmail && <p className="text-xs font-medium text-slate-500 pl-5">{student.localGuardianEmail}</p>}
                </div>
              )}
            </div>
          )}

          {/* Fee Summary */}
          {fin && (
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Fee Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Base fee</span>
                  <span className="font-bold text-slate-700">{formatINR(fin.baseFee)}</span>
                </div>
                {student.offers.length > 0 && 
                  student.offers.map(so => (
                    <div key={so.id} className="flex justify-between text-[11px] pl-2 border-l-2 border-emerald-100">
                      <span className="font-medium text-slate-400 italic">{so.offer.name}</span>
                      <span className="font-bold text-emerald-600/70">−{formatINR(so.waiverAmount)}</span>
                    </div>
                  ))
                }
                {student.scholarships.length > 0 && 
                  student.scholarships.map(ss => (
                    <div key={ss.id} className="flex justify-between text-[11px] pl-2 border-l-2 border-indigo-100">
                      <span className="font-medium text-slate-400 italic">Scholarship: {ss.scholarship.name}</span>
                      <span className="font-bold text-indigo-600/70">−{formatINR(ss.amount)}</span>
                    </div>
                  ))
                }
                {student.deductions.length > 0 && 
                  student.deductions.map(sd => (
                    <div key={sd.id} className="flex justify-between text-[11px] pl-2 border-l-2 border-rose-100 italic">
                      <span className="font-medium text-slate-400">{sd.description}</span>
                      <span className="font-bold text-rose-600/70">−{formatINR(sd.amount)}</span>
                    </div>
                  ))
                }
                <div className="flex justify-between border-t border-slate-100 pt-2">
                  <span className="text-sm font-bold text-slate-700">Net fee</span>
                  <span className="text-base font-black text-indigo-600">{formatINR(fin.netFee)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Paid so far</span>
                  <span className="font-bold text-emerald-600">{formatINR(totalPaid)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Outstanding</span>
                  <span className="font-bold text-slate-800">{formatINR(totalDue)}</span>
                </div>
              </div>

            </div>
          )}
        </div>

        {/* Right column — Tabs: Installments / Reminders */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden">
            {/* Tab header */}
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-1">
              <Link
                href={`/students/${id}?tab=payments`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "payments"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Wallet className="h-3 w-3" />
                Payments
              </Link>
              <Link
                href={`/students/${id}?tab=installments`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "installments" || tab === "payments" || tab === undefined // default and payments handled
                    ? (tab === "installments" || (tab === undefined && student.payments.length === 0)) 
                      ? "bg-indigo-50 text-indigo-700 border border-indigo-200" 
                      : "text-slate-500 hover:text-slate-700"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Schedule
              </Link>
              <Link
                href={`/students/${id}?tab=reminders`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "reminders"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <Bell className="h-3 w-3" />
                Reminders
                {reminderLogs.length > 0 && (
                  <span className="bg-indigo-600 text-white text-[9px] font-black rounded-full w-4 h-4 flex items-center justify-center">
                    {reminderLogs.length}
                  </span>
                )}
              </Link>
              <Link
                href={`/students/${id}?tab=proposal`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "proposal"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <FileText className="h-3 w-3" />
                Proposal
              </Link>
              <Link
                href={`/students/${id}?tab=history`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "history"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                <History className="h-3 w-3" />
                History
              </Link>
            </div>

            {/* Payments tab */}
            {tab === "payments" && (
              <PaymentsTab 
                studentId={student.id} 
                studentName={student.firstName || student.name}
                payments={student.payments} 
                netFee={Number(fin?.netFee ?? 0)}
                canRecord={canRecord}
              />
            )}

            {/* Installments tab */}
            {(tab === "installments" || tab === undefined) && (
              <div className="divide-y divide-slate-50">
                {student.installments.map((inst) => {
                  const style = formatInstallmentStatus(inst.status)
                  const isPaid = inst.status === "PAID" || inst.status === "PARTIAL"
                  return (
                    <div key={inst.id} className="px-5 py-4 flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-bold text-slate-800">{inst.label}</p>
                          <span className={cn(
                            "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border",
                            style.classes
                          )}>
                            {style.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            Due: {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                          </p>
                          {isPaid && inst.paidDate && (
                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">
                              Paid: {new Date(inst.paidDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              {inst.paymentMethod && ` · ${inst.paymentMethod}`}
                            </p>
                          )}
                        </div>
                        {fin?.installmentType === "ANNUAL" && inst.year > 0 && waiverPerYear > 0 && yearFees[inst.year] && (
                          <p className="text-[10px] font-medium text-slate-400 mt-1">
                            {formatINR(yearFees[inst.year])}
                            {" − "}
                            <span className="text-emerald-600 font-semibold">{formatINR(waiverPerYear)} waiver</span>
                            {" = "}
                            <span className="font-bold text-slate-600">{formatINR(Math.round(inst.amount.toNumber()))}</span>
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-sm font-extrabold", isPaid ? "text-emerald-600" : "text-slate-800")}>
                          {isPaid && inst.paidAmount ? formatINR(inst.paidAmount) : formatINR(inst.amount)}
                        </p>
                        {isPaid && inst.paidAmount && inst.paidAmount.toNumber() !== inst.amount.toNumber() && (
                          <p className="text-[10px] text-slate-400">of {formatINR(inst.amount)}</p>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1.5 shrink-0">
                        {isPaid && (
                          <Link
                            href={`/students/${student.id}/receipts/${inst.id}`}
                            className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            Receipt →
                          </Link>
                        )}
                        {!isPaid && canRecord && (
                          <RecordPaymentDialog studentId={student.id} studentName={student.firstName || student.name} installment={inst} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Reminders tab */}
            {tab === "reminders" && (
              <RemindersTab logs={reminderLogs} />
            )}

            {/* Proposal tab */}
            {tab === "proposal" && (
              <ProposalTab studentId={student.id} />
            )}

            {/* History tab */}
            {tab === "history" && (
              <HistoryTab logs={student.auditLogs as any} />
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <DocumentUpload studentId={student.id} documents={student.documents} />
    </div>
  )
}
