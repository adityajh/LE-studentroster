"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, Paperclip, Link2, Zap, Lock } from "lucide-react"

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

type EmailConfig = {
  settingKey: string | null        // null = not configurable (hardcoded)
  label: string
  trigger: string
  recipients: string
  attachments?: string[]
  links?: string[]
  mergeFields?: string[]
  description?: string
  rows?: number
  isUrl?: boolean
  sharedWith?: string             // label of another email that shares this body
}

// ── Email catalogue ────────────────────────────────────────────────────────────
//
// Groups: ADMISSIONS, ENROLMENT, ONBOARDING, PAYMENTS
//

const ADMISSIONS_EMAILS: EmailConfig[] = [
  {
    settingKey: "OFFER_EMAIL_BODY",
    label: "Offer Email",
    trigger: "Manual — \"Send Offer Email\" button on student profile",
    recipients: "Student + parent (if set)",
    attachments: ["Offer Letter PDF (with fee breakdown appendix)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    rows: 8,
  },
  {
    settingKey: "OFFER_LETTER_BODY",
    label: "Offer Letter Body (inside PDF)",
    trigger: "Same as Offer Email — rendered inside the offer letter PDF attachment",
    recipients: "Embedded in PDF",
    attachments: [],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    description: "Opening paragraph rendered inside the offer letter PDF. If left blank, no opening paragraph is shown.",
    rows: 5,
  },
  {
    settingKey: "OFFER_REMINDER_1_BODY",
    label: "Offer Reminder 1 (3–5 days before expiry)",
    trigger: "Automatic — daily cron, sent once when 3–5 days remain on offer window",
    recipients: "Student + parent (if set)",
    attachments: [],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{daysLeft}}", "{{offerExpiryDate}}"],
    rows: 7,
  },
  {
    settingKey: "OFFER_REMINDER_2_BODY",
    label: "Offer Reminder 2 (0–2 days before expiry)",
    trigger: "Automatic — daily cron, sent once when 0–2 days remain on offer window",
    recipients: "Student + parent (if set)",
    attachments: [],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{daysLeft}}", "{{offerExpiryDate}}"],
    rows: 7,
  },
  {
    settingKey: "OFFER_EMAIL_BODY",
    label: "Revised Offer Email (7-day waiver lapsed)",
    trigger: "Automatic — daily cron, sent once after 7-day window expires without registration payment",
    recipients: "Student",
    attachments: ["Revised Offer Letter PDF (fee without 7-day waiver)"],
    mergeFields: ["{{studentName}}", "{{programName}}", "{{batchYear}}", "{{offerExpiryDate}}"],
    sharedWith: "Offer Email",
    rows: 8,
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
    description: "If left blank, uses a built-in default that shows roll number and onboarding link.",
    rows: 8,
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
    description: "If left blank, uses a built-in default with the onboarding link and expiry date.",
    rows: 8,
  },
  {
    settingKey: "ONBOARDING_EMAIL_BODY",
    label: "Onboarding Welcome Email",
    trigger: "Manual — \"Complete Onboarding\" wizard (final step)",
    recipients: "Student (CC parent if set)",
    attachments: ["Fee Structure PDF"],
    links: ["Year 1 Resources URL", "Handbook URL", "Welcome Kit URL"],
    mergeFields: ["{{studentName}}", "{{programName}}"],
    rows: 8,
  },
  {
    settingKey: null,
    label: "Onboarding Submitted Alert (to team)",
    trigger: "Automatic — sent to all admin team members when student submits self-onboarding form",
    recipients: "All admin team members",
    links: ["Student profile link (admin view)"],
    description: "Hardcoded. Not configurable.",
    rows: 4,
  },
]

const PAYMENT_EMAILS: EmailConfig[] = [
  {
    settingKey: null,
    label: "Payment Receipt",
    trigger: "Automatic — sent each time a payment is recorded",
    recipients: "Student",
    attachments: ["Payment Receipt PDF"],
    description: "Hardcoded. Not configurable.",
    rows: 4,
  },
  {
    settingKey: null,
    label: "Fee Reminders",
    trigger: "Automatic — cron on configured schedule (1 month, 1 week, due date)",
    recipients: "Student",
    description: "Configured in the Reminders tab.",
    rows: 4,
  },
]

