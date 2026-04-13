import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import Link from "next/link"
import { getSetting, getSettings } from "@/app/actions/settings"
import { getTeamMembers } from "@/app/actions/team"
import { getApiKeys } from "@/app/actions/api-keys"
import { ProposalSettings } from "@/components/settings/proposal-settings"
import { TeamTab } from "@/components/settings/team-tab"
import { ApiKeysTab } from "@/components/settings/api-keys-tab"
import { EmailTab } from "@/components/settings/email-tab"
import { OfferSettings } from "@/components/settings/offer-settings"
import { RemindersTab } from "@/components/settings/reminders-tab"
import { getReminderSettings } from "@/app/actions/reminder-settings"
import { Eyebrow } from "@/components/ui/brand"
import { cn } from "@/lib/utils"
import { Users, Key, Mail, FileText, Send, Bell } from "lucide-react"

const DEFAULT_TERMS = `1. All fees laid out in the structure above must be paid on or before the due date.
2. In the event of withdrawal, the registration fee and deposit are strictly non-refundable.
3. The scholarship and waiver discounts have already been deducted from your base fee computation.`

const TABS = [
  { id: "team",      label: "Team",      icon: Users },
  { id: "api-keys",  label: "API Keys",  icon: Key },
  { id: "email",     label: "Email",     icon: Mail },
  { id: "proposal",  label: "Proposal",  icon: FileText },
  { id: "offers",    label: "Offers",    icon: Send },
  { id: "reminders", label: "Reminders", icon: Bell },
] as const

type Tab = typeof TABS[number]["id"]

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab = "team" } = await searchParams

  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    select: { role: true, id: true },
  })
  if (dbUser?.role !== "ADMIN") redirect("/dashboard")

  // Load data for each tab
  const [members, apiKeys, emailSettings, terms, offerSettings, reminderSettings, lastRunRaw] = await Promise.all([
    getTeamMembers(),
    getApiKeys(),
    getSettings(["SMTP_USER", "SMTP_PASSWORD", "SMTP_FROM_NAME", "SMTP_FROM_EMAIL", "REMINDER_PAYMENT_URL"]),
    getSetting("PROPOSAL_TERMS", DEFAULT_TERMS),
    getSettings([
      "OFFER_EMAIL_BODY",
      "OFFER_LETTER_BODY",
      "OFFER_REMINDER_1_BODY",
      "OFFER_REMINDER_2_BODY",
      "ONBOARDING_EMAIL_BODY",
      "BANK_DETAILS",
      "ONBOARDING_HANDBOOK_URL",
      "ONBOARDING_WELCOME_KIT_URL",
      "ONBOARDING_YEAR1_URL",
    ]),
    getReminderSettings(),
    getSetting("CRON_LAST_RUN_FEE_REMINDERS", ""),
  ])

  const lastRun = lastRunRaw ? JSON.parse(lastRunRaw) : null

  const activeTab = (TABS.some(t => t.id === tab) ? tab : "team") as Tab

  return (
    <div className="space-y-8 max-w-[1000px]">
      <div>
        <Eyebrow>Configuration</Eyebrow>
        <h1 className="text-2xl font-extrabold font-headline text-slate-900 mt-0.5">System Settings</h1>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {TABS.map(({ id, label, icon: Icon }) => (
          <Link
            key={id}
            href={`/settings?tab=${id}`}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-sm font-bold rounded-t-lg transition-all border-b-2 -mb-px",
              activeTab === id
                ? "border-indigo-600 text-indigo-700 bg-indigo-50/50"
                : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {label}
          </Link>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {activeTab === "team" && (
          <TeamTab members={members} currentUserId={dbUser.id} />
        )}

        {activeTab === "api-keys" && (
          <ApiKeysTab keys={apiKeys} />
        )}

        {activeTab === "email" && (
          <EmailTab
            initial={{
              smtpUser:     emailSettings["SMTP_USER"] || "",
              smtpPassword: emailSettings["SMTP_PASSWORD"] || "",
              fromName:     emailSettings["SMTP_FROM_NAME"] || "Let's Enterprise",
              fromEmail:    emailSettings["SMTP_FROM_EMAIL"] || "",
              paymentUrl:   emailSettings["REMINDER_PAYMENT_URL"] || "",
            }}
          />
        )}

        {activeTab === "proposal" && (
          <ProposalSettings initialTerms={terms} />
        )}

        {activeTab === "offers" && (
          <OfferSettings
            initial={{
              offerEmailBody:     offerSettings["OFFER_EMAIL_BODY"] || "",
              offerLetterBody:    offerSettings["OFFER_LETTER_BODY"] || "",
              offerReminder1Body: offerSettings["OFFER_REMINDER_1_BODY"] || "",
              offerReminder2Body: offerSettings["OFFER_REMINDER_2_BODY"] || "",
              onboardingEmailBody:offerSettings["ONBOARDING_EMAIL_BODY"] || "",
              bankDetails:        offerSettings["BANK_DETAILS"] || "",
              handbookUrl:        offerSettings["ONBOARDING_HANDBOOK_URL"] || "",
              welcomeKitUrl:      offerSettings["ONBOARDING_WELCOME_KIT_URL"] || "",
              year1Url:           offerSettings["ONBOARDING_YEAR1_URL"] || "",
            }}
          />
        )}

        {activeTab === "reminders" && (
          <RemindersTab settings={reminderSettings} lastRun={lastRun} />
        )}
      </div>
    </div>
  )
}
