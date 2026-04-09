import { getSetting } from "@/app/actions/settings"
import { ProposalSettings } from "@/components/settings/proposal-settings"
import { Eyebrow, SoftCard } from "@/components/ui/brand"
import { Settings } from "lucide-react"

const DEFAULT_TERMS = `1. All fees laid out in the structure above must be paid on or before the due date.
2. In the event of withdrawal, the registration fee and deposit are strictly non-refundable.
3. The scholarship and waiver discounts have already been deducted from your base fee computation.`

export default async function SettingsPage() {
  const terms = await getSetting("PROPOSAL_TERMS", DEFAULT_TERMS)

  return (
    <div className="space-y-8 max-w-[1000px]">
      <div>
        <Eyebrow>Configuration</Eyebrow>
        <h1 className="text-2xl font-extrabold font-headline text-slate-900 mt-0.5">System Settings</h1>
      </div>
      
      <ProposalSettings initialTerms={terms} />

      <SoftCard className="p-16 text-center">
        <Settings className="h-10 w-10 mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-500">More settings coming in Phase 7</p>
        <p className="text-xs font-medium text-slate-400 mt-1">Team management, email config, API keys</p>
      </SoftCard>
    </div>
  )
}
