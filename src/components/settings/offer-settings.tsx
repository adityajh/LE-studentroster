"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, Paperclip, Link2, Zap, Lock, ChevronDown, Pencil, X, Plus, Trash2, Copy as CopyIcon, Info } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

export type ResourceLinkEntry = { key: string; label: string; url: string }

type OfferSettingsProps = {
  initial: {
    offerEmailBody: string
    offerLetterBody: string
    offerReminder1Body: string
    offerReminder2Body: string
    onboardingEmailBody: string
    enrolmentConfirmationEmailBody: string
    selfOnboardingLinkEmailBody: string
    bankDetails: string
    cashFreeLink: string
    resourceLinks: ResourceLinkEntry[]
  }
}

type CardState = "collapsed" | "preview" | "editing"

type EmailConfig = {
  settingKey: string | null      // null = not configurable (hardcoded)
  sharedWithLabel?: string       // if it reuses another key already shown above
  code?: string                  // workflow code shown on the card (e.g. O1, O2)
  label: string
  trigger: string
  recipients: string
  attachments?: string[]
  links?: string[]
  mergeFields?: string[]
  note?: string                  // extra note for non-configurable
  rows?: number
}

// ── Built-in defaults (shown in preview when DB value is empty) ───────────────

const DEFAULTS: Record<string, string> = {
  OFFER_EMAIL_BODY: `Hi {{studentName}},

Congratulations!

We are delighted to offer you admission to {{programName}} at Let's Enterprise.

This program is designed for students who are ready to learn by doing, reflect deeply, and grow through real-world exposure.

Step 1: Confirm Your Admission (Within 7 Days)

To secure your seat, please reply to this email confirming acceptance and pay the ₹50,000 registration fee within 7 days using the bank details below.

Seats are held for 7 days and allotted on a rolling basis.

We look forward to welcoming you.

Warm regards,
The Let's Enterprise Admissions Team`,

  OFFER_REMINDER_1_BODY: `Hi {{studentName}},

Just a friendly reminder — your offer for {{programName}} at Let's Enterprise expires in {{daysLeft}} days ({{offerExpiryDate}}).

To confirm your admission, please pay the ₹50,000 registration fee and reply to the admissions team.

Warm regards,
The Let's Enterprise Admissions Team`,

  OFFER_REMINDER_2_BODY: `Hi {{studentName}},

Your offer for {{programName}} expires tomorrow ({{offerExpiryDate}}).

Please pay the ₹50,000 registration fee today to secure your seat and retain the 7-day confirmation waiver.

Warm regards,
The Let's Enterprise Admissions Team`,

  ENROLMENT_CONFIRMATION_EMAIL_BODY: `Dear {{studentName}},

Congratulations! Your enrolment in {{programName}} at Let's Enterprise is now confirmed.

Your Roll Number: {{rollNo}}

Your personalised fee structure is attached to this email. Please review it carefully.

As the next step, please complete your profile using the link below. This link is valid until {{onboardingExpiryDate}}.`,

  SELF_ONBOARDING_LINK_EMAIL_BODY: `Dear {{studentName}},

Congratulations on your enrolment in {{programName}} at Let's Enterprise. You're one step away from completing your profile.

Please click the button below to fill in your details. The link expires on {{onboardingExpiryDate}}.`,

  ONBOARDING_EMAIL_BODY: `Hi {{studentName}},

You're officially in! Welcome to {{programName}} at Let's Enterprise.

We've bundled everything you need to get started on your journey below.

What You Should Do Now:
1. Read the Onboarding Handbook and Welcome Kit
2. Go through the Fee Structure document to understand timelines and benefits

Once this is done, our team will guide you through the remaining onboarding steps.

We are seriously pumped to have you with us.

Let's give it 100,
The Let's Enterprise Team`,
}

// ── Email catalogue (Payments group removed — managed in Reminders tab) ───────

