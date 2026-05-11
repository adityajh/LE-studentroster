"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, CheckCircle2, Upload, X, ChevronLeft, ChevronRight, Send, FileText, User, Mail } from "lucide-react"
import { cn } from "@/lib/utils"

// ── Types ─────────────────────────────────────────────────────────────────────

type DocumentType = "STUDENT_PHOTO" | "TENTH_MARKSHEET" | "TWELFTH_MARKSHEET" | "ACCEPTANCE_LETTER" | "AADHAR_CARD" | "DRIVERS_LICENSE"

const DOCUMENT_TYPES: { type: DocumentType; label: string; required: boolean }[] = [
  { type: "STUDENT_PHOTO",     label: "Student Photo",      required: true },
  { type: "TENTH_MARKSHEET",   label: "10th Marksheet",     required: true },
  { type: "TWELFTH_MARKSHEET", label: "12th Marksheet",     required: true },
  { type: "AADHAR_CARD",       label: "Aadhar Card",        required: true },
  { type: "ACCEPTANCE_LETTER", label: "Acceptance Letter",  required: false },
  { type: "DRIVERS_LICENSE",   label: "Driver's License",   required: false },
]

type ExistingDoc = { id: string; type: DocumentType; fileName: string; fileUrl: string }

type Props = {
  studentId: string
  studentName: string
  // Pre-filled profile fields
  bloodGroup: string | null
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
  // Existing docs
  existingDocs: ExistingDoc[]
  // Onboarding email already sent?
  onboardingEmailSentAt: Date | null
}

const STEPS = [
  { n: 1, label: "Student Profile", icon: User },
  { n: 2, label: "Documents",       icon: FileText },
  { n: 3, label: "Send Email",      icon: Mail },
]

// ── Component ─────────────────────────────────────────────────────────────────

