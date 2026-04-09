"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save } from "lucide-react"

export function ProposalSettings({ initialTerms }: { initialTerms: string }) {
  const [terms, setTerms] = useState(initialTerms)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSetting("PROPOSAL_TERMS", terms)
      toast.success("Terms & Conditions updated")
    } catch {
      toast.error("Failed to save. You must be an admin.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SoftCard className="p-6">
      <Eyebrow>Proposal Generation</Eyebrow>
      <h3 className="text-lg font-headline font-bold text-slate-900 mt-1 mb-4">
        Terms & Conditions Boilerplate
      </h3>
      <p className="text-sm font-medium text-slate-500 mb-4">
        This text will be automatically injected into the bottom of every generated PDF or Word proposal letter.
      </p>
      
      <Textarea
        value={terms}
        onChange={(e) => setTerms(e.target.value)}
        className="min-h-[200px] mb-4 font-mono text-xs"
        placeholder="1. Fees once paid are non-refundable..."
      />

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Settings</>
          )}
        </Button>
      </div>
    </SoftCard>
  )
}
