import { notFound } from "next/navigation"
import Link from "next/link"
import { getStudentById } from "@/lib/students"
import { formatInstallmentStatus, formatStudentStatus } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { splitWaivers } from "@/lib/fee-calc"
import { RecordPaymentDialog } from "@/components/students/record-payment-dialog"
import { DocumentUpload } from "@/components/students/document-upload"
import { RemindersTab } from "@/components/students/reminders-tab"
import { ProposalTab } from "@/components/students/proposal-tab"
import { HistoryTab } from "@/components/students/history-tab"
import { PaymentsTab } from "@/components/students/payments-tab"
import { ConfirmEnrolmentDialog } from "@/components/students/confirm-enrolment-dialog"
import { SendOfferButton } from "@/components/students/send-offer-button"
import { cn } from "@/lib/utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Phone, Mail, Calendar, MapPin, Users, Droplets, Pencil, Bell, FileText, History, Wallet, Clock, GraduationCap } from "lucide-react"

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
  // Outstanding = netFee minus what's been paid (netFee already incorporates deductions)
  const netFeeAmount = fin ? Number(fin.netFee) : 0
  const outstanding = Math.max(0, netFeeAmount - totalPaid)

  const yearFees: Record<number, number> = {
    1: student.program.year1Fee.toNumber(),
    2: student.program.year2Fee.toNumber(),
    3: student.program.year3Fee.toNumber(),
  }

  // Synthetic registration row — shown when no year=0 installment exists
  const hasRegInstallment = student.installments.some(i => i.year === 0)
  const regFeeAmount = fin?.registrationFeeOverride != null
    ? Number(fin.registrationFeeOverride)
    : student.program.registrationFee.toNumber()
  const syntheticReg = !hasRegInstallment && fin ? {
    label: "Registration Fee",
    amount: regFeeAmount,
    isPaid: fin.registrationPaid,
    paidDate: fin.registrationPaidDate,
  } : null

  const photo = student.documents.find((d) => d.type === "STUDENT_PHOTO")
  const hasAddress = student.city || student.address || student.localAddress
  const hasParents = student.parent1Name || student.parent2Name || student.localGuardianName

  // Offer expiry calculations
  const isOffered = student.status === "OFFERED"
  const offerExpiry = student.offerExpiresAt ? new Date(student.offerExpiresAt) : null
  const daysLeft = offerExpiry
    ? Math.ceil((offerExpiry.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null
  const offerExpired = daysLeft !== null && daysLeft < 0

  // Compute per-installment fees from current fee scheme (not stale inst.amount)
  const { spreadPerYear: schemeSpreadPerYear, onetimeTotal: schemeOnetimeTotal } = splitWaivers(
    student.offers.map(o => ({
      conditions: (o.offer as { conditions: unknown }).conditions,
      waiverAmount: Number(o.waiverAmount),
    })),
    student.scholarships.map(sc => ({
      amount: Number(sc.amount),
      spreadAcrossYears: (sc.scholarship as { spreadAcrossYears: boolean }).spreadAcrossYears,
    }))
  )

  // Total manual deductions (reduce year 1 installment)
  const totalDeductionAmount = student.deductions.reduce((s, d) => s + Number(d.amount), 0)

  // Expected fee for a given installment year under the current scheme
  const expectedInstFee = (year: number, instAmount: number): number => {
    if (year === 0) return regFeeAmount
    if (fin?.installmentType === "ANNUAL") {
      const base = yearFees[year] ?? 0
      const deductionForYear = year === 1 ? totalDeductionAmount : 0
      return Math.max(0, Math.round(base - schemeSpreadPerYear - (year === 1 ? schemeOnetimeTotal : 0) - deductionForYear))
    }
    // ONE_TIME or CUSTOM: use stored amount (custom plans are admin-set)
    return instAmount
  }

  // FIFO: walk installments in year order, allocate payments against scheme fees
  const sortedInstsForSchedule = [...student.installments].sort((a, b) => a.year - b.year)
  let fifoRemaining = totalPaid
  let syntheticRegFifo: { fee: number; received: number; pending: number } | null = null
  if (syntheticReg) {
    const fee = syntheticReg.amount
    const received = Math.min(fifoRemaining, fee)
    fifoRemaining -= received
    syntheticRegFifo = { fee, received, pending: Math.max(0, fee - received) }
  }
  const scheduleRows = sortedInstsForSchedule.map(inst => {
    const fee = expectedInstFee(inst.year, Number(inst.amount))
    const received = Math.min(fifoRemaining, fee)
    fifoRemaining -= received
    return { inst, fee, received, pending: Math.max(0, fee - received) }
  })

  return (
    <div className="space-y-8 max-w-[1000px]">
      {/* Offer expiry banner */}
      {isOffered && offerExpiry && (
        <div className={cn(
          "flex items-start gap-3 rounded-xl px-4 py-3 border",
          offerExpired
            ? "bg-rose-50 border-rose-200 text-rose-800"
            : daysLeft !== null && daysLeft <= 1
            ? "bg-amber-50 border-amber-200 text-amber-800"
            : "bg-violet-50 border-violet-200 text-violet-800"
        )}>
          <Clock className="h-4 w-4 mt-0.5 shrink-0" />
          <div className="text-sm">
            {offerExpired ? (
              <span>
                <strong>Offer window closed</strong> — the 7-day confirmation deadline passed on{" "}
                {offerExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short" })}.
                {student.offerRevised
                  ? " Revised offer (without 7-day waiver) has been sent."
                  : " The 7-day waiver will be revoked automatically overnight."}
              </span>
            ) : (
              <span>
                <strong>Offer expires in {daysLeft} day{daysLeft !== 1 ? "s" : ""}</strong>
                {" "}({offerExpiry.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })})
                {student.offerSentAt
                  ? ` — offer email sent ${new Date(student.offerSentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`
                  : " — offer email not yet sent"}
              </span>
            )}
          </div>
        </div>
      )}
      {isOffered && !offerExpiry && (
        <div className="flex items-center gap-3 rounded-xl px-4 py-3 border bg-violet-50 border-violet-200 text-violet-800 text-sm">
          <Clock className="h-4 w-4 shrink-0" />
          <span><strong>Offer pending</strong> — send the offer email to start the 7-day confirmation window.</span>
        </div>
      )}

      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Link href="/students" className="text-[10px] uppercase tracking-widest font-bold text-slate-400 hover:text-slate-600">
            Students
          </Link>
          <span className="text-slate-300">/</span>
          <span className="text-[10px] uppercase tracking-widest font-bold text-slate-500 font-mono">
            {student.rollNo ?? "Pending Enrolment"}
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
                {student.rollNo && (
                  <span className="bg-slate-500/10 text-slate-600 border border-slate-500/20 text-[10px] uppercase tracking-wider font-bold px-2.5 py-1 rounded-lg font-mono">
                    {student.rollNo}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOffered && (
              <>
                <SendOfferButton
                  studentId={student.id}
                  alreadySent={!!student.offerSentAt}
                />
                <ConfirmEnrolmentDialog
                  studentId={student.id}
                  studentName={student.name}
                />
              </>
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

          {/* Social & University */}
          {(student.universityChoice || student.linkedinHandle || student.instagramHandle) && (
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-5 space-y-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Social & University</p>
              {student.universityChoice && (
                <div className="flex items-center gap-2.5">
                  <GraduationCap className="h-4 w-4 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-slate-700">{student.universityChoice}</p>
                    {student.universityStatus && (
                      <p className="text-xs font-medium text-emerald-600 mt-0.5">{student.universityStatus}</p>
                    )}
                  </div>
                </div>
              )}
              {student.linkedinHandle && (
                <div className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0 text-[#0A66C2]" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                  <a href={student.linkedinHandle} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-[#0A66C2] hover:underline truncate">
                    {student.linkedinHandle.replace(/^https?:\/\/(www\.)?linkedin\.com\/in\//, "").replace(/\?.*$/, "").replace(/\/$/, "")}
                  </a>
                </div>
              )}
              {student.instagramHandle && (
                <div className="flex items-center gap-2.5">
                  <svg className="h-4 w-4 shrink-0 text-pink-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                  <span className="text-sm font-medium text-slate-700">{student.instagramHandle}</span>
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
                    <div key={so.id} className="flex justify-between text-xs pl-2 border-l-2 border-emerald-500/30">
                      <span className="font-semibold text-slate-500 italic">{so.offer.name}</span>
                      <span className="font-bold text-emerald-600">−{formatINR(so.waiverAmount)}</span>
                    </div>
                  ))
                }
                {student.scholarships.length > 0 && 
                  student.scholarships.map(ss => (
                    <div key={ss.id} className="flex justify-between text-xs pl-2 border-l-2 border-indigo-500/30">
                      <span className="font-semibold text-slate-500 italic">Scholarship: {ss.scholarship.name}</span>
                      <span className="font-bold text-indigo-600">−{formatINR(ss.amount)}</span>
                    </div>
                  ))
                }
                {student.deductions.length > 0 && 
                  student.deductions.map(sd => (
                    <div key={sd.id} className="flex justify-between text-xs pl-2 border-l-2 border-rose-500/30">
                      <span className="font-semibold text-slate-500 italic">{sd.description}</span>
                      <span className="font-bold text-rose-600">−{formatINR(sd.amount)}</span>
                    </div>
                  ))
                }
                {/* Fallback for legacy data or manual overrides not in items */}
                {fin.totalWaiver.toNumber() > 0 && student.offers.length === 0 && student.scholarships.length === 0 && (
                  <div className="flex justify-between text-xs pl-2 border-l-2 border-slate-200">
                    <span className="font-semibold text-slate-500 italic">Applied Waivers</span>
                    <span className="font-bold text-emerald-600">−{formatINR(fin.totalWaiver)}</span>
                  </div>
                )}
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
                  <span className="font-bold text-slate-800">{formatINR(outstanding)}</span>
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
                href={`/students/${id}?tab=installments`}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all",
                  tab === "installments"
                    ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                    : "text-slate-500 hover:text-slate-700"
                )}
              >
                Schedule
              </Link>
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

            {/* Schedule tab */}
            {tab === "installments" && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100">
                      <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-5 py-3">Type</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-3">Fee</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-3">Received</th>
                      <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-3">Pending</th>
                      <th className="px-5 py-3"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {/* Synthetic registration row */}
                    {syntheticReg && syntheticRegFifo && (
                      <tr>
                        <td className="px-5 py-4">
                          <p className="font-bold text-slate-800">Registration</p>
                          <span className={cn(
                            "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border mt-1",
                            syntheticReg.isPaid
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-amber-50 text-amber-700 border-amber-200"
                          )}>
                            {syntheticReg.isPaid ? "PAID" : "PENDING"}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-right">
                          <p className="font-extrabold text-slate-800">{formatINR(syntheticRegFifo.fee)}</p>
                          {syntheticReg.isPaid && syntheticReg.paidDate && (
                            <p className="text-[10px] text-emerald-500 font-semibold mt-0.5">
                              Paid {new Date(syntheticReg.paidDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 text-right font-extrabold text-emerald-600">
                          {syntheticRegFifo.received > 0 ? formatINR(syntheticRegFifo.received) : "—"}
                        </td>
                        <td className="px-4 py-4 text-right font-extrabold text-slate-800">
                          {syntheticRegFifo.pending > 0 ? formatINR(syntheticRegFifo.pending) : <span className="text-emerald-500">✓</span>}
                        </td>
                        <td className="px-5 py-4"></td>
                      </tr>
                    )}
                    {/* Real installment rows */}
                    {scheduleRows.map(({ inst, fee, received, pending }) => {
                      const style = formatInstallmentStatus(inst.status)
                      const isPaid = inst.status === "PAID" || inst.status === "PARTIAL"
                      // Build breakdown lines for ANNUAL years only
                      const isAnnualYear = fin?.installmentType === "ANNUAL" && inst.year > 0 && yearFees[inst.year]
                      const totalWaiverForYear = isAnnualYear
                        ? schemeSpreadPerYear + (inst.year === 1 ? schemeOnetimeTotal + totalDeductionAmount : 0)
                        : 0
                      return (
                        <tr key={inst.id}>
                          <td className="px-5 py-4">
                            <p className="font-bold text-slate-800">{inst.label}</p>
                            <span className={cn(
                              "inline-flex items-center text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border mt-1",
                              style.classes
                            )}>
                              {style.label}
                            </span>
                          </td>
                          <td className="px-4 py-4 text-right">
                            <p className="font-extrabold text-slate-800">{formatINR(fee)}</p>
                            {isAnnualYear && totalWaiverForYear > 0 && (
                              <p className="text-[10px] text-slate-400 mt-0.5">
                                {formatINR(yearFees[inst.year])}
                                {" − "}
                                <span className="text-emerald-600">{formatINR(totalWaiverForYear)} waiver</span>
                              </p>
                            )}
                            <p className="text-[10px] text-slate-400 mt-0.5">
                              Due {new Date(inst.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                            </p>
                          </td>
                          <td className="px-4 py-4 text-right font-extrabold text-emerald-600">
                            {received > 0 ? formatINR(received) : "—"}
                          </td>
                          <td className="px-4 py-4 text-right font-extrabold text-slate-800">
                            {pending > 0 ? formatINR(pending) : <span className="text-emerald-500">✓</span>}
                          </td>
                          <td className="px-5 py-4 text-right">
                            {!isPaid && canRecord && (
                              <RecordPaymentDialog studentId={student.id} studentName={student.firstName || student.name} installment={inst} />
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
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
              <HistoryTab logs={student.auditLogs} />
            )}
          </div>
        </div>
      </div>

      {/* Documents */}
      <DocumentUpload studentId={student.id} documents={student.documents} />
    </div>
  )
}
