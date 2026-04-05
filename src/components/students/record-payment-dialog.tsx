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
  installment: {
    id: string
    label: string
    amount: { toString(): string }
  }
}

export function RecordPaymentDialog({ studentId, installment }: Props) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const maxAmount = parseFloat(installment.amount.toString())
  const [paidAmount, setPaidAmount] = useState(maxAmount)
  const balance = Math.max(0, maxAmount - paidAmount)
  const isPartial = paidAmount > 0 && paidAmount < maxAmount
  const [paidDate, setPaidDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMethod, setPaymentMethod] = useState("Bank Transfer")
  const [notes, setNotes] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: installment.id,
          paidAmount,
          paidDate,
          paymentMethod,
          notes,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to record payment")
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
          <button className="text-xs font-bold text-indigo-600 hover:text-indigo-800 transition-colors px-3 py-1.5 rounded-lg border border-indigo-200 hover:bg-indigo-50" />
        }
      >
        Record Payment
      </DialogTrigger>
      <DialogContent className="max-w-md rounded-2xl border-slate-200">
        <DialogHeader>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment</p>
          <DialogTitle className="text-lg font-extrabold text-slate-900">
            {installment.label}
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
                max={maxAmount}
                min={1}
                required
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white pl-8 pr-4 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </div>
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
                Method
              </label>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value)}
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option>Bank Transfer</option>
                <option>UPI</option>
                <option>Cheque</option>
                <option>Cash</option>
                <option>Card</option>
              </select>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
              Notes (optional)
            </label>
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Transaction ID, reference, etc."
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
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
