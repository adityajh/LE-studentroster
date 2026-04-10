"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2 } from "lucide-react"

const PAYMENT_MODES = ["UPI", "NEFT", "RTGS", "CHEQUE", "CASH", "OTHER"] as const

export function ConfirmEnrolmentDialog({
  studentId,
  studentName,
}: {
  studentId: string
  studentName: string
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState<{ rollNo: string; onboardingEmailSent: boolean } | null>(null)

  const [amount, setAmount] = useState("50000")
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>("UPI")
  const [referenceNo, setReferenceNo] = useState("")
  const [payerName, setPayerName] = useState("")
  const [sendOnboarding, setSendOnboarding] = useState(true)

  async function handleConfirm() {
    if (!amount || !date || !paymentMode) { setError("Amount, date, and mode are required."); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/confirm-enrolment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount),
          date,
          paymentMode,
          referenceNo: referenceNo || null,
          payerName: payerName || null,
          sendOnboarding,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const data = await res.json()
      setDone({ rollNo: data.rollNo, onboardingEmailSent: data.onboardingEmailSent })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shrink-0"
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirm Enrolment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-5">
            {done ? (
              <div className="text-center space-y-4">
                <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                <h2 className="text-xl font-extrabold text-slate-900">{studentName} is now enrolled!</h2>
                <p className="text-sm text-slate-600">Roll number assigned: <strong className="font-mono">{done.rollNo}</strong></p>
                {done.onboardingEmailSent && <p className="text-xs text-emerald-600">Onboarding email sent.</p>}
                {!done.onboardingEmailSent && sendOnboarding && <p className="text-xs text-amber-600">Onboarding email could not be sent — check SMTP settings.</p>}
                <button onClick={() => { setOpen(false); setDone(null) }}
                  className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700">
                  Close
                </button>
              </div>
            ) : (
              <>
                <div>
                  <h2 className="text-lg font-extrabold text-slate-900">Confirm Enrolment</h2>
                  <p className="text-sm text-slate-500 mt-1">
                    Record the ₹50,000 registration payment to officially enrol <strong>{studentName}</strong>.
                    A roll number will be assigned automatically.
                  </p>
                </div>

                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                      <input type="number" min={0} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={amount} onChange={(e) => setAmount(e.target.value)} />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                      <input type="date" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={date} onChange={(e) => setDate(e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Payment Mode *</label>
                      <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={paymentMode} onChange={(e) => setPaymentMode(e.target.value as typeof PAYMENT_MODES[number])}>
                        {PAYMENT_MODES.map((m) => <option key={m} value={m}>{m}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-600 mb-1">Reference No.</label>
                      <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} placeholder="UTR / Cheque no." />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Payer Name</label>
                    <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      value={payerName} onChange={(e) => setPayerName(e.target.value)} placeholder="Student / parent name" />
                  </div>
                  <label className="flex items-center gap-2 text-sm cursor-pointer">
                    <input type="checkbox" checked={sendOnboarding} onChange={(e) => setSendOnboarding(e.target.checked)}
                      className="rounded border-slate-300" />
                    <span className="text-slate-700">Send onboarding email after confirming</span>
                  </label>
                </div>

                {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

                <div className="flex gap-2 pt-1">
                  <button onClick={() => { setOpen(false); setError("") }}
                    className="flex-1 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                    Cancel
                  </button>
                  <button onClick={handleConfirm} disabled={loading}
                    className="flex-1 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60 flex items-center justify-center gap-1.5">
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Confirm & Enrol
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
