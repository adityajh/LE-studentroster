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
  const paidAmount = installment.paidAmount?.toNumber() ?? installment.amount.toNumber()
  const installmentAmount = installment.amount.toNumber()
  const isPartial = installment.status === "PARTIAL"
  const balance = Math.max(0, installmentAmount - paidAmount)

  const receiptNo = `RCP-${student.rollNo}-${installment.year}-${installmentId.slice(-4).toUpperCase()}`
  const paidDate = installment.paidDate
    ? new Date(installment.paidDate).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—"

  const photo = student.documents[0]

  return (
    <div className="space-y-4 max-w-[800px]">
      {/* Nav — hidden in print */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/students/${studentId}`}
          className="flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-800 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to {student.name}
        </Link>
        <PrintButton />
      </div>

      {/* Receipt card */}
      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden print:shadow-none print:border-slate-300">
        {/* Header stripe */}
        <div className="bg-slate-950 text-white px-8 py-6 flex items-start justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Let&apos;s Enterprise
            </p>
            <h1 className="text-xl font-extrabold mt-0.5">Payment Receipt</h1>
            <p className="text-xs font-mono text-slate-400 mt-1">{receiptNo}</p>
          </div>
          <div className="text-right">
            {isPartial && (
              <span className="inline-block bg-orange-500/20 text-orange-300 text-[10px] uppercase tracking-widest font-bold px-2.5 py-1 rounded-lg mb-2">
                Partial Payment
              </span>
            )}
            <p className="text-3xl font-black">{formatINR(paidAmount)}</p>
            <p className="text-xs font-medium text-slate-400 mt-0.5">{paidDate}</p>
          </div>
        </div>

        {/* Body */}
        <div className="px-8 py-6 space-y-6">
          {/* Student info */}
          <div className="flex items-start gap-4">
            {photo ? (
              <img
                src={photo.fileUrl}
                alt={student.name}
                className="w-14 h-14 rounded-full object-cover border-2 border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-indigo-100 border-2 border-indigo-200 flex items-center justify-center shrink-0">
                <span className="text-lg font-black text-indigo-500">
                  {student.name.split(" ").map((n: string) => n[0]).slice(0, 2).join("")}
                </span>
              </div>
            )}
            <div>
              <p className="text-lg font-extrabold text-slate-900">{student.name}</p>
              <p className="text-xs font-mono font-bold text-slate-400">{student.rollNo}</p>
              <p className="text-xs font-medium text-slate-500 mt-0.5">
                {student.program.name} · {student.batch.name}
              </p>
            </div>
          </div>

          <div className="border-t border-slate-100" />

          {/* Payment details */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Installment</p>
              <p className="text-sm font-bold text-slate-800">{installment.label}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Installment Due</p>
              <p className="text-sm font-bold text-slate-800">{formatINR(installmentAmount)}</p>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Amount Paid</p>
              <p className={cn("text-sm font-bold", isPartial ? "text-orange-700" : "text-emerald-700")}>
                {formatINR(paidAmount)}
              </p>
            </div>
            {installment.paymentMethod && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Payment Method</p>
                <p className="text-sm font-bold text-slate-800">{installment.paymentMethod}</p>
              </div>
            )}
            {installment.paidDate && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Date</p>
                <p className="text-sm font-bold text-slate-800">{paidDate}</p>
              </div>
            )}
            {student.financial && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Net Programme Fee</p>
                <p className="text-sm font-bold text-slate-800">{formatINR(student.financial.netFee.toNumber())}</p>
              </div>
            )}
          </div>

          {isPartial && (
            <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3">
              <p className="text-xs font-bold text-orange-700">
                Partial payment recorded — balance of {formatINR(balance)} remains outstanding.
              </p>
            </div>
          )}

          {installment.notes && (
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Notes</p>
              <p className="text-sm font-medium text-slate-600">{installment.notes}</p>
            </div>
          )}

          <div className="border-t border-slate-100" />

          <p className="text-[10px] font-medium text-slate-400 text-center">
            This is a system-generated receipt. For queries, contact Let&apos;s Enterprise.
          </p>
        </div>
      </div>
    </div>
  )
}
