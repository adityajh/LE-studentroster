"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, Paperclip, Link2, Zap, Lock, ChevronDown, Pencil, X } from "lucide-react"

// ── Types ─────────────────────────────────────────────────────────────────────

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
    handbookUrl: string
    welcomeKitUrl: string
    year1Url: string
  }
}

type CardState = "collapsed" | "preview" | "editing"

type EmailConfig = {
  settingKey: string | null      // null = not configurable (hardcoded)
  sharedWithLabel?: string       // if it reuses another key already shown above
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
    label: "Self-Onboarding Link",
    trigger: "Manual — \"Send Onboarding Link\" button on student profile",
    recipients: "Student",
    links: ["Onboarding self-service link (valid 14 days)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{onboardingExpiryDate}}"],
    rows: 10,
  },
  {
    settingKey: "ONBOARDING_EMAIL_BODY",
    label: "Onboarding Welcome Email",
    trigger: "Manual — \"Complete Onboarding\" wizard (final step)",
    recipients: "Student (CC parent if set)",
    attachments: ["Fee Structure PDF"],
    links: ["Year 1 Resources URL", "Handbook URL", "Welcome Kit URL"],
    mergeFields: ["{{studentName}}", "{{programName}}"],
    rows: 12,
  },
  {
    settingKey: null,
    label: "Onboarding Submitted Alert (internal)",
    trigger: "Automatic — sent to all admins when a student submits their self-onboarding form",
    recipients: "All admin team members",
    links: ["Student profile link (admin view)"],
    note: "Hardcoded — not configurable.",
    rows: 4,
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
          <div className="flex items-center gap-2">
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
    ONBOARDING_HANDBOOK_URL: initial.handbookUrl,
    ONBOARDING_WELCOME_KIT_URL: initial.welcomeKitUrl,
    ONBOARDING_YEAR1_URL: initial.year1Url,
  })
  const [urlSaving, setUrlSaving] = useState<string | null>(null)

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

  return (
    <div className="space-y-6">
      <EmailGroup title="Admissions" emails={ADMISSIONS_EMAILS} values={values} onSave={handleSave} />
      <EmailGroup title="Enrolment" emails={ENROLMENT_EMAILS} values={values} onSave={handleSave} />
      <EmailGroup title="Onboarding" emails={ONBOARDING_EMAILS} values={values} onSave={handleSave} />

      {/* Bank Details */}
      <SoftCard className="p-6 space-y-3">
        <div>
          <Eyebrow>Payments</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Bank Details</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Included in all offer emails and offer letter PDFs. Use plain text — one detail per line.
          </p>
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

      {/* Onboarding Resource URLs */}
      <SoftCard className="p-6 space-y-4">
        <div>
          <Eyebrow>Onboarding</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Resource Links</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            URLs linked in the Onboarding Welcome Email.
          </p>
        </div>
        {[
          { key: "ONBOARDING_YEAR1_URL", label: "Year 1 Resources URL" },
          { key: "ONBOARDING_HANDBOOK_URL", label: "Student Handbook URL" },
          { key: "ONBOARDING_WELCOME_KIT_URL", label: "Welcome Kit URL" },
        ].map(({ key, label }) => (
          <div key={key} className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">{label}</label>
            <div className="flex gap-2">
              <input
                type="url"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder="https://..."
                className="flex-1 h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <Button
                size="sm"
                onClick={() => handleUrlSave(key)}
                disabled={urlSaving === key}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                {urlSaving === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </SoftCard>
    </div>
  )
}
