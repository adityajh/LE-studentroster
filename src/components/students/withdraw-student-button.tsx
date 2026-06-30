"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { UserMinus, AlertTriangle, Loader2 } from "lucide-react"
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

interface WithdrawStudentButtonProps {
  studentId: string
  studentName: string
  /** Current status — drives the label: OFFERED → "Retract Offer", else "Withdraw". */
  status: string
}

export function WithdrawStudentButton({ studentId, studentName, status }: WithdrawStudentButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [reason, setReason] = useState("")
  const [open, setOpen] = useState(false)

  const isOffered = status === "OFFERED"
  const verb = isOffered ? "Retract Offer" : "Withdraw"

  const handleWithdraw = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "WITHDRAWN", changeReason: reason.trim() || undefined }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => null)
        throw new Error(d?.error ?? `Failed (HTTP ${res.status})`)
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
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-amber-200 text-sm font-bold text-amber-700 hover:border-amber-300 hover:bg-amber-50 transition-all shrink-0"
            title={verb}
          >
            <UserMinus className="h-3.5 w-3.5" />
            {verb}
          </button>
        }
      />
      <DialogContent className="max-w-sm border-2 border-slate-100 shadow-2xl overflow-hidden">
        <DialogHeader className="p-0">
          <div className="w-12 h-12 rounded-full bg-amber-100 flex items-center justify-center mb-4 mx-auto sm:mx-0">
            <AlertTriangle className="h-6 w-6 text-amber-600" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900">
            {isOffered ? "Retract this offer?" : "Withdraw this student?"}
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500">
            <strong className="text-slate-900">{studentName}</strong> will be marked{" "}
            <strong className="text-slate-900">WITHDRAWN</strong>. The record, roll number, and
            history are kept — nothing is deleted, and this can be reversed by changing the status
            back later.
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
            placeholder={isOffered ? "e.g. Candidate declined" : "e.g. Left the programme"}
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
              handleWithdraw()
            }}
            disabled={loading}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl px-6 transition-all shadow-lg shadow-amber-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : isOffered ? "Retract Offer" : "Withdraw"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
