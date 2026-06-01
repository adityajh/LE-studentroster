"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DeletePaymentButtonProps {
  studentId: string
  paymentId: string
  amountLabel: string
}

export function DeletePaymentButton({ studentId, paymentId, amountLabel }: DeletePaymentButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/pay/${paymentId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to delete payment")
      }
      setOpen(false)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-black text-rose-500 hover:text-rose-700 transition-colors"
            title="Delete Payment"
          >
            <Trash2 className="h-3 w-3" />
            Delete
          </button>
        }
      />
      <DialogContent className="max-w-sm border-2 border-slate-100 shadow-2xl overflow-hidden">
        <DialogHeader className="p-0">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto sm:mx-0">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900">
            Delete Payment?
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500">
            Delete the payment of <strong className="text-slate-900">{amountLabel}</strong>?
            This permanently removes the receipt and re-runs the fee allocation. This cannot be undone.
          </DialogDescription>
        </DialogHeader>

        <div className="mt-4">
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Reason (optional)
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Duplicate entry"
            className="mt-1 w-full rounded-xl border-2 border-slate-100 px-3 py-2 text-sm font-medium text-slate-700 focus:border-slate-300 focus:outline-none"
          />
        </div>

        {error && (
          <p className="text-xs font-bold text-rose-600 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
            {error}
          </p>
        )}
        <DialogFooter className="mt-6 flex gap-2">
          <DialogClose
            render={
              <Button variant="outline" className="rounded-xl border-2 border-slate-100 font-bold text-slate-500 hover:bg-slate-50 transition-all">
                Cancel
              </Button>
            }
          />
          <Button
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-6 transition-all shadow-lg shadow-rose-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
