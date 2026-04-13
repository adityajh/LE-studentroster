import { notFound } from "next/navigation"
import Link from "next/link"
import { prisma } from "@/lib/prisma"
import { formatINR } from "@/lib/fee-schedule"
import { computePaymentAllocation } from "@/lib/fifo"
import { PrintButton } from "@/components/students/print-button"
import { ArrowLeft } from "lucide-react"

export default async function PaymentReceiptPage({
  params,
}: {
  params: Promise<{ id: string; paymentId: string }>
}) {
  const { id: studentId, paymentId } = await params

  // Fetch the target payment
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      recordedBy: { select: { name: true } },
    },
  })

  if (!payment || payment.studentId !== studentId) notFound()

  // Fetch student + all payments + all installments
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      program: { select: { name: true } },
      batch: { select: { year: true, name: true } },
      documents: { where: { type: "STUDENT_PHOTO" }, take: 1 },
      payments: { select: { id: true, amount: true, date: true }, orderBy: { date: "asc" } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  })

  if (!student) notFound()

  // Compute FIFO allocation for this payment
  const allocationRows = computePaymentAllocation(
    paymentId,
    student.payments.map(p => ({ id: p.id, amount: Number(p.amount), date: p.date })),
    student.installments.map(i => ({
      id: i.id,
      label: i.label,
      amount: Number(i.amount),
      dueDate: i.dueDate,
    }))
  )

  const photo = student.documents[0]
  const paymentAmount = Number(payment.amount)

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
              <img
                src={photo.fileUrl}
                alt={student.name}
                className="w-16 h-16 rounded-full object-cover border-2 border-slate-200"
              />
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
              <p className="text-xs font-semibold text-slate-500">
                {student.program.name} · {student.batch.name}
              </p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Receipt</p>
            <p className="text-lg font-black text-emerald-700">{formatINR(paymentAmount)}</p>
            <p className="text-[10px] font-mono font-bold text-slate-400 mt-1 uppercase">
              #{paymentId.slice(-8).toUpperCase()}
            </p>
          </div>
        </div>

        {/* Payment details */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            {
              label: "Date",
              value: new Date(payment.date).toLocaleDateString("en-IN", {
                day: "numeric", month: "short", year: "numeric",
              }),
            },
            { label: "Mode", value: payment.paymentMode },
            { label: "Reference No", value: payment.referenceNo ?? "—" },
            { label: "Payer", value: payment.payerName ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} className="bg-slate-50 rounded-xl px-4 py-3">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</p>
              <p className="text-sm font-bold text-slate-700 mt-0.5 truncate">{value}</p>
            </div>
          ))}
        </div>

        {/* FIFO Allocation breakdown */}
        <div className="space-y-3">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Allocated To
          </p>
          {allocationRows.length === 0 ? (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 text-sm font-medium text-slate-500 italic">
              This payment is an advance — no installments were due at the time of recording.
            </div>
          ) : (
            <div className="border border-slate-100 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">
                      Installment
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">
                      Fee
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">
                      Applied
                    </th>
                    <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">
                      Total Received
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {allocationRows.map(row => (
                    <tr key={row.installmentId} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.label}</td>
                      <td className="px-4 py-3 text-right text-slate-500">{formatINR(row.fee)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-700">
                        {formatINR(row.allocated)}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-700">
                        {formatINR(row.cumAllocated)}
                        {row.cumAllocated >= row.fee && (
                          <span className="ml-2 text-[9px] font-black uppercase text-emerald-600 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Summary */}
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 mb-0.5">
              Amount Received
            </p>
            <p className="text-2xl font-black text-emerald-700">{formatINR(paymentAmount)}</p>
          </div>
          {payment.recordedBy && (
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-0.5">
                Recorded by
              </p>
              <p className="text-sm font-bold text-slate-600">{payment.recordedBy.name}</p>
            </div>
          )}
        </div>

        {payment.notes && (
          <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-3">
            <p className="text-[10px] uppercase tracking-widest font-bold text-amber-500 mb-1">Notes</p>
            <p className="text-sm font-medium text-slate-700">{payment.notes}</p>
          </div>
        )}

        <p className="text-[10px] font-medium text-slate-400 text-center pt-4 border-t border-slate-100">
          This is a system-generated receipt. For any queries contact the admissions office.
        </p>
      </div>
    </div>
  )
}
