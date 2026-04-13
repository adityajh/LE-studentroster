"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Send, Check } from "lucide-react"

export function SendOfferButton({
  studentId,
  alreadySent,
}: {
  studentId: string
  alreadySent: boolean
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")
  const [showConfirm, setShowConfirm] = useState(false)

  async function handleSend() {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/send-offer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Failed to send")
      setSent(true)
      setShowConfirm(false)
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-semibold">
        <Check className="h-4 w-4" /> Offer email sent
      </div>
    )
  }

  return (
    <div className="relative">
      {showConfirm && (
        <div className="absolute right-0 top-full mt-1 z-10 bg-white border border-slate-200 rounded-xl shadow-lg p-4 w-64 space-y-3">
          <p className="text-sm font-semibold text-slate-800">Send Offer Email</p>
          <p className="text-xs text-slate-500">
            Sends the offer letter PDF (with fee breakdown appendix) to the student and parent.
          </p>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowConfirm(false)}
              className="flex-1 py-1.5 border border-slate-200 text-sm text-slate-600 rounded-lg hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSend} disabled={loading}
              className="flex-1 py-1.5 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60 flex items-center justify-center gap-1">
              {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
              Send
            </button>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowConfirm(!showConfirm)}
        className="flex items-center gap-1.5 h-9 px-4 rounded-xl border-2 border-violet-200 text-violet-700 text-sm font-bold hover:bg-violet-50 transition-all shrink-0"
      >
        <Send className="h-3.5 w-3.5" />
        {alreadySent ? "Resend Offer" : "Send Offer Email"}
      </button>
    </div>
  )
}
