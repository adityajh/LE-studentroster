"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronDown, Plus, X, AlertTriangle, Settings, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { DeleteStudentButton } from "./delete-student-button"

// ─── Types ────────────────────────────────────────────────────────────────────

type Student = {
  id: string
  firstName: string | null
  lastName: string | null
  name: string
  email: string
  contact: string | null
  bloodGroup: string | null
  city: string | null
  address: string | null
  localAddress: string | null
  parent1Name: string | null
  parent1Email: string | null
  parent1Phone: string | null
  parent2Name: string | null
  parent2Email: string | null
  parent2Phone: string | null
  localGuardianName: string | null
  localGuardianPhone: string | null
  localGuardianEmail: string | null
  financial: {
    baseFee: any
    netFee: any
    totalWaiver: any
    totalDeduction: any
    customTerms: string | null
    isLocked: boolean
    installmentType: string
  } | null
  offers: { id: string; offerId: string; waiverAmount: any; offer: { id: string; name: string; type: string; waiverAmount: any } }[]
  scholarships: { id: string; scholarshipId: string; amount: any; scholarship: { id: string; name: string; category: string } }[]
  deductions: { id: string; description: string; amount: any }[]
}

type FeeSchedule = {
  offers: { id: string; name: string; type: string; waiverAmount: any }[]
  scholarships: { id: string; name: string; category: string; minAmount: any; maxAmount: any }[]
} | null

type Program = {
  year1Fee: { toString(): string }
  year2Fee: { toString(): string }
  year3Fee: { toString(): string }
} | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"]

