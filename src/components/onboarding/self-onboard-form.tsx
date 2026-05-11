"use client"

import React, { useState, useCallback } from "react"
import Image from "next/image"
import { CheckCircle, ChevronRight, ChevronLeft, Upload, Trash2, Loader2, User, Users, FileText, Eye, CheckSquare, Square } from "lucide-react"

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB

// ── Types ────────────────────────────────────────────────────────────────────

type DocumentEntry = {
  id: string
  type: string
  fileName: string
  fileUrl: string
}

export type OnboardInitialData = {
  studentId: string
  name: string
  firstName: string
  lastName: string
  email: string
  contact: string
  bloodGroup: string
  city: string
  address: string
  localAddress: string
  parent1Name: string
  parent1Email: string
  parent1Phone: string
  parent2Name: string
  parent2Email: string
  parent2Phone: string
  localGuardianName: string
  localGuardianPhone: string
  localGuardianEmail: string
  linkedinHandle: string
  instagramHandle: string
  universityChoice: string
  universityStatus: string
  programName: string
  batchYear: number
  selfOnboardingStatus: string
  documents: DocumentEntry[]
  expiresAt: string
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function Field({
  label,
  name,
  value,
  onChange,
  type = "text",
  placeholder = "",
  required = false,
  disabled = false,
  hint,
}: {
  label: string
  name: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400">
        {label}{required && <span className="text-rose-400 ml-0.5">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        className="h-10 rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm px-3 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#3663AD] focus:ring-1 focus:ring-[#3663AD]/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
      />
      {hint && <p className="text-[10px] text-slate-400">{hint}</p>}
    </div>
  )
}

// ── Document Upload Card ──────────────────────────────────────────────────────

const DOC_LABELS: Record<string, string> = {
  STUDENT_PHOTO: "Student Photo",
  TENTH_MARKSHEET: "10th Marksheet",
  TWELFTH_MARKSHEET: "12th Marksheet",
  ACCEPTANCE_LETTER: "University Acceptance Letter",
  AADHAR_CARD: "Aadhar Card",
  DRIVERS_LICENSE: "Driver's License / ID Proof",
}

const REQUIRED_DOC_TYPES: string[] = ["STUDENT_PHOTO", "AADHAR_CARD", "TWELFTH_MARKSHEET"]

function DocumentUploadCard({
  docType,
  existing,
  token,
  onUploaded,
  onDeleted,
  disabled,
  required,
}: {
  docType: string
  existing?: DocumentEntry
  token: string
  onUploaded: (doc: DocumentEntry) => void
  onDeleted: (id: string) => void
  disabled: boolean
  required?: boolean
}) {
  const [uploading, setUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [sizeError, setSizeError] = useState("")

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setSizeError("")
    if (file.size > MAX_FILE_SIZE) {
      setSizeError(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max 1 MB.`)
      e.target.value = ""
      return
    }
    setUploading(true)
    const fd = new FormData()
    fd.append("file", file)
    fd.append("type", docType)
    const res = await fetch(`/api/onboard/${token}/documents`, { method: "POST", body: fd })
    if (res.ok) {
      const doc = await res.json()
      onUploaded(doc)
    }
    setUploading(false)
    e.target.value = ""
  }, [docType, token, onUploaded])

  const handleDelete = useCallback(async () => {
    if (!existing) return
    setDeleting(true)
    await fetch(`/api/onboard/${token}/documents`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ docId: existing.id }),
    })
    onDeleted(existing.id)
    setDeleting(false)
  }, [existing, token, onDeleted])

  return (
    <div className="space-y-1">
      <div className="bg-white/90 backdrop-blur-sm border border-slate-200/60 rounded-2xl p-4 flex items-center gap-3 transition-all hover:shadow-sm">
        {/* Status square */}
        <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 transition-all ${
          existing ? "bg-emerald-500 shadow-sm shadow-emerald-200" : "bg-slate-100"
        }`}>
          {existing
            ? <CheckSquare className="h-4 w-4 text-white" />
            : <Square className="h-4 w-4 text-slate-400" />
          }
        </div>

        {/* File info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-slate-700">
            {DOC_LABELS[docType] ?? docType}
            {required && <span className="text-rose-400 ml-0.5">*</span>}
          </p>
          {existing ? (
            <a href={existing.fileUrl} target="_blank" rel="noopener noreferrer"
              className="text-[11px] text-[#3663AD] hover:underline truncate block">
              {existing.fileName}
            </a>
          ) : (
            <p className={`text-[11px] ${required ? "text-rose-500 font-medium" : "text-slate-400"}`}>
              {required ? "Required · max 1 MB" : "Not uploaded · max 1 MB"}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5 shrink-0">
          {existing && (
            <>
              <a href={existing.fileUrl} target="_blank" rel="noopener noreferrer"
                className="p-1.5 rounded-lg text-slate-400 hover:text-[#3663AD] hover:bg-[#3663AD]/5 transition-all">
                <Eye className="h-4 w-4" />
              </a>
              {!disabled && (
                <button onClick={handleDelete} disabled={deleting}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-all disabled:opacity-50">
                  {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              )}
            </>
          )}
          {!disabled && (
            <label className={`cursor-pointer flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg border-2 transition-all ${
              existing
                ? "border-slate-200 text-slate-500 hover:border-[#3663AD]/40 hover:text-[#3663AD] hover:bg-[#3663AD]/5"
                : "border-[#3663AD]/30 text-[#3663AD] bg-[#3663AD]/5 hover:bg-[#3663AD]/10"
            }`}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Uploading…" : existing ? "Replace" : "Upload"}
              <input type="file" className="hidden" onChange={handleFileChange} accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff" />
            </label>
          )}
        </div>
      </div>
      {sizeError && (
        <p className="text-[11px] text-rose-600 font-medium px-1">{sizeError}</p>
      )}
    </div>
  )
}

// ── Step Indicator (left panel) ───────────────────────────────────────────────

const STEPS = [
  { id: 1, label: "Personal Info", icon: User },
  { id: 2, label: "Family & Contacts", icon: Users },
  { id: 3, label: "Documents", icon: FileText },
  { id: 4, label: "Review & Submit", icon: Eye },
]

function StepIndicator({ current }: { current: number }) {
  return (
    <ol className="flex flex-col gap-3">
      {STEPS.map((step) => {
        const done = current > step.id
        const active = current === step.id
        const Icon = step.icon
        return (
          <li key={step.id} className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-all duration-300 ${
              done
                ? "bg-[#25BCBD] text-white"
                : active
                ? "bg-white text-[#160E44] shadow-lg shadow-white/20"
                : "bg-white/10 text-white/40"
            }`}>
              {done ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
            </div>
            <span className={`text-sm font-bold transition-all duration-300 ${
              active ? "text-white" : done ? "text-[#25BCBD]" : "text-white/40"
            }`}>
              {step.label}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

// ── Main Form Component ───────────────────────────────────────────────────────

type FormData = Omit<OnboardInitialData, "studentId" | "name" | "programName" | "batchYear" | "selfOnboardingStatus" | "documents" | "expiresAt">

export function SelfOnboardForm({ token, initialData }: { token: string; initialData: OnboardInitialData }) {
  const isApproved = initialData.selfOnboardingStatus === "APPROVED"
  const isSubmitted = initialData.selfOnboardingStatus === "SUBMITTED"
  const isReadOnly = isApproved

  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [submitted, setSubmitted] = useState(isSubmitted || isApproved)
  const [saveError, setSaveError] = useState("")

  const [form, setForm] = useState<FormData>({
    firstName: initialData.firstName,
    lastName: initialData.lastName,
    email: initialData.email,
    contact: initialData.contact,
    bloodGroup: initialData.bloodGroup,
    city: initialData.city,
    address: initialData.address,
    localAddress: initialData.localAddress,
    parent1Name: initialData.parent1Name,
    parent1Email: initialData.parent1Email,
    parent1Phone: initialData.parent1Phone,
    parent2Name: initialData.parent2Name,
    parent2Email: initialData.parent2Email,
    parent2Phone: initialData.parent2Phone,
    localGuardianName: initialData.localGuardianName,
    localGuardianPhone: initialData.localGuardianPhone,
    localGuardianEmail: initialData.localGuardianEmail,
    linkedinHandle: initialData.linkedinHandle,
    instagramHandle: initialData.instagramHandle,
    universityChoice: initialData.universityChoice,
    universityStatus: initialData.universityStatus,
  })

  const [documents, setDocuments] = useState<DocumentEntry[]>(initialData.documents)

  const setField = (key: keyof FormData) => (value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }))

  const saveProgress = async () => {
    setSaving(true)
    setSaveError("")
    const res = await fetch(`/api/onboard/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (!res.ok) setSaveError("Failed to save. Please try again.")
  }

  const handleNext = async () => {
    if (!isReadOnly) await saveProgress()
    setStep((s) => Math.min(s + 1, 4))
  }

  const handleBack = () => setStep((s) => Math.max(s - 1, 1))

  const validateBeforeSubmit = (): string | null => {
    const missing: string[] = []
    if (!form.parent1Name.trim()) missing.push("Parent / Guardian 1 name")
    if (!form.parent1Email.trim()) missing.push("Parent / Guardian 1 email")
    if (!form.parent1Phone.trim()) missing.push("Parent / Guardian 1 phone")
    if (!form.parent2Name.trim()) missing.push("Parent / Guardian 2 name")
    if (!form.parent2Email.trim()) missing.push("Parent / Guardian 2 email")
    if (!form.parent2Phone.trim()) missing.push("Parent / Guardian 2 phone")
    for (const docType of REQUIRED_DOC_TYPES) {
      if (!documents.find((d) => d.type === docType)) {
        missing.push(DOC_LABELS[docType] ?? docType)
      }
    }
    if (missing.length === 0) return null
    return `Please complete the following before submitting: ${missing.join(", ")}.`
  }

  const handleSubmit = async () => {
    const validationError = validateBeforeSubmit()
    if (validationError) {
      setSaveError(validationError)
      return
    }
    setSaving(true)
    setSaveError("")
    const res = await fetch(`/api/onboard/${token}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, submit: true }),
    })
    setSaving(false)
    if (res.ok) {
      setSubmitted(true)
    } else {
      const data = await res.json().catch(() => ({}))
      setSaveError(data.error ?? "Submission failed. Please try again.")
    }
  }

  // ── Submitted / Approved state ──────────────────────────────────────────────
  if (submitted && isApproved) {
    return (
      <div className="min-h-screen bg-[#160E44] flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#25BCBD]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-[#25BCBD]" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 font-headline">Profile Approved</h1>
          <p className="text-slate-300 text-sm leading-relaxed">Your profile has been verified by the Let's Enterprise team. Welcome aboard!</p>
          <p className="text-[#25BCBD] text-xs font-bold mt-4 uppercase tracking-widest">Work is the Curriculum</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-[#160E44] flex items-center justify-center p-6">
        <div className="bg-white/10 backdrop-blur-md border border-white/10 rounded-3xl p-10 max-w-md w-full text-center">
          <div className="w-16 h-16 rounded-full bg-[#3663AD]/20 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-8 w-8 text-[#3663AD]" />
          </div>
          <h1 className="text-2xl font-black text-white mb-2 font-headline">Form Submitted</h1>
          <p className="text-slate-300 text-sm leading-relaxed">
            Thank you, <strong className="text-white">{initialData.name}</strong>! Your profile is under review. The team will reach out shortly.
          </p>
          <p className="text-[#25BCBD] text-xs font-bold mt-4 uppercase tracking-widest">Work is the Curriculum</p>
        </div>
      </div>
    )
  }

  // ── Split-panel layout ──────────────────────────────────────────────────────
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left — Deep Blue panel */}
      <div className="relative bg-[#160E44] lg:w-[340px] lg:min-h-screen flex flex-col overflow-hidden">
        {/* Background pattern */}
        <div
          className="absolute inset-0 opacity-[0.04] bg-cover bg-center pointer-events-none"
          style={{ backgroundImage: "url(/le-pattern-2.png)" }}
        />

        <div className="relative z-10 flex flex-col h-full p-8 lg:p-10">
          {/* Logo */}
          <div className="mb-8">
            <Image
              src="/le-logo-white.png"
              alt="Let's Enterprise"
              width={160}
              height={48}
              className="h-10 w-auto object-contain"
              priority
            />
          </div>

          {/* Student info */}
          <div className="mb-8">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/40 mb-1">Enrolling</p>
            <h2 className="text-xl font-black text-white font-headline leading-tight">{initialData.name}</h2>
            <p className="text-sm text-[#25BCBD] font-bold mt-0.5">{initialData.programName}</p>
            <p className="text-xs text-white/40 mt-0.5">Batch of {initialData.batchYear}</p>
          </div>

          {/* Step indicator */}
          <StepIndicator current={step} />

          {/* Tagline */}
          <div className="mt-auto pt-8">
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/30">Let's Enterprise</p>
            <p className="text-sm font-bold text-white/60 mt-1 italic">Work is the Curriculum</p>
          </div>
        </div>
      </div>

      {/* Right — Form panel */}
      <div className="flex-1 bg-slate-50 flex flex-col">
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-2xl mx-auto p-6 lg:p-10">
            {/* Step header */}
            <div className="mb-6">
              <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD]">
                Step {step} of 4
              </p>
              <h1 className="text-2xl font-black text-slate-900 font-headline mt-0.5">
                {STEPS[step - 1].label}
              </h1>
              {isReadOnly && (
                <p className="text-xs font-medium text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-2 inline-block">
                  Your profile has been approved — no further edits are allowed.
                </p>
              )}
            </div>

            {/* Step 1 — Personal Info */}
            {step === 1 && (
              <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="First Name" name="firstName" value={form.firstName} onChange={setField("firstName")} required disabled={isReadOnly} />
                  <Field label="Last Name" name="lastName" value={form.lastName} onChange={setField("lastName")} required disabled={isReadOnly} />
                </div>
                <Field label="Email Address" name="email" value={form.email} onChange={setField("email")} type="email" required disabled={isReadOnly} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Field label="Mobile Number" name="contact" value={form.contact} onChange={setField("contact")} type="tel" required disabled={isReadOnly} />
                  <Field label="Blood Group" name="bloodGroup" value={form.bloodGroup} onChange={setField("bloodGroup")} placeholder="e.g. A+" disabled={isReadOnly} />
                </div>
                <Field label="Hometown / City" name="city" value={form.city} onChange={setField("city")} required disabled={isReadOnly} />
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 block mb-1">
                    Permanent Address
                  </label>
                  <textarea
                    value={form.address}
                    onChange={(e) => setField("address")(e.target.value)}
                    disabled={isReadOnly}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#3663AD] focus:ring-1 focus:ring-[#3663AD]/30 transition-all resize-none disabled:opacity-50"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 block mb-1">
                    Local Address (in Pune)
                  </label>
                  <textarea
                    value={form.localAddress}
                    onChange={(e) => setField("localAddress")(e.target.value)}
                    disabled={isReadOnly}
                    rows={3}
                    className="w-full rounded-xl border border-slate-200 bg-white/70 backdrop-blur-sm px-3 py-2 text-sm font-medium text-slate-800 placeholder:text-slate-300 focus:outline-none focus:border-[#3663AD] focus:ring-1 focus:ring-[#3663AD]/30 transition-all resize-none disabled:opacity-50"
                  />
                </div>
                <div className="border-t border-slate-100 pt-4">
                  <p className="text-[10px] uppercase tracking-[0.15em] font-bold text-slate-400 mb-3">Social & University</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <Field label="LinkedIn Handle" name="linkedinHandle" value={form.linkedinHandle} onChange={setField("linkedinHandle")} placeholder="your-name" hint="Just the handle, not the full URL" disabled={isReadOnly} />
                    <Field label="Instagram Handle" name="instagramHandle" value={form.instagramHandle} onChange={setField("instagramHandle")} placeholder="@username" disabled={isReadOnly} />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
                    <Field label="University Applied To" name="universityChoice" value={form.universityChoice} onChange={setField("universityChoice")} disabled={isReadOnly} />
                    <Field label="Admission Status" name="universityStatus" value={form.universityStatus} onChange={setField("universityStatus")} placeholder="e.g. Accepted, Pending" disabled={isReadOnly} />
                  </div>
                </div>
              </div>
            )}

            {/* Step 2 — Family & Contacts */}
            {step === 2 && (
              <div className="space-y-4">
                {/* Parent 1 */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD] mb-4">Parent / Guardian 1</p>
                  <div className="space-y-4">
                    <Field label="Full Name" name="parent1Name" value={form.parent1Name} onChange={setField("parent1Name")} required disabled={isReadOnly} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Email" name="parent1Email" value={form.parent1Email} onChange={setField("parent1Email")} type="email" required disabled={isReadOnly} />
                      <Field label="Phone" name="parent1Phone" value={form.parent1Phone} onChange={setField("parent1Phone")} type="tel" required disabled={isReadOnly} />
                    </div>
                  </div>
                </div>

                {/* Parent 2 */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD] mb-4">Parent / Guardian 2</p>
                  <div className="space-y-4">
                    <Field label="Full Name" name="parent2Name" value={form.parent2Name} onChange={setField("parent2Name")} required disabled={isReadOnly} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Email" name="parent2Email" value={form.parent2Email} onChange={setField("parent2Email")} type="email" required disabled={isReadOnly} />
                      <Field label="Phone" name="parent2Phone" value={form.parent2Phone} onChange={setField("parent2Phone")} type="tel" required disabled={isReadOnly} />
                    </div>
                  </div>
                </div>

                {/* Local Guardian */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 mb-4">Local Guardian in Pune <span className="text-slate-300 normal-case tracking-normal font-medium">(optional)</span></p>
                  <div className="space-y-4">
                    <Field label="Full Name" name="localGuardianName" value={form.localGuardianName} onChange={setField("localGuardianName")} disabled={isReadOnly} />
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Field label="Email" name="localGuardianEmail" value={form.localGuardianEmail} onChange={setField("localGuardianEmail")} type="email" disabled={isReadOnly} />
                      <Field label="Phone" name="localGuardianPhone" value={form.localGuardianPhone} onChange={setField("localGuardianPhone")} type="tel" disabled={isReadOnly} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Step 3 — Documents */}
            {step === 3 && (
              <div className="space-y-3">
                <p className="text-sm font-medium text-slate-500 mb-4">
                  Upload clear scans or photos. Accepted formats: PDF, JPG, PNG.
                  {!isReadOnly && " You can update files before submitting."}
                </p>
                {Object.keys(DOC_LABELS).map((docType) => (
                  <DocumentUploadCard
                    key={docType}
                    docType={docType}
                    existing={documents.find((d) => d.type === docType)}
                    token={token}
                    disabled={isReadOnly}
                    required={REQUIRED_DOC_TYPES.includes(docType)}
                    onUploaded={(doc) => setDocuments((prev) => [...prev.filter((d) => d.type !== docType), doc])}
                    onDeleted={(id) => setDocuments((prev) => prev.filter((d) => d.id !== id))}
                  />
                ))}
              </div>
            )}

            {/* Step 4 — Review & Submit */}
            {step === 4 && (
              <div className="space-y-4">
                {/* Personal */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD] mb-4">Personal Info</p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <ReviewField label="Name" value={`${form.firstName} ${form.lastName}`.trim() || initialData.name} />
                    <ReviewField label="Email" value={form.email} />
                    <ReviewField label="Phone" value={form.contact} />
                    <ReviewField label="Blood Group" value={form.bloodGroup} />
                    <ReviewField label="City" value={form.city} />
                    <ReviewField label="LinkedIn" value={form.linkedinHandle} />
                    <ReviewField label="University" value={form.universityChoice} />
                    <ReviewField label="Uni Status" value={form.universityStatus} />
                  </dl>
                </div>

                {/* Family */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD] mb-4">Family & Contacts</p>
                  <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                    <ReviewField label="Parent 1" value={form.parent1Name} />
                    <ReviewField label="P1 Phone" value={form.parent1Phone} />
                    {form.parent2Name && <ReviewField label="Parent 2" value={form.parent2Name} />}
                    {form.parent2Phone && <ReviewField label="P2 Phone" value={form.parent2Phone} />}
                    {form.localGuardianName && <ReviewField label="Local Guardian" value={form.localGuardianName} />}
                  </dl>
                </div>

                {/* Documents */}
                <div className="bg-white/90 backdrop-blur-md border border-slate-200/50 rounded-3xl p-6 shadow-sm">
                  <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#3663AD] mb-4">Documents</p>
                  <div className="space-y-2">
                    {Object.keys(DOC_LABELS).map((docType) => {
                      const doc = documents.find((d) => d.type === docType)
                      const required = REQUIRED_DOC_TYPES.includes(docType)
                      return (
                        <div key={docType} className="flex items-center justify-between">
                          <span className="text-xs font-medium text-slate-600">
                            {DOC_LABELS[docType]}
                            {required && <span className="text-rose-400 ml-0.5">*</span>}
                          </span>
                          {doc ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-2 py-0.5">
                              <CheckCircle className="h-3 w-3" /> Uploaded
                            </span>
                          ) : required ? (
                            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-200 rounded px-2 py-0.5">
                              Required — missing
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 font-medium">Not uploaded</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {saveError && (
                  <p className="text-sm text-rose-600 font-medium bg-rose-50 border border-rose-200 rounded-xl px-4 py-3">
                    {saveError}
                  </p>
                )}

                {!isReadOnly && (
                  <div className="bg-[#3663AD]/5 border border-[#3663AD]/20 rounded-2xl p-4 text-sm text-slate-600">
                    <p className="font-bold text-slate-800 mb-1">Ready to submit?</p>
                    <p>Once submitted, the Let's Enterprise team will review your profile. You won't be able to make changes after submission.</p>
                  </div>
                )}
              </div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between mt-8 pt-6 border-t border-slate-200">
              <button
                onClick={handleBack}
                disabled={step === 1}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-all disabled:opacity-0 disabled:pointer-events-none"
              >
                <ChevronLeft className="h-4 w-4" /> Back
              </button>

              <div className="flex items-center gap-3">
                {saveError && step < 4 && (
                  <p className="text-xs text-rose-500 font-medium">{saveError}</p>
                )}
                {step < 4 ? (
                  <button
                    onClick={handleNext}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#3663AD] hover:bg-[#25BCBD] text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md hover:shadow-lg hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:transform-none"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</>
                    ) : (
                      <>Continue <ChevronRight className="h-4 w-4" /></>
                    )}
                  </button>
                ) : !isReadOnly ? (
                  <button
                    onClick={handleSubmit}
                    disabled={saving}
                    className="flex items-center gap-2 bg-[#160E44] hover:bg-[#3663AD] text-white font-bold text-sm px-8 py-2.5 rounded-xl shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-60 disabled:transform-none"
                  >
                    {saving ? (
                      <><Loader2 className="h-4 w-4 animate-spin" /> Submitting…</>
                    ) : (
                      <><CheckCircle className="h-4 w-4" /> Submit Profile</>
                    )}
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function ReviewField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[10px] uppercase tracking-widest font-bold text-slate-400">{label}</dt>
      <dd className="font-semibold text-slate-800 mt-0.5">{value || <span className="text-slate-300 font-normal">—</span>}</dd>
    </div>
  )
}