export function OnboardWizard({
  studentId, studentName,
  bloodGroup: initBloodGroup,
  address: initAddress,
  localAddress: initLocalAddress,
  parent1Name: initP1Name, parent1Email: initP1Email, parent1Phone: initP1Phone,
  parent2Name: initP2Name, parent2Email: initP2Email, parent2Phone: initP2Phone,
  localGuardianName: initLGName, localGuardianPhone: initLGPhone, localGuardianEmail: initLGEmail,
  existingDocs,
  onboardingEmailSentAt,
}: Props) {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState("")

  // ── Step 1 state ─────────────────────────────────────────────────────────

  const [bloodGroup,  setBloodGroup]  = useState(initBloodGroup  ?? "")
  const [address,     setAddress]     = useState(initAddress     ?? "")
  const [localAddress, setLocalAddress] = useState(initLocalAddress ?? "")
  const [localDiff,   setLocalDiff]   = useState(!!initLocalAddress && initLocalAddress !== initAddress)
  const [p1Name,  setP1Name]  = useState(initP1Name  ?? "")
  const [p1Email, setP1Email] = useState(initP1Email ?? "")
  const [p1Phone, setP1Phone] = useState(initP1Phone ?? "")
  const [p2Name,  setP2Name]  = useState(initP2Name  ?? "")
  const [p2Email, setP2Email] = useState(initP2Email ?? "")
  const [p2Phone, setP2Phone] = useState(initP2Phone ?? "")
  const [lgName,  setLgName]  = useState(initLGName  ?? "")
  const [lgPhone, setLgPhone] = useState(initLGPhone ?? "")
  const [lgEmail, setLgEmail] = useState(initLGEmail ?? "")

  function validateProfile(): string | null {
    const missing: string[] = []
    if (!p1Name.trim()) missing.push("Parent / Guardian 1 name")
    if (!p1Email.trim()) missing.push("Parent / Guardian 1 email")
    if (!p1Phone.trim()) missing.push("Parent / Guardian 1 phone")
    if (!p2Name.trim()) missing.push("Parent / Guardian 2 name")
    if (!p2Email.trim()) missing.push("Parent / Guardian 2 email")
    if (!p2Phone.trim()) missing.push("Parent / Guardian 2 phone")
    if (missing.length === 0) return null
    return `Missing required fields: ${missing.join(", ")}.`
  }

  async function saveProfile() {
    const validation = validateProfile()
    if (validation) {
      setError(validation)
      return
    }
    setSaving(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bloodGroup: bloodGroup || null,
          address: address || null,
          localAddress: localDiff ? (localAddress || null) : (address || null),
          parent1Name: p1Name || null, parent1Email: p1Email || null, parent1Phone: p1Phone || null,
          parent2Name: p2Name || null, parent2Email: p2Email || null, parent2Phone: p2Phone || null,
          localGuardianName: lgName || null, localGuardianPhone: lgPhone || null, localGuardianEmail: lgEmail || null,
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to save") }
      router.refresh()
      setStep(2)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile")
    } finally {
      setSaving(false)
    }
  }

  // ── Step 2 state ─────────────────────────────────────────────────────────

  const [uploadedDocs, setUploadedDocs] = useState<Record<DocumentType, ExistingDoc | null>>(
    Object.fromEntries(
      DOCUMENT_TYPES.map(({ type }) => [type, existingDocs.find((d) => d.type === type) ?? null])
    ) as Record<DocumentType, ExistingDoc | null>
  )
  const [uploading, setUploading] = useState<DocumentType | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [pendingDocType, setPendingDocType] = useState<DocumentType | null>(null)

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !pendingDocType) return
    setUploading(pendingDocType)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", pendingDocType)
      const res = await fetch(`/api/students/${studentId}/documents`, { method: "POST", body: fd })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Upload failed") }
      const doc = await res.json()
      setUploadedDocs((prev) => ({ ...prev, [pendingDocType]: doc }))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(null)
      setPendingDocType(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  async function handleDeleteDoc(type: DocumentType) {
    const doc = uploadedDocs[type]
    if (!doc) return
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId: doc.id }),
      })
      if (!res.ok) throw new Error("Delete failed")
      setUploadedDocs((prev) => ({ ...prev, [type]: null }))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Delete failed")
    }
  }

  // ── Step 3 state ─────────────────────────────────────────────────────────

  const [sending, setSending] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [emailSent, setEmailSent] = useState(!!onboardingEmailSentAt)
  const [emailSentAt, setEmailSentAt] = useState<string | null>(
    onboardingEmailSentAt ? new Date(onboardingEmailSentAt).toLocaleString("en-IN") : null
  )

  async function handleSendEmail() {
    setSending(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/send-onboarding`, { method: "POST" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to send") }
      setEmailSent(true)
      setEmailSentAt(new Date().toLocaleString("en-IN"))
      router.refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to send onboarding email")
    } finally {
      setSending(false)
    }
  }

  async function handleCompleteOnboarding() {
    setCompleting(true)
    setError("")
    try {
      // Send onboarding email first if not yet sent
      if (!emailSent) {
        const emailRes = await fetch(`/api/students/${studentId}/send-onboarding`, { method: "POST" })
        if (!emailRes.ok) { const d = await emailRes.json(); throw new Error(d.error ?? "Failed to send onboarding email") }
        setEmailSent(true)
        setEmailSentAt(new Date().toLocaleString("en-IN"))
      }
      const res = await fetch(`/api/students/${studentId}/complete-onboarding`, { method: "POST" })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? "Failed to complete") }
      router.push(`/students/${studentId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to complete onboarding")
      setCompleting(false)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map(({ n, label }, i) => (
          <div key={n} className="flex items-center gap-2">
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold border-2",
              step === n ? "bg-indigo-600 border-indigo-600 text-white" :
              step > n  ? "bg-emerald-500 border-emerald-500 text-white" :
                          "bg-white border-slate-300 text-slate-400"
            )}>
              {step > n ? "✓" : n}
            </div>
            <span className={cn("text-sm font-medium", step === n ? "text-slate-900" : "text-slate-400")}>{label}</span>
            {i < STEPS.length - 1 && <div className="w-10 h-px bg-slate-200 mx-1" />}
          </div>
        ))}
      </div>

      {/* ── Step 1: Student Profile ── */}
      {step === 1 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-800">Student Profile</h2>
            <p className="text-sm text-slate-500 mt-0.5">Fill in all student details before sending the onboarding email.</p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Personal</p>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Blood Group</label>
              <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value)} placeholder="e.g. B+" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1">Home Address</label>
              <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Full home address" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={localDiff} onChange={(e) => setLocalDiff(e.target.checked)} className="rounded border-slate-300" />
              <span className="text-slate-700">Local / Pune address is different from home address</span>
            </label>
            {localDiff && (
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Local Address (Pune)</label>
                <textarea rows={3} className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  value={localAddress} onChange={(e) => setLocalAddress(e.target.value)} placeholder="Local/Pune address" />
              </div>
            )}
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Parent / Guardian 1</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Name",  value: p1Name,  set: setP1Name,  placeholder: "Parent name", required: true },
                { label: "Email", value: p1Email, set: setP1Email, placeholder: "parent@example.com", required: true },
                { label: "Phone", value: p1Phone, set: setP1Phone, placeholder: "+91 98765 43210", required: true },
              ].map(({ label, value, set, placeholder, required }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
                  </label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Parent / Guardian 2</p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Name",  value: p2Name,  set: setP2Name,  placeholder: "Parent name", required: true },
                { label: "Email", value: p2Email, set: setP2Email, placeholder: "parent@example.com", required: true },
                { label: "Phone", value: p2Phone, set: setP2Phone, placeholder: "+91 98765 43210", required: true },
              ].map(({ label, value, set, placeholder, required }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">
                    {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
                  </label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
            <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Local Guardian <span className="text-slate-300 font-normal normal-case tracking-normal">(if applicable)</span></p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                { label: "Name",  value: lgName,  set: setLgName,  placeholder: "Guardian name" },
                { label: "Phone", value: lgPhone, set: setLgPhone, placeholder: "+91 98765 43210" },
                { label: "Email", value: lgEmail, set: setLgEmail, placeholder: "guardian@example.com" },
              ].map(({ label, value, set, placeholder }) => (
                <div key={label}>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">{label}</label>
                  <input className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={value} onChange={(e) => set(e.target.value)} placeholder={placeholder} />
                </div>
              ))}
            </div>
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-end">
            <button type="button" onClick={saveProfile} disabled={saving}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Save & Continue <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 2: Documents ── */}
      {step === 2 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-800">Documents</h2>
            <p className="text-sm text-slate-500 mt-0.5">Upload the student&apos;s documents. Required documents are marked with *.</p>
          </div>

          <input ref={fileInputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" className="hidden"
            onChange={handleFileChange} />

          <div className="bg-white border border-slate-200 rounded-2xl divide-y divide-slate-100 shadow-sm overflow-hidden">
            {DOCUMENT_TYPES.map(({ type, label, required }) => {
              const doc = uploadedDocs[type]
              const isUploading = uploading === type
              return (
                <div key={type} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
                    </p>
                    {doc && (
                      <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer"
                        className="text-xs text-indigo-600 hover:underline truncate max-w-xs block">
                        {doc.fileName}
                      </a>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {doc ? (
                      <>
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Uploaded
                        </span>
                        <button type="button" onClick={() => handleDeleteDoc(type)}
                          className="text-slate-400 hover:text-rose-500 p-1">
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : isUploading ? (
                      <span className="flex items-center gap-1 text-xs text-slate-500">
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading…
                      </span>
                    ) : (
                      <button type="button"
                        onClick={() => { setPendingDocType(type); fileInputRef.current?.click() }}
                        className="flex items-center gap-1 text-xs font-semibold text-indigo-600 hover:text-indigo-800 border border-indigo-200 rounded-lg px-3 py-1.5">
                        <Upload className="w-3.5 h-3.5" /> Upload
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>

          {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex justify-between">
            <button type="button" onClick={() => { setError(""); setStep(1) }}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button
              type="button"
              onClick={() => {
                const missing = DOCUMENT_TYPES
                  .filter((d) => d.required && !uploadedDocs[d.type])
                  .map((d) => d.label)
                if (missing.length > 0) {
                  setError(`Please upload these required documents: ${missing.join(", ")}.`)
                  return
                }
                setError("")
                setStep(3)
              }}
              className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 text-white text-sm font-semibold rounded-xl hover:bg-indigo-700"
            >
              Continue to Email <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ── Step 3: Send Onboarding Email ── */}
      {step === 3 && (
        <div className="space-y-6">
          <div>
            <h2 className="text-base font-bold text-slate-800">Send Onboarding Email</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              Send the welcome email with the fee structure PDF attached to {studentName} and their parents.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
            <div className="space-y-2 text-sm text-slate-600">
              <p className="font-semibold text-slate-800">What gets sent:</p>
              <ul className="space-y-1 list-disc list-inside text-slate-600">
                <li>Welcome / onboarding email body</li>
                <li>Fee structure PDF (with complete payment schedule)</li>
                <li>Links to handbook, welcome kit &amp; year 1 programme flow (if configured)</li>
              </ul>
              <p className="text-xs text-slate-400 mt-2">
                Email body and resource links are configured under Settings → Email &amp; Onboarding.
              </p>
            </div>

            {emailSent && (
              <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
                <div>
                  <p className="text-sm font-semibold text-emerald-700">Onboarding email sent</p>
                  {emailSentAt && <p className="text-xs text-emerald-600">{emailSentAt}</p>}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>}

            <button type="button" onClick={handleCompleteOnboarding} disabled={completing}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-emerald-600 text-white text-sm font-bold rounded-xl hover:bg-emerald-700 disabled:opacity-60">
              {completing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Completing…</>
                : <><CheckCircle2 className="w-4 h-4" /> Complete Onboarding</>
              }
            </button>
          </div>

          <div className="flex justify-between">
            <button type="button" onClick={() => { setError(""); setStep(2) }}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50">
              <ChevronLeft className="w-4 h-4" /> Back
            </button>
            <button type="button" onClick={handleSendEmail} disabled={sending}
              className="flex items-center gap-1.5 px-4 py-2.5 border border-slate-200 text-slate-500 text-sm font-medium rounded-xl hover:bg-slate-50 disabled:opacity-50">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {emailSent ? "Resend Email" : "Send Onboarding Email"}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