const ADMISSIONS_EMAILS: EmailConfig[] = [
  {
    settingKey: "OFFER_EMAIL_BODY",
    label: "Offer Email",
    trigger: "Manual — \"Send Offer Email\" button on student profile",
    recipients: "Student + parent (if set)",
    attachments: ["Offer Letter PDF (with fee breakdown appendix)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    rows: 10,
  },
  {
    settingKey: "OFFER_LETTER_BODY",
    label: "Offer Letter — Opening Paragraph (PDF)",
    trigger: "Same as Offer Email — rendered as opening text inside the offer letter PDF",
    recipients: "Embedded in PDF",
    note: "Leave blank to omit the opening paragraph from the PDF.",
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    rows: 5,
  },
  {
    settingKey: "OFFER_REMINDER_1_BODY",
    label: "Offer Reminder 1 — 3–5 days before expiry",
    trigger: "Automatic — daily cron, sent once when 3–5 days remain on the offer window",
    recipients: "Student + parent (if set)",
    mergeFields: ["{{studentName}}", "{{programName}}", "{{daysLeft}}", "{{offerExpiryDate}}"],
    rows: 8,
  },
  {
    settingKey: "OFFER_REMINDER_2_BODY",
    label: "Offer Reminder 2 — 0–2 days before expiry",
    trigger: "Automatic — daily cron, sent once when 0–2 days remain on the offer window",
    recipients: "Student + parent (if set)",
    mergeFields: ["{{studentName}}", "{{programName}}", "{{daysLeft}}", "{{offerExpiryDate}}"],
    rows: 8,
  },
  {
    settingKey: "OFFER_EMAIL_BODY",
    sharedWithLabel: "Offer Email",
    label: "Revised Offer Email — 7-day waiver lapsed",
    trigger: "Automatic — daily cron, sent once after the 7-day window expires without a registration payment",
    recipients: "Student",
    attachments: ["Revised Offer Letter PDF (fee without 7-day waiver)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    rows: 10,
  },
]

const ENROLMENT_EMAILS: EmailConfig[] = [
  {
    settingKey: "ENROLMENT_CONFIRMATION_EMAIL_BODY",
    code: "O1",
    label: "Enrolment Confirmation",
    trigger: "Automatic — sent immediately when registration payment is confirmed (\"Confirm Enrolment\" dialog)",
    recipients: "Student (CC parent if set)",
    attachments: ["Fee Structure PDF (full schedule with installments)"],
    links: ["Onboarding self-service link (valid 14 days)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{rollNo}}", "{{onboardingExpiryDate}}"],
    rows: 10,
  },
]

const ONBOARDING_EMAILS: EmailConfig[] = [
  {
    settingKey: "SELF_ONBOARDING_LINK_EMAIL_BODY",
    code: "O2",
    label: "Self-Onboarding Link",
    trigger: "Manual — \"Send Onboarding Link\" button on student profile",
    recipients: "Student",
    links: ["Onboarding self-service link (valid 14 days)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{onboardingExpiryDate}}"],
    rows: 10,
  },
  {
    settingKey: null,
    code: "O3",
    label: "Onboarding Submitted Alert (internal)",
    trigger: "Automatic — sent to all admins when a student submits their self-onboarding form",
    recipients: "All admin team members",
    links: ["Student profile link (admin view)"],
    note: "Hardcoded — not configurable.",
    rows: 4,
  },
  {
    settingKey: "ONBOARDING_EMAIL_BODY",
    code: "O4",
    label: "Onboarding Welcome Email",
    trigger: "Automatic — sent when admin clicks \"Approve Profile\" on a SUBMITTED student. Also fired by the admin onboard wizard's final step.",
    recipients: "Student (CC parent if set)",
    attachments: ["Fee Structure PDF"],
    links: ["All resource links (auto-listed)"],
    mergeFields: ["{{studentName}}", "{{programName}}"],
    rows: 12,
  },
]

// ── Individual card ───────────────────────────────────────────────────────────

function EmailCard({
  email,
  currentValue,
  onSave,
}: {
  email: EmailConfig
  currentValue: string
  onSave: (key: string, value: string) => Promise<void>
}) {
  const [state, setState] = useState<CardState>("collapsed")
  const [draft, setDraft] = useState(currentValue)
  const [saving, setSaving] = useState(false)

  const key = email.settingKey
  const isShared = !!email.sharedWithLabel
  const isHardcoded = key === null
  const isConfigurable = !isHardcoded && !isShared

  // The body text to display in preview — DB value if set, else built-in default
  const effectiveBody = (key && currentValue) ? currentValue : (key ? DEFAULTS[key] ?? "" : "")
  const isCustomised = !!(key && currentValue)

  async function handleSave() {
    if (!key) return
    setSaving(true)
    try {
      await onSave(key, draft)
      setState("preview")
    } finally {
      setSaving(false)
    }
  }

  function handleCancel() {
    setDraft(currentValue) // restore
    setState("preview")
  }

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header — always visible, click to toggle preview */}
      <button
        type="button"
        onClick={() => setState((s) => s === "collapsed" ? "preview" : (s === "editing" ? "editing" : "collapsed"))}
        className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-slate-100/70 transition-colors border-b border-slate-200 flex items-start justify-between gap-3"
      >
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            {email.code && (
              <span className="text-[10px] font-black font-mono tracking-wider text-white bg-[#160E44] px-1.5 py-0.5 rounded">
                {email.code}
              </span>
            )}
            <p className="text-sm font-bold text-slate-800">{email.label}</p>
            {isCustomised && (
              <span className="text-[10px] uppercase tracking-widest font-bold text-indigo-600 bg-indigo-50 border border-indigo-200 px-1.5 py-0.5 rounded">
                Custom
              </span>
            )}
          </div>
          <div className="flex items-start gap-1.5">
            <Zap className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
            <p className="text-xs font-medium text-slate-500">{email.trigger}</p>
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            To: {email.recipients}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          {email.attachments?.map((a) => (
            <div key={a} className="flex items-center gap-1 text-xs font-medium text-violet-700">
              <Paperclip className="h-3 w-3" />{a}
            </div>
          ))}
          {email.links?.map((l) => (
            <div key={l} className="flex items-center gap-1 text-xs font-medium text-indigo-600">
              <Link2 className="h-3 w-3" />{l}
            </div>
          ))}
          <ChevronDown className={`h-4 w-4 text-slate-400 mt-1 transition-transform ${state !== "collapsed" ? "rotate-180" : ""}`} />
        </div>
      </button>

      {/* Expanded body */}
      {state !== "collapsed" && (
        <div className="p-4 space-y-3">
          {isHardcoded ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Lock className="h-3.5 w-3.5 shrink-0" />
              {email.note}
            </div>
          ) : isShared ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link2 className="h-3.5 w-3.5 shrink-0" />
              Uses the same body as <span className="font-semibold text-slate-600">{email.sharedWithLabel}</span> — edit it above.
            </div>
          ) : state === "preview" ? (
            /* ── Preview mode ─────────────────────────────────────────────── */
            <div className="space-y-3">
              {email.note && (
                <p className="text-xs font-medium text-slate-400">{email.note}</p>
              )}
              {/* Merge fields */}
              {email.mergeFields && (
                <div className="flex flex-wrap gap-1.5">
                  {email.mergeFields.map((f) => (
                    <code key={f} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{f}</code>
                  ))}
                </div>
              )}
              {/* Body preview */}
              <div className={`rounded-lg bg-slate-50 border border-slate-200 px-4 py-3 text-xs font-mono text-slate-600 whitespace-pre-wrap leading-relaxed ${!isCustomised ? "text-slate-400 italic" : ""}`}>
                {effectiveBody || "(no default — leave blank to omit)"}
              </div>
              {!isCustomised && (
                <p className="text-[10px] text-slate-400">Showing built-in default. Click Edit to customise.</p>
              )}
              <div className="flex justify-end">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setDraft(currentValue || DEFAULTS[key!] || ""); setState("editing") }}
                  className="gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit
                </Button>
              </div>
            </div>
          ) : (
            /* ── Edit mode ────────────────────────────────────────────────── */
            <div className="space-y-3">
              {email.note && (
                <p className="text-xs font-medium text-slate-400">{email.note}</p>
              )}
              {email.mergeFields && (
                <div className="flex flex-wrap gap-1.5">
                  {email.mergeFields.map((f) => (
                    <code key={f} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{f}</code>
                  ))}
                </div>
              )}
              <Textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                className="font-mono text-xs"
                style={{ minHeight: `${(email.rows ?? 8) * 22}px` }}
                placeholder={`Leave blank to use the built-in default…\n\n${DEFAULTS[key!] ?? ""}`}
              />
              <div className="flex items-center justify-between">
                {currentValue && (
                  <button
                    type="button"
                    onClick={() => { setDraft("") }}
                    className="text-xs text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    Reset to default
                  </button>
                )}
                <div className="flex gap-2 ml-auto">
                  <Button size="sm" variant="outline" onClick={handleCancel} className="gap-1.5 text-slate-600 border-slate-300">
                    <X className="h-3.5 w-3.5" /> Cancel
                  </Button>
                  <Button size="sm" onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5">
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                    Save
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Group ─────────────────────────────────────────────────────────────────────

function EmailGroup({
  title,
  emails,
  values,
  onSave,
}: {
  title: string
  emails: EmailConfig[]
  values: Record<string, string>
  onSave: (key: string, value: string) => Promise<void>
}) {
  return (
    <SoftCard className="p-6 space-y-3">
      <Eyebrow>{title}</Eyebrow>
      {emails.map((email, i) => (
        <EmailCard
          key={i}
          email={email}
          currentValue={email.settingKey ? (values[email.settingKey] ?? "") : ""}
          onSave={onSave}
        />
      ))}
    </SoftCard>
  )
}

// ── Slugify a label into a JS-identifier-safe merge tag key ──────────────────
function slugifyKey(label: string): string {
  const cleaned = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
  if (cleaned.length === 0) return ""
  return cleaned[0] + cleaned.slice(1).map((w) => w[0].toUpperCase() + w.slice(1)).join("")
}

function copyTag(tag: string) {
  navigator.clipboard.writeText(tag)
  toast.success(`Copied ${tag}`)
}

// ── Merge tag reference panel ────────────────────────────────────────────────
function TagPill({ tag, hint }: { tag: string; hint?: string }) {
  return (
    <button
      type="button"
      onClick={() => copyTag(tag)}
      title={hint ? `${hint} — click to copy` : "Click to copy"}
      className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded transition-colors"
    >
      <CopyIcon className="h-2.5 w-2.5 opacity-50" />
      {tag}
    </button>
  )
}

function MergeTagReference({ resourceLinks }: { resourceLinks: ResourceLinkEntry[] }) {
  const [open, setOpen] = useState(false)

  const rows: { title: string; tags: { tag: string; hint?: string }[] }[] = [
    {
      title: "Student",
      tags: [
        { tag: "{{studentName}}", hint: "Full name" },
        { tag: "{{rollNo}}", hint: "Roll number (post-enrolment)" },
        { tag: "{{programName}}", hint: "Programme name" },
        { tag: "{{batchYear}}", hint: "Batch year" },
      ],
    },
    {
      title: "Fees",
      tags: [
        { tag: "{{amount}}", hint: "Amount due (reminders)" },
        { tag: "{{installmentLabel}}", hint: "e.g. Year 1 Fee" },
        { tag: "{{dueDate}}", hint: "Installment due date" },
      ],
    },
    {
      title: "Windows",
      tags: [
        { tag: "{{offerExpiryDate}}", hint: "7-day offer expiry" },
        { tag: "{{daysLeft}}", hint: "Days left in offer window" },
        { tag: "{{onboardingExpiryDate}}", hint: "Self-onboard link expiry" },
      ],
    },
    {
      title: "Global",
      tags: [
        { tag: "{{bankDetails}}", hint: "From Bank Details below" },
        { tag: "{{cashFreeLink}}", hint: "From Cash Free Link below" },
        ...resourceLinks.map((l) => ({ tag: `{{${l.key}}}`, hint: l.label })),
      ],
    },
  ]

  const totalTags = rows.reduce((s, r) => s + r.tags.length, 0)

  return (
    <SoftCard className="p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Info className="h-4 w-4 text-indigo-600 shrink-0" />
        <Eyebrow>Merge Tags</Eyebrow>
        <span className="text-xs text-slate-400 font-medium">{totalTags} available · click to copy</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          {rows.map((r) => (
            <div key={r.title} className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 w-16 shrink-0">
                {r.title}
              </span>
              <div className="flex flex-wrap gap-1.5 flex-1">
                {r.tags.map((t) => (
                  <TagPill key={t.tag} tag={t.tag} hint={t.hint} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </SoftCard>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function OfferSettings({ initial }: OfferSettingsProps) {
  const [values, setValues] = useState<Record<string, string>>({
    OFFER_EMAIL_BODY: initial.offerEmailBody,
    OFFER_LETTER_BODY: initial.offerLetterBody,
    OFFER_REMINDER_1_BODY: initial.offerReminder1Body,
    OFFER_REMINDER_2_BODY: initial.offerReminder2Body,
    ONBOARDING_EMAIL_BODY: initial.onboardingEmailBody,
    ENROLMENT_CONFIRMATION_EMAIL_BODY: initial.enrolmentConfirmationEmailBody,
    SELF_ONBOARDING_LINK_EMAIL_BODY: initial.selfOnboardingLinkEmailBody,
    BANK_DETAILS: initial.bankDetails,
    CASH_FREE_LINK: initial.cashFreeLink,
  })
  const [urlSaving, setUrlSaving] = useState<string | null>(null)

  // Dynamic resource links state
  const [resourceLinks, setResourceLinks] = useState<ResourceLinkEntry[]>(initial.resourceLinks)
  const [savingResources, setSavingResources] = useState(false)

  const handleSave = async (key: string, value: string) => {
    await updateSetting(key, value)
    setValues((v) => ({ ...v, [key]: value }))
    toast.success("Saved")
  }

  const handleUrlSave = async (key: string) => {
    setUrlSaving(key)
    try {
      await updateSetting(key, values[key])
      toast.success("Saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setUrlSaving(null)
    }
  }

  function addResourceLink() {
    setResourceLinks((prev) => [...prev, { key: "", label: "", url: "" }])
  }

  function removeResourceLink(idx: number) {
    setResourceLinks((prev) => prev.filter((_, i) => i !== idx))
  }

  function updateResourceLink(idx: number, patch: Partial<ResourceLinkEntry>) {
    setResourceLinks((prev) =>
      prev.map((r, i) => {
        if (i !== idx) return r
        const next = { ...r, ...patch }
        // Auto-derive key from label when label changes and key was either empty
        // or still matched the previous auto-slug
        if (patch.label !== undefined) {
          const prevAutoKey = slugifyKey(r.label)
          if (!r.key || r.key === prevAutoKey) {
            next.key = slugifyKey(next.label)
          }
        }
        return next
      })
    )
  }

  async function saveResourceLinks() {
    // Validation: unique non-empty keys, valid URLs (or empty allowed for in-progress rows)
    const seen = new Set<string>()
    for (const l of resourceLinks) {
      if (!l.label.trim()) {
        toast.error("Each resource link needs a label.")
        return
      }
      const k = l.key.trim()
      if (!k || !/^[a-z][A-Za-z0-9]*$/.test(k)) {
        toast.error(`Invalid merge tag key for "${l.label}". Use a single word starting with a lowercase letter.`)
        return
      }
      if (seen.has(k)) {
        toast.error(`Duplicate merge tag key: {{${k}}}`)
        return
      }
      seen.add(k)
    }
    setSavingResources(true)
    try {
      await updateSetting("RESOURCE_LINKS_JSON", JSON.stringify(resourceLinks))
      toast.success("Resource links saved")
    } catch {
      toast.error("Failed to save resource links")
    } finally {
      setSavingResources(false)
    }
  }

  return (
    <div className="space-y-6">
      <MergeTagReference resourceLinks={resourceLinks} />

      <EmailGroup title="Admissions" emails={ADMISSIONS_EMAILS} values={values} onSave={handleSave} />
      <EmailGroup title="Enrolment" emails={ENROLMENT_EMAILS} values={values} onSave={handleSave} />
      <EmailGroup title="Onboarding" emails={ONBOARDING_EMAILS} values={values} onSave={handleSave} />

      {/* Bank Details */}
      <SoftCard className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Payments</Eyebrow>
            <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Bank Details</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Plain text — one detail per line. Available in any email via the merge tag.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyTag("{{bankDetails}}")}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
            title="Click to copy"
          >
            <CopyIcon className="h-3 w-3" />
            {"{{bankDetails}}"}
          </button>
        </div>
        <Textarea
          value={values["BANK_DETAILS"]}
          onChange={(e) => setValues((v) => ({ ...v, BANK_DETAILS: e.target.value }))}
          className="font-mono text-xs min-h-[100px]"
          placeholder={"Storysells Education Pvt. Ltd\nBank: ICICI Bank\nAccount No: 000505026869\nIFSC: ICIC0000005"}
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => handleUrlSave("BANK_DETAILS")}
            disabled={urlSaving === "BANK_DETAILS"}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {urlSaving === "BANK_DETAILS" ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>
            )}
          </Button>
        </div>
      </SoftCard>

      {/* Cash Free Link */}
      <SoftCard className="p-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Payments</Eyebrow>
            <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Cash Free Link</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Payment-gateway URL. Embed in any email body via the merge tag below.
            </p>
          </div>
          <button
            type="button"
            onClick={() => copyTag("{{cashFreeLink}}")}
            className="shrink-0 inline-flex items-center gap-1.5 text-xs font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-1 rounded hover:bg-indigo-100 transition-colors"
            title="Click to copy"
          >
            <CopyIcon className="h-3 w-3" />
            {"{{cashFreeLink}}"}
          </button>
        </div>
        <input
          type="url"
          value={values["CASH_FREE_LINK"]}
          onChange={(e) => setValues((v) => ({ ...v, CASH_FREE_LINK: e.target.value }))}
          placeholder="https://payments.cashfree.com/..."
          className="w-full h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => handleUrlSave("CASH_FREE_LINK")}
            disabled={urlSaving === "CASH_FREE_LINK"}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {urlSaving === "CASH_FREE_LINK" ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>
            )}
          </Button>
        </div>
      </SoftCard>

      {/* Resource Links — dynamic */}
      <SoftCard className="p-6 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Eyebrow>Onboarding</Eyebrow>
            <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Resource Links</h3>
            <p className="text-sm font-medium text-slate-500 mt-1">
              Each link gets a merge tag (auto-derived from the label). Use it in any email body. The Onboarding Welcome Email also auto-lists all links.
            </p>
          </div>
          <Button size="sm" variant="outline" onClick={addResourceLink} className="shrink-0 gap-1.5 text-indigo-600 border-indigo-200 hover:bg-indigo-50">
            <Plus className="h-3.5 w-3.5" /> Add Link
          </Button>
        </div>
        <div className="space-y-3">
          {resourceLinks.length === 0 && (
            <p className="text-xs text-slate-400 italic px-2 py-3 border border-dashed border-slate-200 rounded-xl text-center">No resource links yet. Click &quot;Add Link&quot; to create one.</p>
          )}
          {resourceLinks.map((link, idx) => {
            const tag = link.key ? `{{${link.key}}}` : "(set a label)"
            return (
              <div key={idx} className="border border-slate-200 rounded-xl p-3 space-y-2 bg-slate-50/40">
                <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2 items-start">
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Label</label>
                    <input
                      type="text"
                      value={link.label}
                      onChange={(e) => updateResourceLink(idx, { label: e.target.value })}
                      placeholder="Student Handbook"
                      className="w-full h-9 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold tracking-widest text-slate-400">URL</label>
                    <input
                      type="url"
                      value={link.url}
                      onChange={(e) => updateResourceLink(idx, { url: e.target.value })}
                      placeholder="https://..."
                      className="w-full h-9 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeResourceLink(idx)}
                    title="Remove"
                    className="mt-5 self-start p-2 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="pl-1">
                  <button
                    type="button"
                    onClick={() => link.key && copyTag(tag)}
                    disabled={!link.key}
                    className="inline-flex items-center gap-1.5 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title={link.key ? "Click to copy" : "Set a label first"}
                  >
                    <CopyIcon className="h-3 w-3" />
                    {tag}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveResourceLinks}
            disabled={savingResources}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {savingResources ? (
              <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-3.5 w-3.5 mr-1.5" /> Save Resource Links</>
            )}
          </Button>
        </div>
      </SoftCard>
    </div>
  )
}
