"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, ChevronLeft, ChevronRight, Plus, Trash2 } from "lucide-react"
import { formatINR } from "@/lib/fee-schedule"
import { cn } from "@/lib/utils"

const PAYMENT_MODES = ["UPI", "NEFT", "RTGS", "CHEQUE", "CASH", "OTHER"] as const

const YEAR_OPTIONS = [
  { value: "0",    year: 0, label: "Registration Fee" },
  { value: "1",    year: 1, label: "Year 1 — Growth" },
  { value: "2",    year: 2, label: "Year 2 — Projects" },
  { value: "3",    year: 3, label: "Year 3 — Work" },
  { value: "full", year: 1, label: "Full Programme Fee" },
]

type OfferedOffer = { id: string; offerId: string; name: string; waiverAmount: number }
type OfferedScholarship = { id: string; scholarshipId: string; name: string; category: string; amount: number; spreadAcrossYears: boolean }
type BatchOffer = { id: string; name: string; type?: string; waiverAmount: number; deadline: string | null; conditions: unknown }
type BatchScholarship = { id: string; name: string; category: string; minAmount: number; maxAmount: number; spreadAcrossYears: boolean }
type CustomInstallment = { label: string; dueDate: string; amount: number; year: number; yearOption: string }
type Deduction = { description: string; amount: number }