function Field({ label, children, span2 }: { label: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div className={`space-y-1.5 ${span2 ? "md:col-span-2" : ""}`}>
      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls = "w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
const inputSmCls = "w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
const textareaCls = "w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all resize-none"

function formatINR(n: number) {
  if (n >= 100000) return `₹${(n / 100000).toFixed(2).replace(/\.?0+$/, "")}L`
  if (n >= 1000) return `₹${(n / 1000).toFixed(1).replace(/\.?0+$/, "")}K`
  return `₹${n}`
}

// ─── Main Form ────────────────────────────────────────────────────────────────

export function EditStudentForm({
  student,
  role,
  feeSchedule,
  totalPaid = 0,
  program = null,
}: {
  student: Student
  role?: string
  feeSchedule?: FeeSchedule
  totalPaid?: number
  program?: Program
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const isAdmin = role === "ADMIN"

  // ── Personal ──
  const [firstName, setFirstName] = useState(student.firstName ?? student.name.split(" ")[0] ?? "")
  const [lastName, setLastName] = useState(student.lastName ?? student.name.split(" ").slice(1).join(" ") ?? "")
  const [email, setEmail] = useState(student.email ?? "")
  const [contact, setContact] = useState(student.contact ?? "")
  const [bloodGroup, setBloodGroup] = useState(student.bloodGroup ?? "")
  const [feeY1, setFeeY1] = useState("")
  const [feeY2, setFeeY2] = useState("")
  const [feeY3, setFeeY3] = useState("")
  const [customTerms, setCustomTerms] = useState(student.financial?.customTerms ?? "")
  const [changeReason, setChangeReason] = useState("")

  const programY1 = parseFloat(program?.year1Fee?.toString() ?? "0") || 0
  const programY2 = parseFloat(program?.year2Fee?.toString() ?? "0") || 0
  const programY3 = parseFloat(program?.year3Fee?.toString() ?? "0") || 0
  const computedY1 = feeY1 !== "" ? Math.max(0, parseFloat(feeY1)) : programY1
  const computedY2 = feeY2 !== "" ? Math.max(0, parseFloat(feeY2)) : programY2
  const computedY3 = feeY3 !== "" ? Math.max(0, parseFloat(feeY3)) : programY3
  const baseFee = String(computedY1 + computedY2 + computedY3)

  const initialBaseFee = student.financial?.baseFee?.toString() ?? "0"
  const initialCustomTerms = student.financial?.customTerms ?? ""

  // ── Address ──
  const [city, setCity] = useState(student.city ?? "")
  const [address, setAddress] = useState(student.address ?? "")
  const [localAddressDifferent, setLocalAddressDifferent] = useState(!!student.localAddress)
  const [localAddress, setLocalAddress] = useState(student.localAddress ?? "")

  // ── Parents & Guardian ──
  const [parent1Name, setParent1Name] = useState(student.parent1Name ?? "")
  const [parent1Phone, setParent1Phone] = useState(student.parent1Phone ?? "")
  const [parent1Email, setParent1Email] = useState(student.parent1Email ?? "")
  const [parent2Name, setParent2Name] = useState(student.parent2Name ?? "")
  const [parent2Phone, setParent2Phone] = useState(student.parent2Phone ?? "")
  const [parent2Email, setParent2Email] = useState(student.parent2Email ?? "")
  const [localGuardianName, setLocalGuardianName] = useState(student.localGuardianName ?? "")
  const [localGuardianPhone, setLocalGuardianPhone] = useState(student.localGuardianPhone ?? "")
  const [localGuardianEmail, setLocalGuardianEmail] = useState(student.localGuardianEmail ?? "")

  // ── Financial Plan (Admin only) ──
  const [selectedOfferIds, setSelectedOfferIds] = useState<string[]>(
    student.offers.map(so => so.offerId)
  )
  const [selectedScholarships, setSelectedScholarships] = useState<{ scholarshipId: string; amount: number }[]>(
    student.scholarships.map(ss => ({ scholarshipId: ss.scholarshipId, amount: Number(ss.amount) }))
  )
  const [deductions, setDeductions] = useState<{ description: string; amount: number }[]>(
    student.deductions.map(d => ({ description: d.description, amount: Number(d.amount) }))
  )

  const [showFinancialPlan, setShowFinancialPlan] = useState(false)

  // ── Fee Preview ──
  const baseFeeNum = parseFloat(baseFee) || 0
  const offerWaiverTotal = (feeSchedule?.offers ?? [])
    .filter(o => selectedOfferIds.includes(o.id))
    .reduce((sum, o) => sum + Number(o.waiverAmount), 0)
  const scholarshipWaiverTotal = selectedScholarships.reduce((sum, s) => sum + s.amount, 0)
  const deductionTotal = deductions.reduce((sum, d) => sum + d.amount, 0)
  const previewNetFee = baseFeeNum - offerWaiverTotal - scholarshipWaiverTotal - deductionTotal

  const isFinancialChanged =
    baseFee !== initialBaseFee ||
    customTerms !== initialCustomTerms ||
    JSON.stringify(selectedOfferIds.sort()) !== JSON.stringify(student.offers.map(o => o.offerId).sort()) ||
    JSON.stringify(selectedScholarships) !== JSON.stringify(student.scholarships.map(ss => ({ scholarshipId: ss.scholarshipId, amount: Number(ss.amount) }))) ||
    JSON.stringify(deductions) !== JSON.stringify(student.deductions.map(d => ({ description: d.description, amount: Number(d.amount) })))

  const showReasonField = student.financial?.isLocked && isFinancialChanged
  const isCustomPlan = student.financial?.installmentType === "CUSTOM"
  const isOverpaid = previewNetFee < totalPaid

  // ── Helpers for scholarship editing ──
  const toggleOffer = (offerId: string) => {
    setSelectedOfferIds(prev =>
      prev.includes(offerId) ? prev.filter(id => id !== offerId) : [...prev, offerId]
    )
  }

  const upsertScholarship = (scholarshipId: string, amount: number) => {
    setSelectedScholarships(prev => {
      const existing = prev.find(s => s.scholarshipId === scholarshipId)
      if (existing) return prev.map(s => s.scholarshipId === scholarshipId ? { ...s, amount } : s)
      return [...prev, { scholarshipId, amount }]
    })
  }

  const removeScholarship = (scholarshipId: string) => {
    setSelectedScholarships(prev => prev.filter(s => s.scholarshipId !== scholarshipId))
  }

  const addDeduction = () => setDeductions(prev => [...prev, { description: "", amount: 0 }])
  const removeDeduction = (i: number) => setDeductions(prev => prev.filter((_, idx) => idx !== i))
  const updateDeduction = (i: number, field: "description" | "amount", value: string | number) => {
    setDeductions(prev => prev.map((d, idx) => idx === i ? { ...d, [field]: value } : d))
  }

  // ── Submit ──
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName || !email || !contact) {
      setError("First name, last name, email and contact are required.")
      return
    }
    if (isAdmin && isOverpaid) {
      setError(`Cannot save: new Net Fee (${formatINR(previewNetFee)}) is less than amount already paid (${formatINR(totalPaid)}). Remove some offers/scholarships or increase the base fee first.`)
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          contact,
          bloodGroup:         bloodGroup         || null,
          city:               city               || null,
          address:            address            || null,
          localAddress:       localAddressDifferent ? (localAddress || null) : null,
          parent1Name:        parent1Name        || null,
          parent1Email:       parent1Email       || null,
          parent1Phone:       parent1Phone       || null,
          parent2Name:        parent2Name        || null,
          parent2Email:       parent2Email       || null,
          parent2Phone:       parent2Phone       || null,
          localGuardianName:  localGuardianName  || null,
          localGuardianPhone: localGuardianPhone || null,
          localGuardianEmail: localGuardianEmail || null,
          baseFee:            isAdmin ? baseFee : undefined,
          customTerms:        isAdmin ? customTerms : undefined,
          offers:             isAdmin && isFinancialChanged ? selectedOfferIds : undefined,
          scholarships:       isAdmin && isFinancialChanged ? selectedScholarships : undefined,
          deductions:         isAdmin && isFinancialChanged ? deductions : undefined,
          changeReason:       showReasonField ? changeReason : undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Update failed")
      router.push(`/students/${student.id}`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">

      {/* Section 1 — Personal Details */}
      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-4">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Personal Details</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="First Name">
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required placeholder="Rahul" className={inputCls} />
          </Field>
          <Field label="Last Name">
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} required placeholder="Mehta" className={inputCls} />
          </Field>
          <Field label="Contact Number">
            <input value={contact} onChange={(e) => setContact(e.target.value)} required placeholder="+91 98765 43210" className={inputCls} />
          </Field>
          <Field label="Blood Group">
            <div className="relative">
              <select
                value={bloodGroup}
                onChange={(e) => setBloodGroup(e.target.value)}
                className="w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 pr-10 text-sm font-semibold text-slate-800 appearance-none focus:border-indigo-500 focus:outline-none transition-all"
              >
                <option value="">Select…</option>
                {BLOOD_GROUPS.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>
          </Field>
          <Field label="Email Address" span2>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="rahul@example.com" className={inputCls} />
          </Field>
        </div>
      </div>

      {/* Section 2 — Address, Parents & Guardian */}
      <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm p-6 space-y-5">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Address, Parents & Guardian</p>

        {/* Address */}
        <div className="space-y-3">
          <p className="text-xs font-bold text-slate-600">Home Address</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="City" span2={false}>
              <input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Mumbai" className={inputCls} />
            </Field>
            <Field label="Full Address" span2>
              <textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} placeholder="Street, area, state, PIN" className={textareaCls} />
            </Field>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={localAddressDifferent}
              onChange={(e) => setLocalAddressDifferent(e.target.checked)}
              className="w-4 h-4 accent-indigo-600"
            />
            <span className="text-xs font-semibold text-slate-600">Local address is different from home address</span>
          </label>
          {localAddressDifferent && (
            <Field label="Local Address" span2>
              <textarea value={localAddress} onChange={(e) => setLocalAddress(e.target.value)} rows={2} placeholder="Local address during programme" className={textareaCls} />
            </Field>
          )}
        </div>

        {/* Parent 1 */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-600">Parent 1</p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Full Name">
              <input value={parent1Name} onChange={(e) => setParent1Name(e.target.value)} placeholder="Name" className={inputSmCls} />
            </Field>
            <Field label="Phone">
              <input value={parent1Phone} onChange={(e) => setParent1Phone(e.target.value)} placeholder="+91 …" className={inputSmCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={parent1Email} onChange={(e) => setParent1Email(e.target.value)} placeholder="email@example.com" className={inputSmCls} />
            </Field>
          </div>
        </div>

        {/* Parent 2 */}
        <div className="space-y-3 pt-4 border-t border-slate-100">
          <p className="text-xs font-bold text-slate-600">Parent 2 <span className="font-medium text-slate-400">(optional)</span></p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Field label="Full Name">
              <input value={parent2Name} onChange={(e) => setParent2Name(e.target.value)} placeholder="Name" className={inputSmCls} />
            </Field>
            <Field label="Phone">
              <input value={parent2Phone} onChange={(e) => setParent2Phone(e.target.value)} placeholder="+91 …" className={inputSmCls} />
            </Field>
            <Field label="Email">
              <input type="email" value={parent2Email} onChange={(e) => setParent2Email(e.target.value)} placeholder="email@example.com" className={inputSmCls} />
            </Field>
          </div>
        </div>

        {/* Local Guardian */}
        {localAddressDifferent && (
          <div className="space-y-3 pt-4 border-t border-slate-100">
            <p className="text-xs font-bold text-slate-600">Local Guardian <span className="font-medium text-slate-400">(optional)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Full Name">
                <input value={localGuardianName} onChange={(e) => setLocalGuardianName(e.target.value)} placeholder="Name" className={inputSmCls} />
              </Field>
              <Field label="Phone">
                <input value={localGuardianPhone} onChange={(e) => setLocalGuardianPhone(e.target.value)} placeholder="+91 …" className={inputSmCls} />
              </Field>
              <Field label="Email">
                <input type="email" value={localGuardianEmail} onChange={(e) => setLocalGuardianEmail(e.target.value)} placeholder="email@example.com" className={inputSmCls} />
              </Field>
            </div>
          </div>
        )}
      </div>

      {/* Section 3 — Admin Overrides (Admin only) */}
      {isAdmin && (
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => setShowFinancialPlan(!showFinancialPlan)}
            className={cn(
              "w-full flex items-center justify-between p-4 rounded-2xl border-2 transition-all font-bold",
              showFinancialPlan 
                ? "bg-indigo-600 border-indigo-600 text-white shadow-lg shadow-indigo-100" 
                : "bg-white border-slate-200 text-slate-600 hover:border-indigo-200 hover:bg-indigo-50/30"
            )}
          >
            <div className="flex items-center gap-3">
              <div className={cn(
                "p-2 rounded-xl transition-colors",
                showFinancialPlan ? "bg-indigo-500 text-white" : "bg-indigo-100 text-indigo-600"
              )}>
                <Settings className="h-4 w-4" />
              </div>
              <div className="text-left">
                <p className="text-sm">Manage Financial Plan</p>
                <p className={cn(
                  "text-[10px] uppercase tracking-widest font-black opacity-60",
                  showFinancialPlan ? "text-indigo-100" : "text-indigo-400"
                )}>
                  {showFinancialPlan ? "Editing active" : "Admin Overrides & Discounts"}
                </p>
              </div>
            </div>
            {showFinancialPlan ? <ChevronDown className="h-5 w-5 opacity-60" /> : <ChevronRight className="h-5 w-5 opacity-40" />}
          </button>

          {showFinancialPlan && (
            <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 space-y-6 shadow-sm animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="flex items-center gap-2">
                <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Admin — Financial Plan</p>
                <span className="bg-indigo-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin Only</span>
              </div>

          {/* Per-year fee overrides */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Field label={`Year 1 Fee (₹)`}>
              <input
                type="number"
                value={feeY1}
                onChange={(e) => setFeeY1(e.target.value)}
                placeholder={String(programY1 || "0")}
                className="w-full h-11 rounded-xl border-2 border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </Field>
            <Field label={`Year 2 Fee (₹)`}>
              <input
                type="number"
                value={feeY2}
                onChange={(e) => setFeeY2(e.target.value)}
                placeholder={String(programY2 || "0")}
                className="w-full h-11 rounded-xl border-2 border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </Field>
            <Field label={`Year 3 Fee (₹)`}>
              <input
                type="number"
                value={feeY3}
                onChange={(e) => setFeeY3(e.target.value)}
                placeholder={String(programY3 || "0")}
                className="w-full h-11 rounded-xl border-2 border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all"
              />
            </Field>
            {(feeY1 !== "" || feeY2 !== "" || feeY3 !== "") && (
              <div className="flex flex-col justify-end pb-0.5">
                <p className="text-[10px] uppercase tracking-widest font-bold text-amber-500 mb-1">Total Override</p>
                <p className="text-lg font-black text-amber-600">{formatINR(computedY1 + computedY2 + computedY3)}</p>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* spacer */}
            <div />

            {/* Net Fee Preview */}
            <div className="flex flex-col justify-end">
              <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400 mb-1">Net Fee Preview</p>
              <p className={cn("text-2xl font-black", isOverpaid ? "text-rose-600" : "text-indigo-700")}>
                {formatINR(Math.max(0, previewNetFee))}
              </p>
              {totalPaid > 0 && (
                <p className="text-xs font-medium text-slate-500 mt-0.5">
                  Paid so far: <strong className="text-slate-700">{formatINR(totalPaid)}</strong>
                </p>
              )}
              {isOverpaid && (
                <p className="text-xs font-bold text-rose-600 mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3" />
                  Net fee is below amount already paid
                </p>
              )}
            </div>
          </div>

          {/* Offers */}
          {feeSchedule && feeSchedule.offers.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Offers Applied</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {feeSchedule.offers.map(offer => (
                  <label
                    key={offer.id}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 cursor-pointer transition-all",
                      selectedOfferIds.includes(offer.id)
                        ? "border-emerald-400 bg-emerald-50"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedOfferIds.includes(offer.id)}
                      onChange={() => toggleOffer(offer.id)}
                      className="w-4 h-4 accent-emerald-600 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-700 truncate">{offer.name}</p>
                      <p className="text-[10px] font-semibold text-emerald-600">−{formatINR(Number(offer.waiverAmount))}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Scholarships */}
          {feeSchedule && feeSchedule.scholarships.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-slate-600">Scholarships</p>
              <div className="space-y-2">
                {feeSchedule.scholarships.map(sc => {
                  const applied = selectedScholarships.find(s => s.scholarshipId === sc.id)
                  return (
                    <div
                      key={sc.id}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all",
                        applied ? "border-indigo-400 bg-indigo-50" : "border-slate-200 bg-white"
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={!!applied}
                        onChange={() => applied ? removeScholarship(sc.id) : upsertScholarship(sc.id, Number(sc.minAmount))}
                        className="w-4 h-4 accent-indigo-600 shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-700">
                          <span className="text-[9px] font-black uppercase tracking-widest text-indigo-400 mr-1.5">Cat {sc.category}</span>
                          {sc.name}
                        </p>
                        <p className="text-[10px] text-slate-400">Range: {formatINR(Number(sc.minAmount))} – {formatINR(Number(sc.maxAmount))}</p>
                      </div>
                      {applied && (
                        <input
                          type="number"
                          value={applied.amount}
                          min={Number(sc.minAmount)}
                          max={Number(sc.maxAmount)}
                          onChange={(e) => upsertScholarship(sc.id, Number(e.target.value))}
                          className="w-24 h-9 rounded-lg border-2 border-indigo-200 bg-white px-2 text-sm font-bold text-indigo-700 focus:border-indigo-500 focus:outline-none text-right"
                        />
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Manual Deductions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold text-slate-600">Manual Deductions</p>
              <button
                type="button"
                onClick={addDeduction}
                className="flex items-center gap-1 text-[10px] font-bold text-indigo-600 hover:text-indigo-800 transition-colors"
              >
                <Plus className="h-3 w-3" />
                Add Deduction
              </button>
            </div>
            {deductions.length === 0 && (
              <p className="text-xs text-slate-400 italic px-1">No manual deductions applied.</p>
            )}
            {deductions.map((d, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={d.description}
                  onChange={(e) => updateDeduction(i, "description", e.target.value)}
                  placeholder="Description (e.g. Covid Support)"
                  className="flex-1 h-10 rounded-xl border-2 border-rose-200 bg-white px-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none transition-all"
                />
                <input
                  type="number"
                  value={d.amount}
                  min={0}
                  onChange={(e) => updateDeduction(i, "amount", Number(e.target.value))}
                  className="w-28 h-10 rounded-xl border-2 border-rose-200 bg-white px-3 text-sm font-bold text-rose-700 focus:border-rose-400 focus:outline-none text-right"
                />
                <button
                  type="button"
                  onClick={() => removeDeduction(i)}
                  className="h-10 w-10 flex items-center justify-center rounded-xl border-2 border-rose-200 text-rose-400 hover:text-rose-600 hover:border-rose-400 transition-all"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>

          {/* Custom T&C */}
          <Field label="Custom Terms & Conditions" span2>
            <textarea
              value={customTerms}
              onChange={(e) => setCustomTerms(e.target.value)}
              rows={4}
              className={cn(textareaCls, "border-indigo-100 bg-white/50")}
              placeholder="Student-specific terms..."
            />
          </Field>

          {/* Custom plan warning */}
          {isCustomPlan && isFinancialChanged && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs font-semibold text-amber-700">
                This student is on a <strong>Custom</strong> installment plan. After saving, please manually adjust the installment amounts to reflect the new Net Fee — the system will not auto-redistribute them.
              </p>
            </div>
          )}

          {/* Reason for change */}
          {showReasonField && (
            <Field label="Reason for Change (Required)" span2>
              <input
                value={changeReason}
                onChange={(e) => setChangeReason(e.target.value)}
                required
                placeholder="e.g. Late scholarship approved, fee restructure authorized by principal"
                className={cn(inputCls, "border-amber-300 bg-amber-50 focus:border-amber-500")}
              />
            </Field>
          )}

          {/* Info */}
          <p className="text-[10.5px] font-medium text-indigo-600 leading-snug">
            {student.financial?.isLocked
              ? "⚠️ This record is LOCKED. All financial changes require a reason and will be logged to the Changelog."
              : "Changes to financial fields will automatically recalculate the Net Fee and redistribute future installments."}
          </p>
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
          disabled={loading || (isAdmin && isOverpaid)}
          className="h-12 px-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center gap-2"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Saving…" : "Save Changes"}
        </button>
        <a
          href={`/students/${student.id}`}
          className="text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
        >
          Cancel
        </a>
      </div>

      {isAdmin && (
        <div className="pt-8 border-t border-slate-100 mt-8">
          <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-rose-900">Danger Zone</p>
              <p className="text-xs font-medium text-rose-600 opacity-80 mt-1">
                Irreversibly delete this student record and all associated payments, documents, and audit logs.
              </p>
            </div>
            <DeleteStudentButton studentId={student.id} studentName={student.name} />
          </div>
        </div>
      )}
    </form>
  )
}
