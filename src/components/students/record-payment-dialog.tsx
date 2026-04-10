"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { formatINR } from "@/lib/fee-schedule"

interface Props {
  studentId: string
  studentName: string
  installment?: {
    id: string
    label: string
    amount: { toString(): string }
  }
}

export function RecordPaymentDialog({ studentId, studentName, installment }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const maxAmount = installment ? parseFloat(installment.amount.toString()) : 0
  const [paidAmount, setPaidAmount] = useState(maxAmount)
  const balance = Math.max(0, maxAmount - paidAmount)
  const isPartial = installment && paidAmount > 0 && paidAmount < maxAmount
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMode, setPaymentMode] = useState("UPI")
  const [referenceNo, setReferenceNo] = useState("")
  const [payerName, setPayerName] = useState(studentName)
  const [notes, setNotes] = useState("")
  const [sendReceipt, setSendReceipt] = useState(true)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: installment?.id,
          paidAmount,
          paidDate,
          paymentMode,
          referenceNo,
          payerName,
          notes,
          sendReceipt,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to record payment")
      
      // If payment was recorded and sendReceipt was on, trigger the receipt email
      if (sendReceipt && data.paymentId) {
        // Receipt API will be implemented in Phase 5/6
        fetch(`/api/students/${studentId}/pay/${data.paymentId}/receipt`, { method: "POST" }).catch(console.error)
      }

      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50">
            {installment ? "Record Payment" : "Record Ad-hoc Payment"}
          </button>
        }
      />
      <DialogContent className="max-w-md rounded-2xl border-slate-200">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment</p>
          <DialogTitle className="text-lg font-extrabold text-slate-900">
            {installment ? installment.label : "General Payment (Advance)"}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Amount Paid
            </label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-slate-400">₹</span>
              <input
                type="number"
                value={paidAmount}
                onChange={(e) => setPaidAmount(Math.round(parseFloat(e.target.value) || 0))}
                max={installment ? maxAmount : undefined}
                min={1}
                required
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white pl-8 pr-4 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
            {installment && (
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-slate-400">
                  Due: {formatINR(maxAmount)}
                </p>
                {isPartial && (
                  <p className="text-xs font-semibold text-orange-600">
                    Balance: {formatINR(balance)} — will mark as Partial
                  </p>
                )}
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Payer Name
            </label>
            <input
              value={payerName}
              onChange={(e) => setPayerName(e.target.value)}
              placeholder="Who is paying?"
              required
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Payment Date
              </label>
              <input
                type="date"
                value={paidDate}
                onChange={(e) => setPaidDate(e.target.value)}
                required
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                Mode
              </label>
              <select
                value={paymentMode}
                onChange={(e) => setPaymentMode(e.target.value)}
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="UPI">UPI</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="CASH">Cash</option>
                <option value="CHEQUE">Cheque</option>
                <option value="NEFT">NEFT</option>
                <option value="RTGS">RTGS</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Reference / Transaction ID
            </label>
            <input
              value={referenceNo}
              onChange={(e) => setReferenceNo(e.target.value)}
              placeholder="UTR, Cheque No, UPI Ref..."
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Internal notes..."
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="sendReceipt"
              checked={sendReceipt}
              onChange={(e) => setSendReceipt(e.target.checked)}
              className="w-4 h-4 rounded-md border-slate-300 text-indigo-600 focus:ring-indigo-600"
            />
            <label htmlFor="sendReceipt" className="text-xs font-bold text-slate-600 cursor-pointer">
              Send receipt email to student & parents
            </label>
          </div>

          {error && (
            <p className="text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-600 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 h-11 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              {loading ? "Saving…" : "Record Payment"}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="h-11 px-4 border-2 border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-50 transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
