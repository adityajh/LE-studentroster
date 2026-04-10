"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save } from "lucide-react"

type OfferSettingsProps = {
  initial: {
    offerEmailBody: string
    offerLetterBody: string
    offerReminder1Body: string
    offerReminder2Body: string
    onboardingEmailBody: string
    bankDetails: string
    handbookUrl: string
    welcomeKitUrl: string
    year1Url: string
  }
}

type Field = {
  key: string
  label: string
  description: string
  placeholder: string
  rows: number
  isUrl?: boolean
}

const TEMPLATE_FIELDS: Field[] = [
  {
    key: "OFFER_EMAIL_BODY",
    label: "Offer Email Body",
    description: "Body text for the initial offer email. Merge fields: {{studentName}}, {{programName}}, {{batchYear}}, {{offerExpiryDate}}.",
    placeholder: "Hi {{studentName}},\n\nCongratulations! We are delighted to offer you admission...",
    rows: 8,
  },
  {
    key: "OFFER_LETTER_BODY",
    label: "Offer Letter Body (PDF)",
    description: "Body paragraph inside the offer letter PDF. Same merge fields as above.",
    placeholder: "We are pleased to offer you a place in the {{programName}} programme...",
    rows: 6,
  },
  {
    key: "OFFER_REMINDER_1_BODY",
    label: "Day-3 Reminder Email Body",
    description: "Sent 4 days before offer expiry. Merge fields: {{studentName}}, {{programName}}, {{daysLeft}}, {{offerExpiryDate}}.",
    placeholder: "Hi {{studentName}},\n\nJust a friendly reminder — your offer expires in {{daysLeft}} days...",
    rows: 7,
  },
  {
    key: "OFFER_REMINDER_2_BODY",
    label: "Day-6 Reminder Email Body",
    description: "Sent 1 day before offer expiry. Same merge fields as reminder 1.",
    placeholder: "Hi {{studentName}},\n\nYour offer expires tomorrow ({{offerExpiryDate}})...",
    rows: 7,
  },
  {
    key: "ONBOARDING_EMAIL_BODY",
    label: "Onboarding Email Body",
    description: "Sent after the ₹50K registration payment is confirmed. Merge fields: {{studentName}}, {{programName}}, {{batchYear}}, {{rollNo}}.",
    placeholder: "Hi {{studentName}},\n\nWelcome to Let's Enterprise! Your roll number is {{rollNo}}...",
    rows: 8,
  },
]

const URL_FIELDS: Field[] = [
  {
    key: "ONBOARDING_HANDBOOK_URL",
    label: "Student Handbook URL",
    description: "Linked in the onboarding email.",
    placeholder: "https://...",
    rows: 1,
    isUrl: true,
  },
  {
    key: "ONBOARDING_WELCOME_KIT_URL",
    label: "Welcome Kit URL",
    description: "Linked in the onboarding email.",
    placeholder: "https://...",
    rows: 1,
    isUrl: true,
  },
  {
    key: "ONBOARDING_YEAR1_URL",
    label: "Year 1 Resources URL",
    description: "Linked in the onboarding email.",
    placeholder: "https://...",
    rows: 1,
    isUrl: true,
  },
]

export function OfferSettings({ initial }: OfferSettingsProps) {
  const [values, setValues] = useState<Record<string, string>>({
    OFFER_EMAIL_BODY: initial.offerEmailBody,
    OFFER_LETTER_BODY: initial.offerLetterBody,
    OFFER_REMINDER_1_BODY: initial.offerReminder1Body,
    OFFER_REMINDER_2_BODY: initial.offerReminder2Body,
    ONBOARDING_EMAIL_BODY: initial.onboardingEmailBody,
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

  return (
    <div className="space-y-6">
      {/* Email Templates */}
      <SoftCard className="p-6 space-y-6">
        <div>
          <Eyebrow>Offer & Onboarding</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Email Templates</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Customise the body text for each automated email. Leave blank to use the built-in defaults.
          </p>
        </div>

        {TEMPLATE_FIELDS.map(({ key, label, description, placeholder, rows }) => (
          <div key={key} className="space-y-2">
            <div>
              <label className="block text-sm font-bold text-slate-700">{label}</label>
              <p className="text-xs font-medium text-slate-400 mt-0.5">{description}</p>
            </div>
            <Textarea
              value={values[key]}
              onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              className="font-mono text-xs"
              style={{ minHeight: `${rows * 24}px` }}
              placeholder={placeholder}
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
          </div>
        ))}
      </SoftCard>

      {/* Bank Details */}
      <SoftCard className="p-6 space-y-3">
        <div>
          <Eyebrow>Payments</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Bank Details</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            Included in all offer emails. Use plain text — one detail per line.
          </p>
        </div>
        <Textarea
          value={values["BANK_DETAILS"]}
          onChange={(e) => setValues((v) => ({ ...v, BANK_DETAILS: e.target.value }))}
          className="font-mono text-xs min-h-[120px]"
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

      {/* Resource URLs */}
      <SoftCard className="p-6 space-y-4">
        <div>
          <Eyebrow>Onboarding</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Resource Links</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            URLs attached in the onboarding email sent after enrolment is confirmed.
          </p>
        </div>

        {URL_FIELDS.map(({ key, label, description, placeholder }) => (
          <div key={key} className="space-y-1.5">
            <label className="block text-sm font-bold text-slate-700">{label}</label>
            <p className="text-xs font-medium text-slate-400">{description}</p>
            <div className="flex gap-2">
              <input
                type="url"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder={placeholder}
                className="flex-1 h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
              />
              <Button
                size="sm"
                onClick={() => handleSave(key)}
                disabled={saving === key}
                className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
              >
                {saving === key ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
        ))}
      </SoftCard>
    </div>
  )
}