// ── Component ─────────────────────────────────────────────────────────────────

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
  const [saving, setSaving] = useState<string | null>(null)

  const handleSave = async (key: string) => {
    setSaving(key)
    try {
      await updateSetting(key, values[key])
      toast.success("Saved")
    } catch {
      toast.error("Failed to save")
    } finally {
      setSaving(null)
    }
  }

  function EmailCard({ email, seenKeys }: { email: EmailConfig; seenKeys: Set<string> }) {
    const key = email.settingKey
    const isShared = key !== null && seenKeys.has(key)

    return (
      <div className="border border-slate-200 rounded-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-4 py-3 bg-slate-50 border-b border-slate-200">
          <div className="min-w-0">
            <p className="text-sm font-bold text-slate-800">{email.label}</p>
            <div className="flex items-start gap-1.5 mt-1">
              <Zap className="h-3 w-3 text-slate-400 mt-0.5 shrink-0" />
              <p className="text-xs font-medium text-slate-500">{email.trigger}</p>
            </div>
            <div className="flex flex-wrap gap-3 mt-1.5">
              {email.recipients && (
                <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                  To: {email.recipients}
                </span>
              )}
            </div>
          </div>
          <div className="flex flex-col gap-1 shrink-0 text-right">
            {email.attachments?.map((a) => (
              <div key={a} className="flex items-center gap-1 text-xs font-medium text-violet-700">
                <Paperclip className="h-3 w-3" />
                {a}
              </div>
            ))}
            {email.links?.map((l) => (
              <div key={l} className="flex items-center gap-1 text-xs font-medium text-indigo-600">
                <Link2 className="h-3 w-3" />
                {l}
              </div>
            ))}
          </div>
        </div>

        {/* Body editor */}
        <div className="p-4 space-y-3">
          {key === null ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Lock className="h-3.5 w-3.5" />
              {email.description}
            </div>
          ) : isShared ? (
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Link2 className="h-3.5 w-3.5" />
              Uses the same body as <span className="font-semibold text-slate-600">{email.sharedWith}</span> — edit it above.
            </div>
          ) : (
            <>
              {email.description && (
                <p className="text-xs font-medium text-slate-400">{email.description}</p>
              )}
              {email.mergeFields && email.mergeFields.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {email.mergeFields.map((f) => (
                    <code key={f} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-mono">{f}</code>
                  ))}
                </div>
              )}
              <Textarea
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                className="font-mono text-xs"
                style={{ minHeight: `${(email.rows ?? 6) * 24}px` }}
                placeholder="Leave blank to use the built-in default…"
              />
              <div className="flex justify-end">
                <Button
                  size="sm"
                  onClick={() => handleSave(key)}
                  disabled={saving === key}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  {saving === key ? (
                    <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving...</>
                  ) : (
                    <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>
                  )}
                </Button>
              </div>
            </>
          )}
        </div>
      </div>
    )
  }

  function EmailGroup({ title, emails }: { title: string; emails: EmailConfig[] }) {
    const seenKeys = new Set<string>()
    return (
      <SoftCard className="p-6 space-y-4">
        <div>
          <Eyebrow>{title}</Eyebrow>
        </div>
        {emails.map((email, i) => {
          const card = <EmailCard key={i} email={email} seenKeys={seenKeys} />
          if (email.settingKey) seenKeys.add(email.settingKey)
          return card
        })}
      </SoftCard>
    )
  }

  return (
    <div className="space-y-6">
      <EmailGroup title="Admissions" emails={ADMISSIONS_EMAILS} />
      <EmailGroup title="Enrolment" emails={ENROLMENT_EMAILS} />
      <EmailGroup title="Onboarding" emails={ONBOARDING_EMAILS} />
      <EmailGroup title="Payments" emails={PAYMENT_EMAILS} />

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
            onClick={() => handleSave("BANK_DETAILS")}
            disabled={saving === "BANK_DETAILS"}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {saving === "BANK_DETAILS" ? (
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
                onClick={() => handleSave(key)}
                disabled={saving === key}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                {saving === key ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </div>
        ))}
      </SoftCard>
    </div>
  )
}
