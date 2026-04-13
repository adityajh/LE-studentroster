"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, Clock } from "lucide-react"

type ChangelogEntry = { date: string; note: string }

function parseChangelog(raw: string): ChangelogEntry[] {
  try { return JSON.parse(raw) } catch { return [] }
}

export function ProposalSettings({
  initialTerms,
  initialChangelog,
}: {
  initialTerms: string
  initialChangelog: string
}) {
  const [terms, setTerms] = useState(initialTerms)
  const [changelogNote, setChangelogNote] = useState("")
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(parseChangelog(initialChangelog))
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSetting("PROPOSAL_TERMS", terms)

      // Append a new changelog entry
      const entry: ChangelogEntry = {
        date: new Date().toISOString(),
        note: changelogNote.trim() || "Updated",
      }
      const updated = [entry, ...changelog].slice(0, 20) // keep last 20
      await updateSetting("PROPOSAL_TERMS_CHANGELOG", JSON.stringify(updated))

      setChangelog(updated)
      setChangelogNote("")
      toast.success("Terms & Conditions saved")
    } catch {
      toast.error("Failed to save. You must be an admin.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <SoftCard className="p-6 space-y-4">
        <div>
          <Eyebrow>Terms & Conditions</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">
            T&C Boilerplate
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            This text is injected into the bottom of every generated fee proposal PDF.
          </p>
        </div>

        <Textarea
          value={terms}
          onChange={(e) => setTerms(e.target.value)}
          className="min-h-[200px] font-mono text-xs"
          placeholder="1. Fees once paid are non-refundable..."
        />

        <div className="flex items-center gap-3">
          <input
            type="text"
            value={changelogNote}
            onChange={(e) => setChangelogNote(e.target.value)}
            placeholder="Optional: note what changed (e.g. 'Added refund clause')"
            className="flex-1 h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
          />
          <Button onClick={handleSave} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
            {saving ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
            ) : (
              <><Save className="h-4 w-4 mr-2" /> Save T&C's</>
            )}
          </Button>
        </div>
      </SoftCard>

      {changelog.length > 0 && (
        <SoftCard className="p-6 space-y-3">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-bold text-slate-700">Change History</h3>
          </div>
          <div className="space-y-2">
            {changelog.slice(0, 8).map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-sm">
                <span className="text-xs font-mono text-slate-400 shrink-0 mt-0.5 w-32">
                  {new Date(entry.date).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <span className="text-slate-600 font-medium">{entry.note}</span>
              </div>
            ))}
          </div>
        </SoftCard>
      )}
    </div>
  )
}
