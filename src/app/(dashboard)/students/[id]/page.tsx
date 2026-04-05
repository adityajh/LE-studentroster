import { notFound } from "next/navigation"
import Link from "next/link"
import { getStudentById } from "@/lib/students"
import { formatInstallmentStatus, formatStudentStatus } from "@/lib/students"
import { formatINR } from "@/lib/fee-schedule"
import { RecordPaymentDialog } from "@/components/students/record-payment-dialog"
import { cn } from "@/lib/utils"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { Phone, Mail, Calendar } from "lucide-react"

export default async function StudentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const student = await getStudentById(id)
  if (!student) notFound()

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })
  const canRecord = !!dbUser

  const fin = student.financial
  const statusStyle = formatStudentStatus(student.status)

  const paidInstallments = student.installments.filter((i) => i.status === "PAID")
  const totalPaid = paidInstallments.reduce((s, i) => s + Math.round(i.paidAmount?.toNumber() ?? i.amount.toNumber()), 0)
  const totalDue = student.installments
    .filter((i) => i.status !== "PAID")
    .reduce((s, i) => s + Math.round(i.amount.toNumber()), 0)

  // Waiver breakdown per installment (ANNUAL only)
  const waiverPerYear = fin ? Math.round(fin.totalWaiver.toNumber() / 3) : 0
  const yearFees: Record<number, number> = {
    1: student.program.year1Fee.toNumber(),
    2: student.program.year2Fee.toNumber(),
    3: student.program.year3Fee.toNumber(),
  }

  return (
    <div className="space-y-8 max-w-[1000px]">
      {/* Breadcrumb */}
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

        <div className="flex items-start justify-between">
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
            <div className="flex items-center gap-2.5 text-sm">
              <Calendar className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="font-medium text-slate-500">
                Enrolled {new Date(student.enrollmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
              </span>
            </div>
          </div>

          {/* Fee Summary */}
          {fin && (
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">Fee Summary</p>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Base fee</span>
                  <span className="font-bold text-slate-700">{formatINR(fin.baseFee)}</span>
                </div>
                {fin.totalWaiver.toNumber() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Waivers</span>
                    <span className="font-bold text-emerald-600">−{formatINR(fin.totalWaiver)}</span>
                  </div>
                )}
                {fin.totalDeduction.toNumber() > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-500">Deductions</span>
                    <span className="font-bold text-emerald-600">−{formatINR(fin.totalDeduction)}</span>
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
                  <span className="font-bold text-slate-800">{formatINR(totalDue)}</span>
                </div>
              </div>

              {/* Offers applied */}
              {student.offers.length > 0 && (
                <div className="mt-4 pt-3 border-t border-slate-100 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Offers Applied</p>
                  {student.offers.map((o) => (
                    <div key={o.id} className="flex justify-between text-xs">
                      <span className="font-medium text-slate-500">{o.offer.name}</span>
                      <span className="font-bold text-emerald-600">−{formatINR(o.waiverAmount)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Scholarships applied */}
              {student.scholarships.length > 0 && (
                <div className="mt-3 space-y-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-2">Scholarships</p>
                  {student.scholarships.map((s) => (
                    <div key={s.id} className="flex justify-between text-xs">
                      <span className="font-medium text-slate-500">{s.scholarship.name}</span>
                      <span className="font-bold text-emerald-600">−{formatINR(s.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right column — Installments */}
        <div className="lg:col-span-2">
          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Installments</p>
              <p className="text-base font-extrabold text-slate-900 mt-0.5">
                Payment Schedule
              </p>
            </div>
            <div className="divide-y divide-slate-50">
              {student.installments.map((inst) => {
                const style = formatInstallmentStatus(inst.status)
                const isPaid = inst.status === "PAID"
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
                        {isPaid && inst.paidAmount
                          ? formatINR(inst.paidAmount)
                          : formatINR(inst.amount)}
                      </p>
                      {isPaid && inst.paidAmount && inst.paidAmount.toNumber() !== inst.amount.toNumber() && (
                        <p className="text-[10px] text-slate-400">of {formatINR(inst.amount)}</p>
                      )}
                    </div>
                    {!isPaid && canRecord && (
                      <RecordPaymentDialog studentId={student.id} installment={inst} />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
