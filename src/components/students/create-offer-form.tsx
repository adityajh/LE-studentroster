"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronRight, ChevronLeft } from "lucide-react"
import { formatINR } from "@/lib/fee-schedule"
import { cn } from "@/lib/utils"

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
  conditions: unknown
}
type Scholarship = {
  id: string
  name: string
  category: string
  minAmount: { toString(): string }
  maxAmount: { toString(): string }
}

export function CreateOfferForm({ batches }: { batches: Batch[] }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(1) // 1: Candidate, 2: Offer Details, 3: Review

  // Step 1 — candidate basics
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [contact, setContact] = useState("")
  const [city, setCity] = useState("")

  // Per-year fee overrides (admin only)
  const [feeOverrideReg, setFeeOverrideReg] = useState("")
  const [feeOverrideY1, setFeeOverrideY1] = useState("")
  const [feeOverrideY2, setFeeOverrideY2] = useState("")
  const [feeOverrideY3, setFeeOverrideY3] = useState("")

  // Step 2 — offer details
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "")
  const [programId, setProgramId] = useState("")
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([])
  const [scholarshipA, setScholarshipA] = useState<{ id: string; amount: number } | null>(null)
  const [scholarshipB, setScholarshipB] = useState<{ id: string; amount: number } | null>(null)

  const selectedBatch = batches.find((b) => b.id === batchId)
  const programs = selectedBatch?.programs ?? []
  const feeSchedule = selectedBatch?.feeSchedule
  const offers = feeSchedule?.offers ?? []
  const scholarshipsA = feeSchedule?.scholarships.filter((s) => s.category === "A") ?? []
  const scholarshipsB = feeSchedule?.scholarships.filter((s) => s.category === "B") ?? []
  const selectedProgram = programs.find((p) => p.id === programId)

  const fees = useMemo(() => {
    if (!selectedProgram) return null
    const baseY1 = parseFloat(selectedProgram.year1Fee.toString())
    const baseY2 = parseFloat(selectedProgram.year2Fee.toString())
    const baseY3 = parseFloat(selectedProgram.year3Fee.toString())
    const y1 = feeOverrideY1 !== "" ? Math.max(0, parseFloat(feeOverrideY1)) : baseY1
    const y2 = feeOverrideY2 !== "" ? Math.max(0, parseFloat(feeOverrideY2)) : baseY2
    const y3 = feeOverrideY3 !== "" ? Math.max(0, parseFloat(feeOverrideY3)) : baseY3
    const baseFee = y1 + y2 + y3

    const selectedOffers = offers.filter((o) => selectedOfferIds.includes(o.id))
    const totalOfferWaiver = selectedOffers.reduce((s, o) => s + parseFloat(o.waiverAmount.toString()), 0)
    const schWaiver = (scholarshipA?.amount ?? 0) + (scholarshipB?.amount ?? 0)
    const totalWaiver = totalOfferWaiver + schWaiver
    const netFee = Math.round(baseFee - totalWaiver)
    const hasOverride = feeOverrideReg !== "" || feeOverrideY1 !== "" || feeOverrideY2 !== "" || feeOverrideY3 !== ""
    return { baseFee, y1, y2, y3, hasOverride, totalWaiver, netFee }
  }, [selectedProgram, selectedOfferIds, scholarshipA, scholarshipB, offers, feeOverrideReg, feeOverrideY1, feeOverrideY2, feeOverrideY3])

  const toggleOffer = (id: string) =>
    setSelectedOfferIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])

  const name = [firstName, lastName].filter(Boolean).join(" ")

  async function handleSubmit() {
    if (!name || !email || !contact) { setError("Name, email, and phone are required."); return }
    if (!programId) { setError("Please select a program."); return }
    setLoading(true)
    setError("")
    try {
      const res = await fetch("/api/students/create-offer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName, lastName, name,
          email, contact, city,
          batchId, programId,
          offerIds: selectedOfferIds,
          scholarships: [
            ...(scholarshipA ? [{ scholarshipId: scholarshipA.id, amount: scholarshipA.amount }] : []),
            ...(scholarshipB ? [{ scholarshipId: scholarshipB.id, amount: scholarshipB.amount }] : []),
          ],
          feeY1: feeOverrideY1 !== "" ? parseFloat(feeOverrideY1) : undefined,
          feeY2: feeOverrideY2 !== "" ? parseFloat(feeOverrideY2) : undefined,
          feeY3: feeOverrideY3 !== "" ? parseFloat(feeOverrideY3) : undefined,
          registrationFee: feeOverrideReg !== "" ? parseFloat(feeOverrideReg) : undefined,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed") }
      const { id } = await res.json()
      router.push(`/students/${id}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-8">
      {/* Step indicators */}
      <div className="flex items-center gap-2">
        {[{ n: 1, label: "Candidate" }, { n: 2, label: "Offer Details" }, { n: 3, label: "Review" }].map(({ n, label }, i, arr) => (
          <div key={n} className="flex items-center gap-2">
            <div className={cn(
              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
              step === n ? "bg-violet-600 border-violet-600 text-white" :
              step > n  ? "bg-emerald-500 border-emerald-500 text-white" :
                          "bg-white border-slate-300 text-slate-400"
            )}>{step > n ? "✓" : n}</div>
            <span className={cn("text-xs font-medium", step === n ? "text-slate-900" : "text-slate-400")}>{label}</span>
            {i < arr.length - 1 && <div className="w-8 h-px bg-slate-200" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Candidate basics ─────────────────────────────── */}
      {step === 1 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-slate-800">Candidate Details</h2>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">First Name *</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Priya" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Last Name *</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Sharma" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1">Email Address *</label>
            <input type="email" className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="priya@example.com" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Phone *</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={contact} onChange={(e) => setContact(e.target.value)} placeholder="+91 98765 43210" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">City</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={city} onChange={(e) => setCity(e.target.value)} placeholder="Pune" />
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => {
                if (!firstName || !email || !contact) { setError("First name, email, and phone are required."); return }
                setError(""); setStep(2)
              }}
              className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700"
            >
              Next: Offer Details <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Offer details ─────────────────────────────────── */}
      {step === 2 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-slate-800">Offer Details</h2>

          {/* Batch + Program */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Batch *</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={batchId} onChange={(e) => { setBatchId(e.target.value); setProgramId("") }}>
                {batches.map((b) => <option key={b.id} value={b.id}>Batch {b.year}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Program *</label>
              <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                value={programId} onChange={(e) => setProgramId(e.target.value)}>
                <option value="">Select program…</option>
                {programs.map((p) => (
                  <option key={p.id} value={p.id}>{p.name} — {formatINR(parseFloat(p.totalFee.toString()))}</option>
                ))}
              </select>
            </div>
          </div>

          {selectedProgram && (
            <>
              {/* Admin — Fee Overrides */}
              <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Admin — Fee Overrides</p>
                  <span className="bg-indigo-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin Only</span>
                </div>
                <p className="text-xs text-indigo-400">Leave blank to use programme defaults.</p>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {[
                    { label: "Registration (₹)", placeholder: selectedProgram.registrationFee.toString(), value: feeOverrideReg, set: setFeeOverrideReg },
                    { label: "Year 1 (₹)", placeholder: selectedProgram.year1Fee.toString(), value: feeOverrideY1, set: setFeeOverrideY1 },
                    { label: "Year 2 (₹)", placeholder: selectedProgram.year2Fee.toString(), value: feeOverrideY2, set: setFeeOverrideY2 },
                    { label: "Year 3 (₹)", placeholder: selectedProgram.year3Fee.toString(), value: feeOverrideY3, set: setFeeOverrideY3 },
                  ].map(({ label, placeholder, value, set }) => (
                    <div key={label}>
                      <label className="block text-[10px] font-semibold text-indigo-500 mb-1">{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full border border-indigo-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400 placeholder:text-slate-300"
                      />
                    </div>
                  ))}
                </div>
                {fees?.hasOverride && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                    <span className="text-xs font-semibold text-amber-700">Overridden programme total (excl. registration)</span>
                    <span className="text-sm font-bold text-amber-800">{formatINR(fees.baseFee)}</span>
                  </div>
                )}
              </div>

              {/* Eligible Benefits */}
              {(offers.length > 0 || scholarshipsA.length > 0 || scholarshipsB.length > 0) && (
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-slate-600 mb-0.5">Eligible Benefits</p>
                    <p className="text-xs text-slate-400">These appear on the offer letter. The student confirms which apply at enrolment.</p>
                  </div>

                  {offers.length > 0 && (
                    <div className="space-y-2">
                      {offers.map((o) => (
                        <label key={o.id} className={cn(
                          "flex items-center gap-3 p-3 rounded-lg border cursor-pointer",
                          selectedOfferIds.includes(o.id) ? "border-violet-400 bg-violet-50" : "border-slate-200 hover:border-slate-300"
                        )}>
                          <input type="checkbox" checked={selectedOfferIds.includes(o.id)} onChange={() => toggleOffer(o.id)}
                            className="rounded border-slate-300" />
                          <span className="flex-1 text-sm">{o.name}</span>
                          <span className="text-sm font-semibold text-emerald-600">- {formatINR(parseFloat(o.waiverAmount.toString()))}</span>
                        </label>
                      ))}
                    </div>
                  )}

                  {(scholarshipsA.length > 0 || scholarshipsB.length > 0) && (
                    <div className="grid grid-cols-2 gap-4">
                      {scholarshipsA.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-2">Scholarship — Category A</label>
                          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            value={scholarshipA?.id ?? ""}
                            onChange={(e) => {
                              if (!e.target.value) { setScholarshipA(null); return }
                              const sc = scholarshipsA.find((s) => s.id === e.target.value)!
                              const min = parseFloat(sc.minAmount.toString())
                              const max = parseFloat(sc.maxAmount.toString())
                              setScholarshipA({ id: sc.id, amount: min === max ? min : max })
                            }}>
                            <option value="">None</option>
                            {scholarshipsA.map((s) => (
                              <option key={s.id} value={s.id}>{s.name} (up to {formatINR(parseFloat(s.maxAmount.toString()))})</option>
                            ))}
                          </select>
                          {scholarshipA && (() => {
                            const sc = scholarshipsA.find((s) => s.id === scholarshipA.id)!
                            const min = parseFloat(sc.minAmount.toString())
                            const max = parseFloat(sc.maxAmount.toString())
                            return min !== max ? (
                              <div className="mt-2">
                                <label className="block text-xs text-slate-500 mb-1">Amount</label>
                                <input type="number" min={min} max={max} step={5000}
                                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                                  value={scholarshipA.amount}
                                  onChange={(e) => setScholarshipA({ id: scholarshipA.id, amount: Number(e.target.value) })} />
                              </div>
                            ) : null
                          })()}
                        </div>
                      )}
                      {scholarshipsB.length > 0 && (
                        <div>
                          <label className="block text-xs font-semibold text-slate-600 mb-2">Scholarship — Category B</label>
                          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500"
                            value={scholarshipB?.id ?? ""}
                            onChange={(e) => {
                              if (!e.target.value) { setScholarshipB(null); return }
                              const sc = scholarshipsB.find((s) => s.id === e.target.value)!
                              setScholarshipB({ id: sc.id, amount: parseFloat(sc.maxAmount.toString()) })
                            }}>
                            <option value="">None</option>
                            {scholarshipsB.map((s) => (
                              <option key={s.id} value={s.id}>{s.name} — {formatINR(parseFloat(s.maxAmount.toString()))}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Fee preview */}
              {fees && (
                <div className="rounded-lg bg-slate-50 border border-slate-200 p-4 space-y-2">
                  <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-3">Indicative Fee</p>
                  <div className="flex justify-between text-sm"><span className="text-slate-500">Programme Fee</span><span>{formatINR(fees.baseFee)}</span></div>
                  {fees.totalWaiver > 0 && <div className="flex justify-between text-sm text-emerald-700"><span>Total Eligible Benefits</span><span>- {formatINR(fees.totalWaiver)}</span></div>}
                  <div className="flex justify-between text-sm font-bold border-t border-slate-200 pt-2"><span>Net Fee</span><span>{formatINR(fees.netFee)}</span></div>
                  <p className="text-xs text-slate-400 pt-1">
                    + {formatINR(feeOverrideReg !== "" ? parseFloat(feeOverrideReg) : parseFloat(selectedProgram.registrationFee.toString()))} registration (confirmed at enrolment)
                  </p>
                  <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2 py-1.5 mt-2">
                    Payment plan is chosen at enrolment — after the student confirms their seat.
                  </p>
                </div>
              )}
            </>
          )}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => { setError(""); setStep(1) }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                if (!programId) { setError("Please select a program."); return }
                setError(""); setStep(3)
              }}
              className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700">
              Review <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Review ───────────────────────────────────────── */}
      {step === 3 && (
        <div className="space-y-5">
          <h2 className="text-base font-semibold text-slate-800">Review & Create Offer</h2>

          <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
            <div className="px-4 py-3 flex justify-between text-sm"><span className="text-slate-500">Name</span><span className="font-medium">{name || "—"}</span></div>
            <div className="px-4 py-3 flex justify-between text-sm"><span className="text-slate-500">Email</span><span className="font-medium">{email}</span></div>
            <div className="px-4 py-3 flex justify-between text-sm"><span className="text-slate-500">Phone</span><span className="font-medium">{contact}</span></div>
            <div className="px-4 py-3 flex justify-between text-sm"><span className="text-slate-500">Program</span><span className="font-medium">{selectedProgram?.name ?? "—"}</span></div>
            {fees && <>
              <div className="px-4 py-3 flex justify-between text-sm"><span className="text-slate-500">Eligible Benefits</span><span className="font-medium text-emerald-700">- {formatINR(fees.totalWaiver)}</span></div>
              <div className="px-4 py-3 flex justify-between text-sm font-bold"><span>Indicative Net Fee</span><span>{formatINR(fees.netFee)}</span></div>
            </>}
          </div>

          <p className="text-xs text-slate-500 bg-violet-50 border border-violet-200 rounded-lg px-4 py-3">
            This creates a candidate record with <strong>OFFERED</strong> status. Payment plan and confirmed benefits are set at enrolment.
            After saving, send the offer email from the candidate&apos;s profile.
          </p>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-between pt-2">
            <button type="button" onClick={() => { setError(""); setStep(2) }}
              className="flex items-center gap-1.5 px-4 py-2 border border-slate-200 text-slate-600 text-sm font-medium rounded-lg hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={handleSubmit} disabled={loading}
              className="flex items-center gap-1.5 px-5 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 disabled:opacity-60">
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Create Offer
            </button>
          </div>
        </div>
      )}

      {error && step !== 3 && <p className="text-sm text-rose-600">{error}</p>}
    </div>
  )
}
