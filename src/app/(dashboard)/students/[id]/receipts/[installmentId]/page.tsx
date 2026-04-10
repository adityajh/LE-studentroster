import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatINR } from "@/lib/fee-schedule"
import { cn } from "@/lib/utils"
import { PrintButton } from "@/components/students/print-button"
import { ArrowLeft } from "lucide-react"

export default async function ReceiptPage({
  params,
}: {
  params: Promise<{ id: string; installmentId: string }>
}) {
  const { id: studentId, installmentId } = await params

  const installment = await prisma.installment.findUnique({
    where: { id: installmentId },
    include: {
      student: {
        include: {
          program: { select: { name: true } },
          batch: { select: { year: true, name: true } },
          financial: { select: { netFee: true, installmentType: true } },
          documents: { where: { type: "STUDENT_PHOTO" }, take: 1 },
        },
      },
    },
  })

  if (!installment || installment.studentId !== studentId) notFound()
  if (installment.status !== "PAID" && installment.status !== "PARTIAL") {
    notFound()
  }

  const student = installment.student
  const payments = await prisma.payment.findMany({
    where: { installmentId },
    orderBy: { date: "asc" }
  })

  // Fallback for legacy data if no payments are in the journal yet
  const totalPaid = payments.length > 0 
    ? payments.reduce((s, p) => s + Number(p.amount), 0)
    : (installment.paidAmount?.toNumber() ?? installment.amount.toNumber())

  const installmentAmount = installment.amount.toNumber()
  const balance = Math.max(0, installmentAmount - totalPaid)
  const isPartial = totalPaid < installmentAmount
  
  const photo = student.documents[0]

  return (
    <div className="space-y-6 max-w-[800px]">
      {/* Nav — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/students/${studentId}?tab=payments`}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Payments
        </Link>
        <PrintButton />
      </div>

      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-8 space-y-8">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-slate-100 pb-6">
          <div className="flex items-center gap-4">
            {photo ? (
              <img src={photo.fileUrl} alt={student.name} className="w-16 h-16 rounded-full object-cover border-2 border-slate-200" />
            ) : (
              <div className="w-16 h-16 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center">
                <span className="text-xl font-black text-indigo-500">
                  {student.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </span>
              </div>
            )}
            <div>
              <p className="text-xl font-black text-slate-900">{student.name}</p>
              <p className="text-sm font-bold text-slate-400 font-mono mt-0.5">{student.rollNo}</p>
              <p className="text-xs font-semibold text-slate-500">{student.program.name} · {student.batch.name}</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Installment</p>
            <p className="text-lg font-black text-slate-800">{installment.label}</p>
            <p className="text-sm font-bold text-indigo-600 mt-1">Due: {formatINR(installmentAmount)}</p>
          </div>
        </div>

        {/* Payments list */}
        <div className="space-y-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment Breakdown</p>
          <div className="divide-y divide-slate-100 border border-slate-100 rounded-2xl overflow-hidden">
            {payments.length === 0 ? (
              <div className="p-4 bg-slate-50 text-slate-500 text-sm font-medium italic">
                Legacy record — total of {formatINR(totalPaid)} received on {installment.paidDate ? new Date(installment.paidDate).toLocaleDateString("en-IN") : "unknown date"}.
              </div>
            ) : (
              payments.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-emerald-700">{formatINR(Number(p.amount))}</p>
                      <span className="text-[10px] font-mono font-bold text-slate-400 opacity-50 uppercase">
                        #{p.id.slice(-6).toUpperCase()}
                      </span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {p.paymentMode && ` · ${p.paymentMode}`}
                      {p.referenceNo && ` · Ref: ${p.referenceNo}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <a 
                      href={`/api/students/${studentId}/pay/${p.id}/receipt`}
                      className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Download PDF
                    </a>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Summary */}
        <div className="bg-slate-50 rounded-2xl p-6">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Total Received</p>
              <p className="text-2xl font-black text-emerald-700">{formatINR(totalPaid)}</p>
            </div>
            {isPartial && (
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-widest font-bold text-rose-400 mb-1">Balance Due</p>
                <p className="text-2xl font-black text-rose-600">{formatINR(balance)}</p>
              </div>
            )}
            {!isPartial && (
              <div className="text-right">
                <span className="bg-emerald-500 text-white text-[10px] uppercase tracking-widest font-black px-4 py-1.5 rounded-full">
                  Fully Paid
                </span>
              </div>
            )}
          </div>
        </div>

        <p className="text-[10px] font-medium text-slate-400 text-center pt-4">
          This is a system-generated summary of payments for {installment.label}. Individual receipts can be downloaded separately.
        </p>
      </div>
    </div>
  )
}
