"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2, ChevronDown } from "lucide-react"

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
  } | null
}

const BLOOD_GROUPS = ["A+", "A−", "B+", "B−", "AB+", "AB−", "O+", "O−"]

function Field({
  label,
  children,
  span2,
}: {
  label: string
  children: React.ReactNode
  span2?: boolean
}) {
  return (
    <div className={`space-y-1.5 ${span2 ? "md:col-span-2" : ""}`}>
      <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</label>
      {children}
    </div>
  )
}

const inputCls =
  "w-full h-11 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"

const inputSmCls =
  "w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"

const textareaCls =
  "w-full rounded-xl border-2 border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all resize-none"

export function EditStudentForm({ 
  student, 
  role 
}: { 
  student: Student 
  role?: string 
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  // Personal
  const [firstName, setFirstName] = useState(student.firstName ?? student.name.split(" ")[0] ?? "")
  const [lastName, setLastName] = useState(student.lastName ?? student.name.split(" ").slice(1).join(" ") ?? "")
  const [email, setEmail] = useState(student.email ?? "")
  const [contact, setContact] = useState(student.contact ?? "")
  const [bloodGroup, setBloodGroup] = useState(student.bloodGroup ?? "")
  const [baseFee, setBaseFee] = useState(student.financial?.baseFee?.toString() ?? "0")
  const [customTerms, setCustomTerms] = useState(student.financial?.customTerms ?? "")
  const [changeReason, setChangeReason] = useState("")

  const initialBaseFee = student.financial?.baseFee?.toString() ?? "0"
  const initialCustomTerms = student.financial?.customTerms ?? ""
  const isFinancialChanged = baseFee !== initialBaseFee || customTerms !== initialCustomTerms
  const showReasonField = (student.financial?.isLocked && isFinancialChanged)

  // Address
  const [city, setCity] = useState(student.city ?? "")
  const [address, setAddress] = useState(student.address ?? "")
  const [localAddressDifferent, setLocalAddressDifferent] = useState(!!student.localAddress)
  const [localAddress, setLocalAddress] = useState(student.localAddress ?? "")

  // Parents & Guardian
  const [parent1Name, setParent1Name] = useState(student.parent1Name ?? "")
  const [parent1Phone, setParent1Phone] = useState(student.parent1Phone ?? "")
  const [parent1Email, setParent1Email] = useState(student.parent1Email ?? "")
  const [parent2Name, setParent2Name] = useState(student.parent2Name ?? "")
  const [parent2Phone, setParent2Phone] = useState(student.parent2Phone ?? "")
  const [parent2Email, setParent2Email] = useState(student.parent2Email ?? "")
  const [localGuardianName, setLocalGuardianName] = useState(student.localGuardianName ?? "")
  const [localGuardianPhone, setLocalGuardianPhone] = useState(student.localGuardianPhone ?? "")
  const [localGuardianEmail, setLocalGuardianEmail] = useState(student.localGuardianEmail ?? "")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!firstName || !lastName || !email || !contact) {
      setError("First name, last name, email and contact are required.")
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
          baseFee:            role === "ADMIN" ? baseFee : undefined,
          customTerms:        role === "ADMIN" ? customTerms : undefined,
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
      {role === "ADMIN" && (
        <div className="bg-indigo-50 border border-indigo-200 rounded-2xl p-6 space-y-4 shadow-sm">
          <div className="flex items-center gap-2">
            <p className="text-[10px] uppercase tracking-widest font-bold text-indigo-400">Admin Overrides</p>
            <span className="bg-indigo-600 text-[8px] text-white px-1.5 py-0.5 rounded-full font-black uppercase tracking-tighter">Admin Only</span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label="Base Fee Override">
              <input 
                type="number" 
                value={baseFee} 
                onChange={(e) => setBaseFee(e.target.value)} 
                placeholder="0" 
                className="w-full h-11 rounded-xl border-2 border-indigo-200 bg-white px-4 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all shadow-[0_4px_12px_rgba(79,70,229,0.08)]" 
              />
            </Field>
            <Field label="Custom Terms & Conditions" span2>
              <textarea
                value={customTerms}
                onChange={(e) => setCustomTerms(e.target.value)}
                rows={4}
                className={cn(textareaCls, "border-indigo-100 bg-white/50")}
                placeholder="Student-specific terms..."
              />
            </Field>
            {showReasonField && (
              <Field label="Reason for Change (Required)" span2>
                <input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  required
                  placeholder="e.g. Scholarship correction, fee restructure authorized by principal"
                  className={cn(inputCls, "border-amber-300 bg-amber-50 focus:border-amber-500")}
                />
              </Field>
            )}
            <div className="flex flex-col justify-end pb-1 md:col-span-2">
              <p className="text-[10px] font-bold text-indigo-500/60 uppercase tracking-widest leading-tight">Caution</p>
              <p className="text-[10.5px] font-medium text-indigo-600 leading-tight">
                {student.financial?.isLocked 
                  ? "This record is LOCKED. Any changes to financial fields will be logged with the provided reason."
                  : "Modifying these fields will automatically re-calculate the net fee based on existing discounts."}
              </p>
            </div>
          </div>
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
          disabled={loading}
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
    </form>
  )
}