export function ConfirmEnrolmentDialog({
  studentId,
  studentName,
  baseFee,
  registrationFee,
  year1Fee,
  year2Fee,
  year3Fee,
  batchYear,
  offeredOffers,
  offeredScholarships,
  allBatchOffers = [],
  allBatchScholarships = [],
}: {
  studentId: string
  studentName: string
  baseFee: number
  registrationFee: number
  year1Fee: number
  year2Fee: number
  year3Fee: number
  batchYear: number
  offeredOffers: OfferedOffer[]
  offeredScholarships: OfferedScholarship[]
  allBatchOffers?: BatchOffer[]
  allBatchScholarships?: BatchScholarship[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(1) // 1: Benefits, 2: Payment Plan, 3: Registration, 4: Review
  const [done, setDone] = useState<{ rollNo: string } | null>(null)

  // Use fee-schedule offers as the source of truth; fall back to offered offers if no fee schedule attached
  const offerSource: BatchOffer[] = allBatchOffers.length > 0
    ? allBatchOffers
    : offeredOffers.map((o) => ({ id: o.offerId, name: o.name, waiverAmount: o.waiverAmount, deadline: null, conditions: null }))

  // Use fee-schedule scholarships as source; fall back to offered scholarships if none
  const scholarshipSource: BatchScholarship[] = allBatchScholarships.length > 0
    ? allBatchScholarships
    : offeredScholarships.map((s) => ({ id: s.scholarshipId, name: s.name, category: s.category, minAmount: s.amount, maxAmount: s.amount, spreadAcrossYears: s.spreadAcrossYears }))

  const todayDate = new Date()
  todayDate.setHours(0, 0, 0, 0)
  const isOfferValid = (o: BatchOffer) => o.deadline === null || new Date(o.deadline) >= todayDate

  // Default checked = only EARLY_BIRD and ACCEPTANCE_7DAY offers (if valid / deadline not passed).
  // All other offer types (FULL_PAYMENT, FIRST_N_REGISTRATIONS, REFERRAL) start unchecked.
  const AUTO_CHECK_TYPES = new Set(["EARLY_BIRD", "ACCEPTANCE_7DAY"])
  const defaultCheckedOfferIds = (): string[] => {
    if (allBatchOffers.length > 0) {
      return allBatchOffers
        .filter((o) => isOfferValid(o) && (!o.type || AUTO_CHECK_TYPES.has(o.type)))
        .map((o) => o.id)
    }
    return []
  }

  // Step 1 — confirmed benefits
  const [confirmedOfferIds, setConfirmedOfferIds] = useState<string[]>(defaultCheckedOfferIds)
  const [confirmedScholarships, setConfirmedScholarships] = useState<{ scholarshipId: string; name: string; amount: number; spreadAcrossYears: boolean }[]>(
    offeredScholarships.map((s) => ({ scholarshipId: s.scholarshipId, name: s.name, amount: s.amount, spreadAcrossYears: s.spreadAcrossYears }))
  )
  const [deductions, setDeductions] = useState<Deduction[]>([])

  // Step 2 — payment plan
  const [installmentType, setInstallmentType] = useState<"ANNUAL" | "ONE_TIME" | "CUSTOM">("ANNUAL")
  const today = new Date().toISOString().split("T")[0]
  const y1Due = `${batchYear}-08-07`
  const y2Due = `${batchYear + 1}-05-15`
  const y3Due = `${batchYear + 2}-05-15`
  const [customInstallments, setCustomInstallments] = useState<CustomInstallment[]>([
    { label: "Registration Fee", dueDate: today, amount: registrationFee, year: 0, yearOption: "0" },
    { label: "Year 1 — Growth", dueDate: y1Due, amount: year1Fee, year: 1, yearOption: "1" },
    { label: "Year 2 — Projects", dueDate: y2Due, amount: year2Fee, year: 2, yearOption: "2" },
    { label: "Year 3 — Work", dueDate: y3Due, amount: year3Fee, year: 3, yearOption: "3" },
  ])

  // Step 3 — registration payment
  const [amount, setAmount] = useState(String(registrationFee))
  const [date, setDate] = useState(today)
  const [paymentMode, setPaymentMode] = useState<typeof PAYMENT_MODES[number]>("UPI")
  const [referenceNo, setReferenceNo] = useState("")
  const [payerName, setPayerName] = useState("")

  // ── Fee calculations ──────────────────────────────────────────────────────

  const confirmedOfferWaiver = offerSource
    .filter((o) => confirmedOfferIds.includes(o.id))
    .reduce((s, o) => s + o.waiverAmount, 0)
  const confirmedScholarshipWaiver = confirmedScholarships.reduce((s, sc) => s + sc.amount, 0)
  const confirmedDeductionTotal = deductions.reduce((s, d) => s + d.amount, 0)
  const totalWaiver = confirmedOfferWaiver + confirmedScholarshipWaiver
  const netFee = Math.max(0, baseFee - totalWaiver - confirmedDeductionTotal)

  const schedule = useMemo(() => {
    // Per-year spread: scholarships that spread divided by 3; one-time offers + non-spread scholarships only in Y1
    const spreadWaiver = confirmedScholarships
      .filter((s) => s.spreadAcrossYears)
      .reduce((sum, s) => sum + s.amount, 0)
    const nonSpreadScholarshipWaiver = confirmedScholarships
      .filter((s) => !s.spreadAcrossYears)
      .reduce((sum, s) => sum + s.amount, 0)
    const onetimeOfferWaiver = offerSource
      .filter((o) => confirmedOfferIds.includes(o.id))
      .reduce((sum, o) => sum + o.waiverAmount, 0)
    const spreadPerYear = Math.round(spreadWaiver / 3)

    const y1Net = Math.max(0, Math.round(year1Fee - spreadPerYear - onetimeOfferWaiver - nonSpreadScholarshipWaiver - confirmedDeductionTotal))
    const y2Net = Math.max(0, Math.round(year2Fee - spreadPerYear))
    const y3Net = Math.max(0, Math.round(year3Fee - spreadPerYear))

    if (installmentType === "ANNUAL") {
      return [
        { label: "Registration Fee", amount: registrationFee, due: "Today", year: 0 },
        { label: "Year 1 — Growth", amount: y1Net, due: `Aug 7, ${batchYear}`, year: 1 },
        { label: "Year 2 — Projects", amount: y2Net, due: `May 15, ${batchYear + 1}`, year: 2 },
        { label: "Year 3 — Work", amount: y3Net, due: `May 15, ${batchYear + 2}`, year: 3 },
      ]
    }
    if (installmentType === "ONE_TIME") {
      return [
        { label: "Registration Fee", amount: registrationFee, due: "Today", year: 0 },
        { label: "Full Programme Fee (3 Years)", amount: Math.max(0, baseFee - totalWaiver - confirmedDeductionTotal), due: "Within 30 days", year: 1 },
      ]
    }
    return customInstallments.map((i) => ({ label: i.label, amount: i.amount, due: i.dueDate, year: i.year }))
  }, [installmentType, confirmedOfferIds, confirmedScholarships, deductions, customInstallments,
      year1Fee, year2Fee, year3Fee, registrationFee, baseFee, batchYear,
      offerSource, totalWaiver, confirmedDeductionTotal])

  // ── Custom schedule helpers ───────────────────────────────────────────────

  const updateCustom = (index: number, field: string, value: string | number) => {
    setCustomInstallments((prev) => prev.map((inst, i) => {
      if (i !== index) return inst
      if (field === "yearOption") {
        const opt = YEAR_OPTIONS.find((o) => o.value === value)!
        return { ...inst, yearOption: opt.value, year: opt.year, label: opt.label }
      }
      return { ...inst, [field]: value }
    }))
  }

  const addCustomRow = () => setCustomInstallments((prev) => [
    ...prev,
    { label: "Year 1 — Growth", dueDate: today, amount: 0, year: 1, yearOption: "1" },
  ])

  const removeCustomRow = (index: number) => {
    if (index === 0) return
    setCustomInstallments((prev) => prev.filter((_, i) => i !== index))
  }

  const customTotal = customInstallments.reduce((s, i) => s + i.amount, 0)

  // ── Deduction helpers ─────────────────────────────────────────────────────

  const addDeduction = () => setDeductions((prev) => [...prev, { description: "", amount: 0 }])
  const removeDeduction = (i: number) => setDeductions((prev) => prev.filter((_, j) => j !== i))
  const updateDeduction = (i: number, field: keyof Deduction, value: string | number) =>
    setDeductions((prev) => prev.map((d, j) => j === i ? { ...d, [field]: value } : d))

  // ── Submit ────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!amount || !date || !paymentMode) { setError("Amount, date, and mode are required."); return }
    if (installmentType === "CUSTOM") {
      const expected = netFee + registrationFee
      if (customTotal === 0) { setError("Custom schedule total cannot be zero."); return }
      if (Math.abs(customTotal - expected) >= 1) {
        setError(`Custom installments must total ${formatINR(expected)} (Net Fee + Registration). Currently ${formatINR(customTotal)} — adjust the rows before confirming.`)
        return
      }
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/confirm-enrolment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          // Benefits confirmed
          offerIds: confirmedOfferIds,
          scholarships: confirmedScholarships.map((s) => ({ scholarshipId: s.scholarshipId, amount: s.amount })),
          deductions: deductions.filter((d) => d.description && d.amount > 0),
          // Payment plan
          installmentType,
          customInstallments: installmentType === "CUSTOM" ? customInstallments : undefined,
          // Registration payment
          amount: Number(amount),
          date,
          paymentMode,
          referenceNo: referenceNo || null,
          payerName: payerName || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const data = await res.json()
      setDone({ rollNo: data.rollNo })
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  function handleOpen() {
    // Reset to latest data each time dialog opens
    setConfirmedOfferIds(defaultCheckedOfferIds())
    setConfirmedScholarships(offeredScholarships.map((s) => ({ scholarshipId: s.scholarshipId, name: s.name, amount: s.amount, spreadAcrossYears: s.spreadAcrossYears })))
    setDeductions([])
    setInstallmentType("ANNUAL")
    setAmount(String(registrationFee))
    setDate(today)
    setPaymentMode("UPI")
    setReferenceNo("")
    setPayerName("")
    setStep(1)
    setError("")
    setDone(null)
    setOpen(true)
  }

  const STEPS = ["Benefits", "Payment Plan", "Registration", "Review"]

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
        className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-all shrink-0"
      >
        <CheckCircle2 className="h-4 w-4" />
        Confirm Enrolment
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="p-6 space-y-5">
              {done ? (
                /* ── Success ── */
                <div className="text-center space-y-4 py-4">
                  <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
                  <h2 className="text-xl font-extrabold text-slate-900">{studentName} is now enrolled!</h2>
                  <p className="text-sm text-slate-600">Roll number assigned: <strong className="font-mono">{done.rollNo}</strong></p>
                  <p className="text-xs text-slate-400">Head to the student profile to start the onboarding process.</p>
                  <button type="button" onClick={() => { setOpen(false); setDone(null) }}
                    className="w-full py-2 bg-slate-900 text-white rounded-xl text-sm font-bold hover:bg-slate-700">
                    Close
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Step indicator ── */}
                  <div>
                    <h2 className="text-lg font-extrabold text-slate-900 mb-4">Confirm Enrolment</h2>
                    <div className="flex items-center gap-1.5">
                      {STEPS.map((label, i) => {
                        const n = i + 1
                        return (
                          <div key={n} className="flex items-center gap-1.5">
                            <div className={cn(
                              "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border-2",
                              step === n ? "bg-emerald-600 border-emerald-600 text-white" :
                              step > n  ? "bg-emerald-400 border-emerald-400 text-white" :
                                          "bg-white border-slate-300 text-slate-400"
                            )}>{step > n ? "✓" : n}</div>
                            <span className={cn("text-[10px] font-medium", step === n ? "text-slate-800" : "text-slate-400")}>{label}</span>
                            {i < STEPS.length - 1 && <div className="w-5 h-px bg-slate-200" />}
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  {/* ── Step 1: Benefits ── */}
                  {step === 1 && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Confirm which offered benefits the student is claiming. Uncheck any that don&apos;t apply.</p>

                      {offerSource.length === 0 && scholarshipSource.length === 0 ? (
                        <p className="text-xs text-slate-400 italic">No offers or scholarships in the fee schedule for this batch.</p>
                      ) : (
                        <div className="space-y-4">
                          {/* ── Offers ── */}
                          {offerSource.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-2">Offers</p>
                              <div className="space-y-2">
                                {offerSource.map((o) => {
                                  const valid = isOfferValid(o)
                                  const checked = confirmedOfferIds.includes(o.id)
                                  const deadlineLabel = o.deadline
                                    ? new Date(o.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                                    : null
                                  return (
                                    <label key={o.id} className={cn(
                                      "flex items-center gap-3 p-3 rounded-lg border",
                                      !valid ? "border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed" :
                                      checked ? "border-emerald-400 bg-emerald-50 cursor-pointer" : "border-slate-200 cursor-pointer"
                                    )}>
                                      <input type="checkbox"
                                        disabled={!valid}
                                        checked={checked}
                                        onChange={() => {
                                          if (!valid) return
                                          setConfirmedOfferIds((prev) =>
                                            prev.includes(o.id) ? prev.filter((x) => x !== o.id) : [...prev, o.id]
                                          )
                                        }}
                                        className="rounded border-slate-300"
                                      />
                                      <span className="flex-1 text-sm">{o.name}</span>
                                      {!valid && deadlineLabel && (
                                        <span className="text-[10px] text-slate-400 bg-slate-100 border border-slate-200 rounded px-1.5 py-0.5 mr-1">
                                          Expired {deadlineLabel}
                                        </span>
                                      )}
                                      {valid && deadlineLabel && (
                                        <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mr-1">
                                          Until {deadlineLabel}
                                        </span>
                                      )}
                                      <span className={cn("text-sm font-semibold", valid ? "text-emerald-600" : "text-slate-400")}>
                                        - {formatINR(o.waiverAmount)}
                                      </span>
                                    </label>
                                  )
                                })}
                              </div>
                            </div>
                          )}

                          {/* ── Scholarships ── */}
                          {scholarshipSource.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold text-slate-600 mb-2">Scholarships</p>
                              <div className="space-y-2">
                                {scholarshipSource.map((s) => {
                                  const confirmed = confirmedScholarships.find((cs) => cs.scholarshipId === s.id)
                                  const isChecked = !!confirmed
                                  return (
                                    <div key={s.id} className={cn(
                                      "flex items-center gap-3 p-3 rounded-lg border",
                                      isChecked ? "border-emerald-400 bg-emerald-50" : "border-slate-200"
                                    )}>
                                      <input type="checkbox"
                                        checked={isChecked}
                                        onChange={() => setConfirmedScholarships((prev) =>
                                          prev.some((cs) => cs.scholarshipId === s.id)
                                            ? prev.filter((cs) => cs.scholarshipId !== s.id)
                                            : [...prev, { scholarshipId: s.id, name: s.name, amount: s.maxAmount, spreadAcrossYears: s.spreadAcrossYears }]
                                        )}
                                        className="rounded border-slate-300 cursor-pointer"
                                      />
                                      <span className="flex-1 text-sm">{s.name}</span>
                                      {isChecked && (
                                        <div className="flex items-center gap-1.5">
                                          <span className="text-xs text-slate-400">₹</span>
                                          <input
                                            type="number"
                                            min={s.minAmount}
                                            max={s.maxAmount}
                                            className="w-24 border border-slate-200 rounded px-2 py-1 text-xs text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                            value={confirmed!.amount}
                                            onChange={(e) => setConfirmedScholarships((prev) =>
                                              prev.map((cs) => cs.scholarshipId === s.id
                                                ? { ...cs, amount: Math.min(s.maxAmount, Math.max(0, Number(e.target.value))) }
                                                : cs
                                              )
                                            )}
                                          />
                                          <span className="text-[10px] text-slate-400">max {formatINR(s.maxAmount)}</span>
                                        </div>
                                      )}
                                      {!isChecked && (
                                        <span className="text-sm font-semibold text-slate-400">up to {formatINR(s.maxAmount)}</span>
                                      )}
                                    </div>
                                  )
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Deductions */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-semibold text-slate-600">One-off Deductions</p>
                          <button type="button" onClick={addDeduction}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800">
                            <Plus className="w-3 h-3" /> Add
                          </button>
                        </div>
                        {deductions.length === 0 && (
                          <p className="text-xs text-slate-400 italic">None added.</p>
                        )}
                        {deductions.map((d, i) => (
                          <div key={i} className="flex gap-2 mb-2">
                            <input className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              placeholder="Description" value={d.description}
                              onChange={(e) => updateDeduction(i, "description", e.target.value)} />
                            <input type="number" className="w-28 border border-slate-200 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                              placeholder="Amount" value={d.amount || ""}
                              onChange={(e) => updateDeduction(i, "amount", Number(e.target.value))} />
                            <button type="button" onClick={() => removeDeduction(i)} className="text-slate-400 hover:text-rose-500">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        ))}
                      </div>

                      {/* Fee summary */}
                      <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
                        <div className="flex justify-between text-sm"><span className="text-slate-500">Programme Fee</span><span>{formatINR(baseFee + registrationFee)}</span></div>
                        {totalWaiver > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Confirmed Benefits</span><span>- {formatINR(totalWaiver)}</span></div>}
                        {confirmedDeductionTotal > 0 && <div className="flex justify-between text-sm text-slate-600"><span>Deductions</span><span>- {formatINR(confirmedDeductionTotal)}</span></div>}
                        <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2"><span>Net Fee</span><span>{formatINR(netFee + registrationFee)}</span></div>
                      </div>
                    </div>
                  )}

                  {/* ── Step 2: Payment Plan ── */}
                  {step === 2 && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Choose how the student will pay the programme fee.</p>

                      <div className="grid grid-cols-3 gap-3">
                        {(["ANNUAL", "ONE_TIME", "CUSTOM"] as const).map((t) => (
                          <button type="button" key={t} onClick={() => {
                            setInstallmentType(t)
                            // Pre-populate custom amounts with waiver-applied values when switching to CUSTOM
                            if (t === "CUSTOM") {
                              const spreadW = confirmedScholarships.filter((s) => s.spreadAcrossYears).reduce((s, sc) => s + sc.amount, 0)
                              const nonSpreadW = confirmedScholarships.filter((s) => !s.spreadAcrossYears).reduce((s, sc) => s + sc.amount, 0)
                              const offerW = offerSource.filter((o) => confirmedOfferIds.includes(o.id)).reduce((s, o) => s + o.waiverAmount, 0)
                              const spd = Math.round(spreadW / 3)
                              setCustomInstallments([
                                { label: "Registration Fee", dueDate: today, amount: registrationFee, year: 0, yearOption: "0" },
                                { label: "Year 1 — Growth", dueDate: y1Due, amount: Math.max(0, Math.round(year1Fee - spd - offerW - nonSpreadW - confirmedDeductionTotal)), year: 1, yearOption: "1" },
                                { label: "Year 2 — Projects", dueDate: y2Due, amount: Math.max(0, Math.round(year2Fee - spd)), year: 2, yearOption: "2" },
                                { label: "Year 3 — Work", dueDate: y3Due, amount: Math.max(0, Math.round(year3Fee - spd)), year: 3, yearOption: "3" },
                              ])
                            }
                          }}
                            className={cn(
                              "p-3 rounded-lg border text-sm font-medium text-left",
                              installmentType === t ? "border-emerald-500 bg-emerald-50 text-emerald-800" : "border-slate-200 text-slate-600 hover:border-slate-300"
                            )}>
                            {t === "ANNUAL" ? "Annual (3 payments)" : t === "ONE_TIME" ? "One-Time (full)" : "Custom schedule"}
                          </button>
                        ))}
                      </div>

                      {installmentType === "CUSTOM" && (
                        <div className="space-y-2">
                          <p className="text-xs font-semibold text-slate-600 mb-2">Custom Schedule</p>
                          {customInstallments.map((inst, i) => (
                            <div key={i} className="border border-slate-200 rounded-lg p-2.5 space-y-2">
                              <div className="flex gap-2 items-center">
                                <input className="flex-1 border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400"
                                  placeholder="Label"
                                  value={inst.label}
                                  onChange={(e) => updateCustom(i, "label", e.target.value)} />
                                <select className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 w-32"
                                  value={inst.yearOption}
                                  onChange={(e) => updateCustom(i, "yearOption", e.target.value)}>
                                  {YEAR_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                                </select>
                                <button type="button" onClick={() => removeCustomRow(i)} disabled={i === 0}
                                  className="text-slate-300 hover:text-rose-500 disabled:cursor-not-allowed shrink-0">
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                              <div className="flex gap-2 items-center">
                                <input type="date" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 flex-1"
                                  value={inst.dueDate} onChange={(e) => updateCustom(i, "dueDate", e.target.value)} />
                                <input type="number" className="border border-slate-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 w-32"
                                  placeholder="Amount (₹)" value={inst.amount || ""}
                                  onChange={(e) => updateCustom(i, "amount", Number(e.target.value))} />
                              </div>
                            </div>
                          ))}
                          <button type="button" onClick={addCustomRow}
                            className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 mt-1">
                            <Plus className="w-3 h-3" /> Add row
                          </button>
                          <div className="flex justify-between text-xs font-bold text-slate-700 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 mt-2">
                            <span>Total</span>
                            <span className={cn(customTotal !== netFee + registrationFee ? "text-amber-600" : "text-emerald-700")}>
                              {formatINR(customTotal)}
                            </span>
                          </div>
                        </div>
                      )}

                      {installmentType !== "CUSTOM" && (
                        <div className="rounded-lg bg-slate-50 border border-slate-200 divide-y divide-slate-100">
                          {schedule.map((row, i) => (
                            <div key={i} className="flex justify-between px-3 py-2 text-sm">
                              <span className="text-slate-600">{row.label}</span>
                              <span className="font-medium">{formatINR(row.amount)}</span>
                            </div>
                          ))}
                          <div className="flex justify-between px-3 py-2 text-sm font-bold bg-slate-100">
                            <span className="text-slate-700">Total</span>
                            <span>{formatINR(schedule.reduce((s, r) => s + r.amount, 0))}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ── Step 3: Registration Payment ── */}
                  {step === 3 && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">
                        Record the registration payment to officially enrol <strong>{studentName}</strong>.
                        A roll number will be assigned automatically.
                      </p>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (₹) *</label>
                          <input type="number" min={0}
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                            value={amount} onChange={(e) => setAmount(e.target.value)} />
                        </div>
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                          <input type="date"
                            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
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
                    </div>
                  )}

                  {/* ── Step 4: Review ── */}
                  {step === 4 && (
                    <div className="space-y-4">
                      <p className="text-sm text-slate-500">Review everything before confirming.</p>
                      <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                        <div className="px-4 py-3 flex justify-between"><span className="text-slate-500">Student</span><span className="font-medium">{studentName}</span></div>
                        <div className="px-4 py-3 flex justify-between"><span className="text-slate-500">Net Programme Fee</span><span className="font-bold">{formatINR(netFee)}</span></div>
                        <div className="px-4 py-3 flex justify-between"><span className="text-slate-500">Payment Plan</span><span className="font-medium">{installmentType === "ANNUAL" ? "Annual (3 payments)" : installmentType === "ONE_TIME" ? "One-Time" : "Custom"}</span></div>
                        <div className="px-4 py-3 flex justify-between"><span className="text-slate-500">Registration Paid</span><span className="font-medium">{formatINR(Number(amount))} · {paymentMode}{referenceNo ? ` · ${referenceNo}` : ""}</span></div>
                        <div className="px-4 py-3 flex justify-between"><span className="text-slate-500">Payment Date</span><span className="font-medium">{date}</span></div>
                      </div>

                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-2">Installment Schedule</p>
                        <div className="rounded-lg border border-slate-200 divide-y divide-slate-100 text-sm">
                          {schedule.map((row, i) => (
                            <div key={i} className="flex justify-between px-3 py-2">
                              <span className="text-slate-600">{row.label}</span>
                              <span className="font-medium">{formatINR(row.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <p className="text-xs text-slate-400 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
                        A roll number will be assigned and the financial record will be locked after confirming.
                        The onboarding process starts from the student profile.
                      </p>
                    </div>
                  )}

                  {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

                  {/* ── Navigation ── */}
                  <div className="flex gap-2 pt-1">
                    {step > 1 ? (
                      <button type="button" onClick={() => { setError(""); setStep(step - 1) }}
                        className="flex items-center gap-1 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                        <ChevronLeft className="w-4 h-4" /> Back
                      </button>
                    ) : (
                      <button type="button" onClick={() => { setOpen(false); setError("") }}
                        className="px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
                        Cancel
                      </button>
                    )}
                    {step < 4 ? (
                      <button type="button" onClick={() => { setError(""); setStep(step + 1) }}
                        className="flex-1 flex items-center justify-center gap-1 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700">
                        Next <ChevronRight className="w-4 h-4" />
                      </button>
                    ) : (
                      <button type="button" onClick={handleConfirm} disabled={loading}
                        className="flex-1 flex items-center justify-center gap-1.5 py-2 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60">
                        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Confirm & Enrol
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
