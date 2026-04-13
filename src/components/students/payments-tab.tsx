"use client"

import Link from "next/link"
import { formatINR } from "@/lib/fee-schedule"
import { cn } from "@/lib/utils"
import { RecordPaymentDialog } from "./record-payment-dialog"
import { Wallet, Info, FileText, User as UserIcon, Receipt } from "lucide-react"

interface Payment {
  id: string
  amount: { toString(): string }
  date: Date
  paymentMode: string | null
  referenceNo: string | null
  payerName: string | null
  notes: string | null
  recordedBy: { name: string | null } | null
  installment: { label: string } | null
}

interface Props {
  studentId: string
  studentName: string
  payments: any[] // We'll cast to Payment
  netFee: number
  canRecord: boolean
}

export function PaymentsTab({ studentId, studentName, payments, netFee, canRecord }: Props) {
  const typedPayments = payments as unknown as Payment[]
  const totalReceived = typedPayments.reduce((sum, p) => sum + Number(p.amount), 0)
  const outstanding = Math.max(0, netFee - totalReceived)
  const collectionPercentage = netFee > 0 ? (totalReceived / netFee) * 100 : 0

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="px-5 pt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-emerald-600 mb-1">Total Received</p>
          <p className="text-xl font-black text-emerald-700">{formatINR(totalReceived)}</p>
          <div className="mt-2 h-1 w-full bg-emerald-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-emerald-500 transition-all duration-1000" 
              style={{ width: `${Math.min(100, collectionPercentage)}%` }} 
            />
          </div>
        </div>
        <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">Outstanding</p>
          <p className="text-xl font-black text-slate-700">{formatINR(outstanding)}</p>
          <p className="text-[10px] font-medium text-slate-400 mt-1">{Math.round(100 - collectionPercentage)}% remaining</p>
        </div>
        <div className="flex flex-col justify-end">
          {canRecord && (
            <RecordPaymentDialog 
              studentId={studentId} 
              studentName={studentName} 
            />
          )}
        </div>
      </div>

      {/* Payments List */}
      <div className="divide-y divide-slate-50">
        {typedPayments.length === 0 ? (
          <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-3">
            <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center">
              <Wallet className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium">No payments recorded yet</p>
          </div>
        ) : (
          typedPayments.map((p) => (
            <div key={p.id} className="px-5 py-4 flex items-start justify-between gap-4 hover:bg-slate-50/50 transition-colors">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-slate-800">
                    {formatINR(Number(p.amount))}
                  </span>
                  <span className={cn(
                    "text-[9px] uppercase tracking-widest font-black px-2 py-0.5 rounded border",
                    p.installment ? "bg-indigo-50 text-indigo-600 border-indigo-100" : "bg-amber-50 text-amber-600 border-amber-100"
                  )}>
                    {p.installment ? p.installment.label : "Advance / Unlinked"}
                  </span>
                </div>
                
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                    <Info className="h-3 w-3" />
                    {new Date(p.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    {p.paymentMode && ` · ${p.paymentMode}`}
                  </div>
                  {p.referenceNo && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-indigo-500">
                      <FileText className="h-3 w-3" />
                      Ref: {p.referenceNo}
                    </div>
                  )}
                  {p.recordedBy && (
                    <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-400">
                      <UserIcon className="h-3 w-3" />
                      Recorded by: {p.recordedBy.name}
                    </div>
                  )}
                </div>
                
                {(p.payerName || p.notes) && (
                  <div className="mt-2 space-y-1">
                    {p.payerName && (
                      <p className="text-xs font-medium text-slate-600">
                        <span className="text-slate-400 font-bold">Payer:</span> {p.payerName}
                      </p>
                    )}
                    {p.notes && (
                      <p className="text-xs italic text-slate-500">
                        &quot;{p.notes}&quot;
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="flex flex-col items-end gap-2">
                <Link
                  href={`/students/${studentId}/receipts/payments/${p.id}`}
                  className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-indigo-600 hover:text-indigo-800 transition-colors"
                >
                  <Receipt className="h-3 w-3" />
                  Receipt
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
