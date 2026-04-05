"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronDown } from "lucide-react"
import { formatINR } from "@/lib/fee-schedule"

type Batch = {
  id: string
  year: number
  programs: Program[]
  feeSchedule: FeeSchedule | null
}

type Program = {
  id: string
  name: string
  totalFee: { toString(): string }
  registrationFee: { toString(): string }
  year1Fee: { toString(): string }
  year2Fee: { toString(): string }
  year3Fee: { toString(): string }
}

type FeeSchedule = {
  offers: Offer[]
  scholarships: Scholarship[]
}

type Offer = {
  id: string
  name: string
  type: string
  waiverAmount: { toString(): string }
  deadline: Date | null
}

type Scholarship = {
  id: string
  name: string
  category: string
  minAmount: { toString(): string }
  maxAmount: { toString(): string }
}

type CustomInstallment = {
  label: string
  dueDate: string   // YYYY-MM-DD
  amount: number
  year: number
}

export function EnrollForm({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Form state
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "")
  const [programId, setProgramId] = useState("")
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [contact, setContact] = useState("")
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([])
  const [scholarshipA, setScholarshipA] = useState<{ id: string; amount: number } | null>(null)
  const [scholarshipB, setScholarshipB] = useState<{ id: string; amount: number } | null>(null)
  const [installmentType, setInstallmentType] = useState<"ANNUAL" | "ONE_TIME" | "CUSTOM">("ANNUAL")

  // Custom schedule state
  const [customInstallments, setCustomInstallments] = useState<CustomInstallment[]>([])

  // Derived data
  const selectedBatch = batches.find((b) => b.id === batchId)
  const programs = selectedBatch?.programs ?? []
  const feeSchedule = selectedBatch?.feeSchedule
  const offers = feeSchedule?.offers ?? []
  const scholarshipsA = feeSchedule?.scholarships.filter((s) => s.category === "A") ?? []
  const scholarshipsB = feeSchedule?.scholarships.filter((s) => s.category === "B") ?? []
  const selectedProgram = programs.find((p) => p.id === programId)

  // Fee calculation
  const fees = useMemo(() => {
    if (!selectedProgram) return null
    const baseFee = parseFloat(selectedProgram.totalFee.toString())
    const reg = parseFloat(selectedProgram.registrationFee.toString())
    const y1 = parseFloat(selectedProgram.year1Fee.toString())
    const y2 = parseFloat(selectedProgram.year2Fee.toString())
    const y3 = parseFloat(selectedProgram.year3Fee.toString())

    const offerWaiver = offers
      .filter((o) => selectedOfferIds.includes(o.id))
      .reduce((sum, o) => sum + parseFloat(o.waiverAmount.toString()), 0)

    const schWaiver = (scholarshipA?.amount ?? 0) + (scholarshipB?.amount ?? 0)
    const totalWaiver = offerWaiver + schWaiver
    const netFee = baseFee - totalWaiver
    const waiverPerYear = totalWaiver / 3

    const bYear = selectedBatch!.year
    const today = new Date().toISOString().split("T")[0]
    const y1Due = `${bYear}-07-01`
    const y2Due = `${bYear + 1}-07-01`
    const y3Due = `${bYear + 2}-07-01`

    const annualSchedule = [
      {
        label: "Registration Fee",
        amount: reg,
        due: "Today",
        year: 0,
        breakdown: null,
      },
      {
        label: "Year 1 — Growth",
        amount: Math.max(0, y1 - waiverPerYear),
        due: `Jul 1, ${bYear}`,
        year: 1,
        breakdown: totalWaiver > 0 ? { yearFee: y1, waiverPerYear } : null,
      },
      {
        label: "Year 2 — Projects",
        amount: Math.max(0, y2 - waiverPerYear),
        due: `Jul 1, ${bYear + 1}`,
        year: 2,
        breakdown: totalWaiver > 0 ? { yearFee: y2, waiverPerYear } : null,
      },
      {
        label: "Year 3 — Work",
        amount: Math.max(0, y3 - waiverPerYear),
        due: `Jul 1, ${bYear + 2}`,
        year: 3,
        breakdown: totalWaiver > 0 ? { yearFee: y3, waiverPerYear } : null,
      },
    ]

    const oneTimeSchedule = [
      {
        label: "Registration Fee",
        amount: reg,
        due: "Today",
        year: 0,
        breakdown: null,
      },
      {
        label: "Full Programme Fee (3 Years)",
        amount: Math.max(0, y1 + y2 + y3 - totalWaiver),
        due: "Within 30 days",
        year: 1,
        breakdown: totalWaiver > 0 ? { yearFee: y1 + y2 + y3, waiverPerYear: totalWaiver } : null,
      },
    ]

    // Default custom schedule seeds from ANNUAL
    const defaultCustom: CustomInstallment[] = [
      { label: "Registration Fee", dueDate: today, amount: reg, year: 0 },
      { label: "Year 1 — Growth", dueDate: y1Due, amount: Math.max(0, y1 - waiverPerYear), year: 1 },
      { label: "Year 2 — Projects", dueDate: y2Due, amount: Math.max(0, y2 - waiverPerYear), year: 2 },
      { label: "Year 3 — Work", dueDate: y3Due, amount: Math.max(0, y3 - waiverPerYear), year: 3 },
    ]

    return {
      baseFee,
      totalWaiver,
      netFee,
      waiverPerYear,
      schedule: installmentType === "ANNUAL" ? annualSchedule : oneTimeSchedule,
      defaultCustom,
    }
  }, [selectedProgram, selectedOfferIds, scholarshipA, scholarshipB, installmentType, offers, selectedBatch])

  // Seed custom installments when switching to CUSTOM or when fees change
  useEffect(() => {
    if (installmentType === "CUSTOM" && fees && customInstallments.length === 0) {
      setCustomInstallments(fees.defaultCustom)
    }
  }, [installmentType, fees, customInstallments.length])

  // Reset custom installments when fees change (program/offers/scholarships change)
  useEffect(() => {
    if (installmentType === "CUSTOM" && fees) {
      setCustomInstallments(fees.defaultCustom)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgram, selectedOfferIds, scholarshipA, scholarshipB])

  const toggleOffer = (id: string) => {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const updateCustomInstallment = (index: number, field: "amount" | "dueDate" | "label", value: string | number) => {
    setCustomInstallments((prev) =>
      prev.map((inst, i) => i === index ? { ...inst, [field]: value } : inst)
    )
  }

  const addCustomInstallment = () => {
    setCustomInstallments((prev) => [
      ...prev,
      {
        label: `Installment ${prev.length}`,
        dueDate: new Date().toISOString().split("T")[0],
        amount: 0,
        year: prev.length,
      },
    ])
  }

  const removeCustomInstallment = (index: number) => {
    // Don't allow removing registration fee (index 0)
    if (index === 0) return
    setCustomInstallments((prev) => prev.filter((_, i) => i !== index))
  }

  const customTotal = customInstallments.reduce((s, i) => s + i.amount, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!programId) return setError("Please select a program")
    setLoading(true)
    setError("")

    const scholarships = []
    if (scholarshipA) scholarships.push({ scholarshipId: scholarshipA.id, amount: scholarshipA.amount })
    if (scholarshipB) scholarships.push({ scholarshipId: scholarshipB.id, amount: scholarshipB.amount })

    try {
      const res = await fetch("/api/students/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          contact,
          batchId,
          programId,
          offerIds: selectedOfferIds,
          scholarships,
          deductions: [],
          installmentType,
          customInstallments: installmentType === "CUSTOM" ? customInstallments : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Enrollment failed")
      router.push(`/students/${data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Section 1 — Basic Info */}
      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-3">
            Student Details
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Full Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder="Rahul Mehta"
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Contact Number</label>
            <input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              required
              placeholder="+91 98765 43210"
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Email Address</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="rahul@example.com"
              className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
          </div>
        </div>
      </div>

      {/* Section 2 — Batch & Program */}
      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Programme</p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Batch Year</label>
            <div className="relative">
              <select
                value={batchId}
                onChange={(e) => { setBatchId(e.target.value); setProgramId("") }}
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-800 appearance-none focus:border-indigo-500 focus:outline-none transition-all"
              >
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>Batch {b.year}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Program</label>
            <div className="relative">
              <select
                value={programId}
                onChange={(e) => setProgramId(e.target.value)}
                required
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-800 appearance-none focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Select program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} — {formatINR(parseFloat(p.totalFee.toString()))}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Section 3 — Offers & Scholarships (only if program selected) */}
      {selectedProgram && (
        <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Offers & Scholarships
          </p>

          {/* Offers */}
          {offers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Applicable Offers</p>
              <div className="space-y-2">
                {offers.map((offer) => (
                  <label
                    key={offer.id}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      selectedOfferIds.includes(offer.id)
                        ? "border-indigo-500 bg-indigo-50"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedOfferIds.includes(offer.id)}
                        onChange={() => toggleOffer(offer.id)}
                        className="w-4 h-4 accent-indigo-600"
                      />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{offer.name}</p>
                        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                          {offer.type.replace(/_/g, " ")}
                          {offer.deadline && ` · Deadline: ${new Date(offer.deadline).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}`}
                        </p>
                      </div>
                    </div>
                    <span className="text-sm font-extrabold text-emerald-600">
                      −{formatINR(parseFloat(offer.waiverAmount.toString()))}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Scholarship A */}
          {scholarshipsA.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Scholarship — Category A <span className="font-medium text-slate-400">(Merit-based, max 1)</span></p>
              <div className="space-y-2">
                {scholarshipsA.map((s) => {
                  const isSelected = scholarshipA?.id === s.id
                  const min = parseFloat(s.minAmount.toString())
                  const max = parseFloat(s.maxAmount.toString())
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="scholarshipA"
                          checked={isSelected}
                          onChange={() => setScholarshipA({ id: s.id, amount: min })}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`}
                          </p>
                        </div>
                        {isSelected && min !== max && (
                          <input
                            type="number"
                            min={min}
                            max={max}
                            value={scholarshipA?.amount ?? min}
                            onChange={(e) => setScholarshipA({ id: s.id, amount: parseFloat(e.target.value) || min })}
                            className="w-28 h-9 rounded-lg border-2 border-indigo-300 bg-white px-3 text-sm font-bold text-indigo-700 focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
                {scholarshipA && (
                  <button
                    type="button"
                    onClick={() => setScholarshipA(null)}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    Remove scholarship A
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scholarship B */}
          {scholarshipsB.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Scholarship — Category B <span className="font-medium text-slate-400">(Equity-based, max 1)</span></p>
              <div className="space-y-2">
                {scholarshipsB.map((s) => {
                  const isSelected = scholarshipB?.id === s.id
                  const min = parseFloat(s.minAmount.toString())
                  const max = parseFloat(s.maxAmount.toString())
                  return (
                    <div
                      key={s.id}
                      className={`p-3 rounded-xl border-2 transition-all ${
                        isSelected ? "border-indigo-500 bg-indigo-50" : "border-slate-200"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <input
                          type="radio"
                          name="scholarshipB"
                          checked={isSelected}
                          onChange={() => setScholarshipB({ id: s.id, amount: min })}
                          className="w-4 h-4 accent-indigo-600"
                        />
                        <div className="flex-1">
                          <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                          <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                            {min === max ? formatINR(min) : `${formatINR(min)} – ${formatINR(max)}`}
                          </p>
                        </div>
                        {isSelected && min !== max && (
                          <input
                            type="number"
                            min={min}
                            max={max}
                            value={scholarshipB?.amount ?? min}
                            onChange={(e) => setScholarshipB({ id: s.id, amount: parseFloat(e.target.value) || min })}
                            className="w-28 h-9 rounded-lg border-2 border-indigo-300 bg-white px-3 text-sm font-bold text-indigo-700 focus:outline-none"
                          />
                        )}
                      </div>
                    </div>
                  )
                })}
                {scholarshipB && (
                  <button
                    type="button"
                    onClick={() => setScholarshipB(null)}
                    className="text-xs font-medium text-slate-400 hover:text-slate-600"
                  >
                    Remove scholarship B
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Section 4 — Installment Type + Fee Preview */}
      {fees && (
        <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment Plan</p>

          {/* Plan type selector */}
          <div className="flex gap-2">
            {(["ANNUAL", "ONE_TIME", "CUSTOM"] as const).map((type) => (
              <button
                key={type}
                type="button"
                onClick={() => {
                  setInstallmentType(type)
                  if (type === "CUSTOM") setCustomInstallments(fees.defaultCustom)
                }}
                className={`flex-1 h-11 rounded-xl border-2 text-sm font-bold transition-all ${
                  installmentType === type
                    ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                    : "border-slate-200 text-slate-500 hover:border-slate-300"
                }`}
              >
                {type === "ANNUAL" ? "Annual" : type === "ONE_TIME" ? "One-Time" : "Custom"}
              </button>
            ))}
          </div>

          {/* Fee summary */}
          <div className="bg-slate-50 rounded-xl p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="font-medium text-slate-500">Base fee</span>
              <span className="font-bold text-slate-700">{formatINR(fees.baseFee)}</span>
            </div>
            {fees.totalWaiver > 0 && (
              <>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-slate-500">Total waiver</span>
                  <span className="font-bold text-emerald-600">−{formatINR(fees.totalWaiver)}</span>
                </div>
                {installmentType === "ANNUAL" && (
                  <div className="flex justify-between text-xs text-slate-400 pl-3">
                    <span>Spread equally across 3 years</span>
                    <span>−{formatINR(fees.waiverPerYear)} / year</span>
                  </div>
                )}
              </>
            )}
            <div className="flex justify-between border-t border-slate-200 pt-2">
              <span className="text-sm font-bold text-slate-700">Net fee</span>
              <span className="text-lg font-black text-indigo-600">{formatINR(fees.netFee)}</span>
            </div>
          </div>

          {/* ANNUAL / ONE_TIME schedule preview */}
          {installmentType !== "CUSTOM" && (
            <div className="space-y-1">
              <p className="text-xs font-bold text-slate-500">Installment Schedule</p>
              {fees.schedule.map((inst, i) => (
                <div key={i} className="py-2.5 border-b border-slate-100 last:border-0">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-700">{inst.label}</p>
                      <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400">{inst.due}</p>
                    </div>
                    <span className="text-sm font-extrabold text-slate-800">{formatINR(inst.amount)}</span>
                  </div>
                  {inst.breakdown && (
                    <p className="text-[10px] font-medium text-slate-400 mt-0.5 pl-0">
                      {formatINR(inst.breakdown.yearFee)}
                      {" − "}
                      <span className="text-emerald-600 font-bold">{formatINR(inst.breakdown.waiverPerYear)} waiver</span>
                      {" = "}
                      <span className="text-slate-600 font-bold">{formatINR(inst.amount)}</span>
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* CUSTOM schedule editor */}
          {installmentType === "CUSTOM" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-500">Custom Schedule</p>
                <span className={`text-xs font-bold ${Math.abs(customTotal - fees.netFee) < 1 ? "text-emerald-600" : "text-amber-600"}`}>
                  Total: {formatINR(customTotal)}
                  {Math.abs(customTotal - fees.netFee) >= 1 && ` · Net fee is ${formatINR(fees.netFee)}`}
                </span>
              </div>

              <div className="space-y-2">
                {customInstallments.map((inst, i) => (
                  <div key={i} className="rounded-xl border-2 border-slate-200 p-3 space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <input
                        value={inst.label}
                        onChange={(e) => updateCustomInstallment(i, "label", e.target.value)}
                        className="flex-1 text-sm font-semibold text-slate-800 bg-transparent border-0 focus:outline-none"
                      />
                      {i > 0 && (
                        <button
                          type="button"
                          onClick={() => removeCustomInstallment(i)}
                          className="text-[10px] font-bold text-slate-300 hover:text-rose-500 transition-colors"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <div className="flex-1 relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">₹</span>
                        <input
                          type="number"
                          min={0}
                          value={inst.amount}
                          onChange={(e) => updateCustomInstallment(i, "amount", parseFloat(e.target.value) || 0)}
                          className="w-full h-9 rounded-lg border-2 border-slate-200 bg-white pl-6 pr-3 text-sm font-bold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
                        />
                      </div>
                      <input
                        type="date"
                        value={inst.dueDate}
                        onChange={(e) => updateCustomInstallment(i, "dueDate", e.target.value)}
                        className="h-9 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addCustomInstallment}
                className="w-full h-10 rounded-xl border-2 border-dashed border-slate-300 text-sm font-semibold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all"
              >
                + Add installment
              </button>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={loading || !programId || !name || !email || !contact}
          className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Enrolling…" : "Enroll Student"}
        </button>
        <a href="/students" className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">
          Cancel
        </a>
      </div>
    </form>
  )
}
