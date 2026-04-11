"use client"

import { useState, useMemo, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Loader2, ChevronDown, Check, ChevronRight, ChevronLeft, FileText, User as UserIcon, Wallet } from "lucide-react"
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

type CustomInstallment = {
  label: string
  dueDate: string   // YYYY-MM-DD
  amount: number
  year: number
  yearOption: string  // "0"|"1"|"2"|"3"|"full"
}

const YEAR_OPTIONS = [
  { value: "0",    year: 0, label: "Registration Fee" },
  { value: "1",    year: 1, label: "Year 1 — Growth" },
  { value: "2",    year: 2, label: "Year 2 — Projects" },
  { value: "3",    year: 3, label: "Year 3 — Work" },
  { value: "full", year: 1, label: "Full Programme Fee" },
]

export function EnrollForm({ batches, defaultTerms }: { batches: Batch[], defaultTerms: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [step, setStep] = useState(1) // 1: Details, 2: Fee Plan, 3: Review

  // Form state — personal
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [email, setEmail] = useState("")
  const [contact, setContact] = useState("")
  const [bloodGroup, setBloodGroup] = useState("")
  const [city, setCity] = useState("")
  const [address, setAddress] = useState("")
  const [localAddress, setLocalAddress] = useState("")
  const [localAddressDifferent, setLocalAddressDifferent] = useState(false)

  // Parent / guardian
  const [parent1Name, setParent1Name] = useState("")
  const [parent1Email, setParent1Email] = useState("")
  const [parent1Phone, setParent1Phone] = useState("")
  const [parent2Name, setParent2Name] = useState("")
  const [parent2Email, setParent2Email] = useState("")
  const [parent2Phone, setParent2Phone] = useState("")
  const [localGuardianName, setLocalGuardianName] = useState("")
  const [localGuardianPhone, setLocalGuardianPhone] = useState("")
  const [localGuardianEmail, setLocalGuardianEmail] = useState("")

  // Programme
  const [batchId, setBatchId] = useState(batches[0]?.id ?? "")
  const [programId, setProgramId] = useState("")
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>([])
  const [scholarshipA, setScholarshipA] = useState<{ id: string; amount: number } | null>(null)
  const [scholarshipB, setScholarshipB] = useState<{ id: string; amount: number } | null>(null)
  const [installmentType, setInstallmentType] = useState<"ANNUAL" | "ONE_TIME" | "CUSTOM">("ANNUAL")

  // Per-year fee overrides
  const [feeOverrideY1, setFeeOverrideY1] = useState("")
  const [feeOverrideY2, setFeeOverrideY2] = useState("")
  const [feeOverrideY3, setFeeOverrideY3] = useState("")

  // Custom schedule state
  const [customInstallments, setCustomInstallments] = useState<CustomInstallment[]>([])
  const [customTerms, setCustomTerms] = useState(defaultTerms)

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
    const reg = parseFloat(selectedProgram.registrationFee.toString())
    const baseY1 = parseFloat(selectedProgram.year1Fee.toString())
    const baseY2 = parseFloat(selectedProgram.year2Fee.toString())
    const baseY3 = parseFloat(selectedProgram.year3Fee.toString())

    // Apply per-year overrides
    const y1 = feeOverrideY1 !== "" ? Math.max(0, parseFloat(feeOverrideY1)) : baseY1
    const y2 = feeOverrideY2 !== "" ? Math.max(0, parseFloat(feeOverrideY2)) : baseY2
    const y3 = feeOverrideY3 !== "" ? Math.max(0, parseFloat(feeOverrideY3)) : baseY3
    const baseFee = y1 + y2 + y3

    // Split offers into spread vs one-time
    const isSpread = (c: unknown) =>
      c == null || typeof c !== "object" || (c as Record<string, unknown>).spreadAcrossYears !== false
    const selectedOffers = offers.filter((o) => selectedOfferIds.includes(o.id))
    const spreadWaiver = selectedOffers
      .filter((o) => isSpread(o.conditions))
      .reduce((s, o) => s + parseFloat(o.waiverAmount.toString()), 0)
    const onetimeWaiver = selectedOffers
      .filter((o) => !isSpread(o.conditions))
      .reduce((s, o) => s + parseFloat(o.waiverAmount.toString()), 0)

    const schWaiver = (scholarshipA?.amount ?? 0) + (scholarshipB?.amount ?? 0)
    const totalWaiver = spreadWaiver + onetimeWaiver + schWaiver
    const netFee = Math.round(baseFee - totalWaiver)

    // Per-year waiver: spread offers ÷3, scholarships ÷3, one-time fully in Y1
    const spreadPerYear = Math.round((spreadWaiver + schWaiver) / 3)
    const y1Net = Math.max(0, Math.round(y1 - spreadPerYear - onetimeWaiver))
    const y2Net = Math.max(0, Math.round(y2 - spreadPerYear))
    const y3Net = Math.max(0, Math.round(y3 - spreadPerYear))

    const bYear = selectedBatch!.year
    const today = new Date().toISOString().split("T")[0]
    const y1Due = `${bYear}-07-01`
    const y2Due = `${bYear + 1}-07-01`
    const y3Due = `${bYear + 2}-07-01`

    const annualSchedule = [
      { label: "Registration Fee", amount: Math.round(reg), due: "Today", year: 0 },
      { label: "Year 1 — Growth", amount: y1Net, due: `Jul 1, ${bYear}`, year: 1 },
      { label: "Year 2 — Projects", amount: y2Net, due: `Jul 1, ${bYear + 1}`, year: 2 },
      { label: "Year 3 — Work", amount: y3Net, due: `Jul 1, ${bYear + 2}`, year: 3 },
    ]

    const oneTimeSchedule = [
      { label: "Registration Fee", amount: Math.round(reg), due: "Today", year: 0 },
      { label: "Full Programme Fee (3 Years)", amount: Math.max(0, Math.round(baseFee - totalWaiver)), due: "Within 30 days", year: 1 },
    ]

    const defaultCustom: CustomInstallment[] = [
      { label: "Registration Fee", dueDate: today, amount: Math.round(reg), year: 0, yearOption: "0" },
      { label: "Year 1 — Growth", dueDate: y1Due, amount: y1Net, year: 1, yearOption: "1" },
      { label: "Year 2 — Projects", dueDate: y2Due, amount: y2Net, year: 2, yearOption: "2" },
      { label: "Year 3 — Work", dueDate: y3Due, amount: y3Net, year: 3, yearOption: "3" },
    ]

    return {
      baseFee,
      baseY1, baseY2, baseY3,
      y1, y2, y3,
      hasOverride: feeOverrideY1 !== "" || feeOverrideY2 !== "" || feeOverrideY3 !== "",
      totalWaiver,
      netFee,
      schedule: installmentType === "ANNUAL" ? annualSchedule : oneTimeSchedule,
      defaultCustom,
    }
  }, [selectedProgram, selectedOfferIds, scholarshipA, scholarshipB, installmentType, offers, selectedBatch, feeOverrideY1, feeOverrideY2, feeOverrideY3])

  const toggleOffer = (id: string) => {
    setSelectedOfferIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const updateCustomInstallment = (index: number, field: string, value: any) => {
    setCustomInstallments((prev) =>
      prev.map((inst, i) => {
        if (i !== index) return inst
        if (field === "yearOption") {
          const opt = YEAR_OPTIONS.find((o) => o.value === value)
          if (!opt) return inst
          return { ...inst, yearOption: opt.value, year: opt.year, label: opt.label }
        }
        return { ...inst, [field]: value }
      })
    )
  }

  const addCustomInstallment = () => {
    setCustomInstallments((prev) => [
      ...prev,
      { label: "Year 1 — Growth", dueDate: new Date().toISOString().split("T")[0], amount: 0, year: 1, yearOption: "1" },
    ])
  }

  const removeCustomInstallment = (index: number) => {
    if (index === 0) return
    setCustomInstallments((prev) => prev.filter((_, i) => i !== index))
  }

  const customTotal = customInstallments.reduce((s, i) => s + i.amount, 0)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!programId) return setError("Please select a program")
    setLoading(true)
    setError("")

    const scholarships: { scholarshipId: string; amount: number }[] = []
    if (scholarshipA) scholarships.push({ scholarshipId: scholarshipA.id, amount: scholarshipA.amount })
    if (scholarshipB) scholarships.push({ scholarshipId: scholarshipB.id, amount: scholarshipB.amount })

    try {
      const res = await fetch("/api/students/enroll", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          name: `${firstName} ${lastName}`.trim(),
          email,
          contact,
          bloodGroup: bloodGroup || null,
          city: city || null,
          address: address || null,
          localAddress: localAddressDifferent ? (localAddress || null) : null,
          parent1Name: parent1Name || null,
          parent1Email: parent1Email || null,
          parent1Phone: parent1Phone || null,
          parent2Name: parent2Name || null,
          parent2Email: parent2Email || null,
          parent2Phone: parent2Phone || null,
          localGuardianName: localGuardianName || null,
          localGuardianPhone: localGuardianPhone || null,
          localGuardianEmail: localGuardianEmail || null,
          batchId,
          programId,
          offerIds: selectedOfferIds,
          scholarships,
          installmentType,
          customInstallments: installmentType === "CUSTOM" ? customInstallments : undefined,
          customTerms,
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

  const handleNext = () => {
    if (step === 1) {
      if (!firstName || !lastName || !email || !contact) return setError("Please fill in all required student details")
      if (!parent1Name || !parent1Phone || !parent1Email) return setError("Parent 1 details are mandatory")
      setError("")
      setStep(2)
    } else if (step === 2) {
      if (!programId) return setError("Please select a program")
      if (installmentType === "CUSTOM" && Math.abs(customTotal - (fees?.netFee ?? 0)) >= 1) {
        return setError(`Custom installments must total ${formatINR(fees?.netFee ?? 0)}`)
      }
      setError("")
      setStep(3)
    }
  }

  const handleBack = () => {
    setStep(prev => Math.max(1, prev - 1))
  }

  return (
    <div className="space-y-8">
      {/* Stepper Header */}
      <div className="flex items-center justify-between relative px-2">
        <div className="absolute top-5 left-10 right-10 h-0.5 bg-slate-100 z-0" />
        {[
          { s: 1, label: "Details", icon: UserIcon },
          { s: 2, label: "Fee Plan", icon: Wallet },
          { s: 3, label: "Review", icon: FileText },
        ].map(({ s, label, icon: Icon }) => (
          <div key={s} className="relative z-10 flex flex-col items-center gap-2">
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center border-4 transition-all duration-500",
              step === s ? "bg-indigo-600 border-indigo-100 text-white shadow-lg shadow-indigo-100 scale-110" : 
              step > s ? "bg-emerald-500 border-emerald-50 text-white" :
              "bg-white border-slate-50 text-slate-300"
            )}>
              {step > s ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
            </div>
            <span className={cn(
              "text-[9px] uppercase tracking-widest font-black transition-colors duration-500",
              step === s ? "text-indigo-600" : "text-slate-400"
            )}>
              {label}
            </span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Student Details</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">First Name</label>
                  <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Rahul" className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Last Name</label>
                  <input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Mehta" className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Contact Number</label>
                  <input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="+91 98765 43210" className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Blood Group</label>
                  <select value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all">
                    <option value="">Select…</option>
                    {["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"].map((g) => <option key={g} value={g}>{g}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Email Address</label>
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="rahul@example.com" className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                </div>
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Home Address</label>
                  <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Full home address" className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all resize-none" />
                </div>
              </div>
            </div>

            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Parents & Guardian</p>
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-bold text-slate-600 mb-2">Parent 1 <span className="text-rose-500">*</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={parent1Name} onChange={(e) => setParent1Name(e.target.value)} placeholder="Full Name" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                    <input value={parent1Phone} onChange={(e) => setParent1Phone(e.target.value)} placeholder="Phone" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                    <input type="email" value={parent1Email} onChange={(e) => setParent1Email(e.target.value)} placeholder="Email" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs font-bold text-slate-600 mb-2">Parent 2 <span className="text-slate-400 font-medium">(Optional)</span></p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <input value={parent2Name} onChange={(e) => setParent2Name(e.target.value)} placeholder="Full Name" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                    <input value={parent2Phone} onChange={(e) => setParent2Phone(e.target.value)} placeholder="Phone" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                    <input type="email" value={parent2Email} onChange={(e) => setParent2Email(e.target.value)} placeholder="Email" className="h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Programme</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Program</label>
                  <select value={programId} onChange={(e) => setProgramId(e.target.value)} required className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all">
                    <option value="">Select program…</option>
                    {programs.map((p) => <option key={p.id} value={p.id}>{p.name} — {formatINR(parseFloat(p.totalFee.toString()))}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {selectedProgram && (
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
                <div>
                  <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Fee Override</p>
                  <p className="text-xs text-slate-400 mt-0.5">Leave blank to use the programme defaults. Overrides affect the base fee before waivers.</p>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  {[
                    { label: "Year 1 Fee (₹)", placeholder: selectedProgram.year1Fee.toString(), value: feeOverrideY1, set: setFeeOverrideY1 },
                    { label: "Year 2 Fee (₹)", placeholder: selectedProgram.year2Fee.toString(), value: feeOverrideY2, set: setFeeOverrideY2 },
                    { label: "Year 3 Fee (₹)", placeholder: selectedProgram.year3Fee.toString(), value: feeOverrideY3, set: setFeeOverrideY3 },
                  ].map(({ label, placeholder, value, set }) => (
                    <div key={label} className="space-y-1">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</label>
                      <input
                        type="number"
                        value={value}
                        onChange={(e) => set(e.target.value)}
                        placeholder={placeholder}
                        className="w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 placeholder:text-slate-300 focus:border-indigo-500 focus:outline-none transition-all"
                      />
                    </div>
                  ))}
                </div>
                {fees?.hasOverride && (
                  <div className="flex items-center justify-between bg-amber-50 border border-amber-200 rounded-xl px-4 py-2">
                    <span className="text-xs font-semibold text-amber-700">Overridden total</span>
                    <span className="text-sm font-bold text-amber-800">{formatINR(fees.baseFee)}</span>
                  </div>
                )}
              </div>
            )}

            {selectedProgram && (
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Offers & Scholarships</p>
                {offers.length > 0 && (
                  <div className="space-y-2">
                    {offers.map((offer) => (
                      <label key={offer.id} className={cn("flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all", selectedOfferIds.includes(offer.id) ? "border-indigo-500 bg-indigo-50" : "border-slate-200 hover:border-slate-300")}>
                        <div className="flex items-center gap-3">
                          <input type="checkbox" checked={selectedOfferIds.includes(offer.id)} onChange={() => toggleOffer(offer.id)} className="w-4 h-4 accent-indigo-600" />
                          <span className="text-sm font-semibold text-slate-800">{offer.name}</span>
                        </div>
                        <span className="text-sm font-extrabold text-emerald-600">−{formatINR(parseFloat(offer.waiverAmount.toString()))}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {scholarshipsA.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-1">Category A Scholarship</label>
                      <select className="w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" value={scholarshipA?.id ?? ""} onChange={(e) => {
                        const s = scholarshipsA.find(x => x.id === e.target.value)
                        setScholarshipA(s ? { id: s.id, amount: parseFloat(s.minAmount.toString()) } : null)
                      }}>
                        <option value="">None</option>
                        {scholarshipsA.map(s => <option key={s.id} value={s.id}>{s.name} (₹{parseFloat(s.minAmount.toString()).toLocaleString()})</option>)}
                      </select>
                    </div>
                  )}

                  {scholarshipsB.length > 0 && (
                    <div className="space-y-1.5">
                      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-1">Category B Scholarship</label>
                      <select className="w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all" value={scholarshipB?.id ?? ""} onChange={(e) => {
                        const s = scholarshipsB.find(x => x.id === e.target.value)
                        setScholarshipB(s ? { id: s.id, amount: parseFloat(s.minAmount.toString()) } : null)
                      }}>
                        <option value="">None</option>
                        {scholarshipsB.map(s => <option key={s.id} value={s.id}>{s.name} (₹{parseFloat(s.minAmount.toString()).toLocaleString()})</option>)}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            )}

            {fees && (
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Payment Plan</p>
                <div className="flex gap-2">
                  {(["ANNUAL", "ONE_TIME", "CUSTOM"] as const).map((type) => (
                    <button key={type} type="button" onClick={() => { setInstallmentType(type); if(type==="CUSTOM") setCustomInstallments(fees.defaultCustom) }} className={cn("flex-1 h-11 rounded-xl border-2 text-sm font-bold transition-all", installmentType === type ? "border-indigo-500 bg-indigo-50 text-indigo-700" : "border-slate-200 text-slate-500 hover:border-slate-300")}>{type}</button>
                  ))}
                </div>
                {installmentType === "CUSTOM" && (
                  <div className="space-y-3">
                    {customInstallments.map((inst, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input className="flex-1 h-9 rounded-lg border-2 border-slate-200 px-3 text-xs" value={inst.label} onChange={e => updateCustomInstallment(i, 'label', e.target.value)} />
                        <input className="w-24 h-9 rounded-lg border-2 border-slate-200 px-3 text-xs" type="number" value={inst.amount} onChange={e => updateCustomInstallment(i, 'amount', parseFloat(e.target.value))} />
                        <input className="w-32 h-9 rounded-lg border-2 border-slate-200 px-3 text-xs" type="date" value={inst.dueDate} onChange={e => updateCustomInstallment(i, 'dueDate', e.target.value)} />
                        {i > 0 && <button type="button" onClick={() => removeCustomInstallment(i)} className="text-rose-500 hover:text-rose-700">×</button>}
                      </div>
                    ))}
                    <button type="button" onClick={addCustomInstallment} className="w-full py-2 border-2 border-dashed rounded-xl text-xs font-bold text-slate-400 hover:border-indigo-400 hover:text-indigo-500 transition-all">+ Add Installment</button>
                  </div>
                )}
                <div className="bg-slate-50 rounded-xl p-4 flex justify-between items-center">
                   <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">Net Payable</span>
                   <span className="text-xl font-black text-indigo-600">{formatINR(fees.netFee)}</span>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Custom Terms & Conditions</p>
              <textarea value={customTerms} onChange={(e) => setCustomTerms(e.target.value)} rows={6} className="w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 focus:border-indigo-500 focus:outline-none transition-all" />
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-6">
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-6 flex gap-4">
              <div className="w-12 h-12 bg-emerald-500 rounded-xl flex items-center justify-center shrink-0"><Check className="h-6 w-6 text-white" /></div>
              <div className="flex-1"><h3 className="text-lg font-extrabold text-emerald-900">Review & Enroll</h3><p className="text-sm font-medium text-emerald-700">Please verify all details before confirming.</p></div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
                 <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Student Info</p>
                 <div className="text-sm space-y-1">
                    <p><strong>Name:</strong> {firstName} {lastName}</p>
                    <p><strong>Email:</strong> {email}</p>
                    <p><strong>Contact:</strong> {contact}</p>
                    <p><strong>Program:</strong> {selectedProgram?.name}</p>
                 </div>
              </div>
              <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
                 <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Financial Summary</p>
                 <div className="text-sm space-y-1">
                    <div className="flex justify-between"><span>Base:</span> <span>{formatINR(fees?.baseFee ?? 0)}</span></div>
                    <div className="flex justify-between text-emerald-600"><span>Waivers:</span> <span>-{formatINR(fees?.totalWaiver ?? 0)}</span></div>
                    <div className="flex justify-between font-bold border-t pt-1"><span>Net:</span> <span>{formatINR(fees?.netFee ?? 0)}</span></div>
                 </div>
              </div>
            </div>
          </div>
        )}

        {error && <p className="text-sm font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-600 px-4 py-3 rounded-xl">{error}</p>}

        <div className="flex items-center justify-between pt-4 border-t border-slate-100">
          <div className="flex items-center gap-3">
            {step > 1 && <button type="button" onClick={handleBack} className="h-12 px-6 border-2 border-slate-200 hover:border-slate-300 text-slate-600 font-bold rounded-xl transition-all flex items-center gap-2"><ChevronLeft className="h-4 w-4" />Back</button>}
            <Link href="/students" className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors">Cancel</Link>
          </div>
          <div className="flex items-center gap-3">
            {step < 3 ? (
              <button type="button" onClick={handleNext} className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all flex items-center gap-2">Next Step<ChevronRight className="h-4 w-4" /></button>
            ) : (
              <button type="submit" disabled={loading} className="h-12 px-8 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center gap-2">{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? "Enrolling…" : "Confirm & Enroll"}{!loading && <Check className="h-4 w-4" />}</button>
            )}
          </div>
        </div>
      </form>
    </div>
  )
}
