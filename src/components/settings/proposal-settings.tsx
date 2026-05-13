"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateSetting } from "@/app/actions/settings"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Loader2, Save, Clock, Pencil, X } from "lucide-react"

type ChangelogEntry = { date: string; note: string }

function parseChangelog(raw: string): ChangelogEntry[] {
  try { return JSON.parse(raw) } catch { return [] }
}

// ── Editable Block ────────────────────────────────────────────────────────────
// Reusable card that's read-only by default. Admin clicks Edit → textarea +
// Save / Cancel buttons. Save persists + appends a changelog entry.
function EditableBlock({
  title,
  description,
  storageKey,
  initialValue,
  initialChangelog,
  changelogKey,
  placeholder,
}: {
  title: string
  description: string
  storageKey: string
  initialValue: string
  initialChangelog: ChangelogEntry[]
  changelogKey: string
  placeholder: string
}) {
  const [value, setValue] = useState(initialValue)
  const [draft, setDraft] = useState(initialValue)
  const [editing, setEditing] = useState(false)
  const [changelog, setChangelog] = useState<ChangelogEntry[]>(initialChangelog)
  const [changelogNote, setChangelogNote] = useState("")
  const [saving, setSaving] = useState(false)

  const handleStartEdit = () => {
    setDraft(value)
    setChangelogNote("")
    setEditing(true)
  }

  const handleCancel = () => {
    setDraft(value)
    setChangelogNote("")
    setEditing(false)
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      await updateSetting(storageKey, draft)
      const entry: ChangelogEntry = {
        date: new Date().toISOString(),
        note: changelogNote.trim() || "Updated",
      }
      const updated = [entry, ...changelog].slice(0, 20)
      await updateSetting(changelogKey, JSON.stringify(updated))
      setValue(draft)
      setChangelog(updated)
      setChangelogNote("")
      setEditing(false)
      toast.success(`${title} saved`)
    } catch {
      toast.error("Failed to save. You must be an admin.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <SoftCard className="p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <Eyebrow>{title}</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">
            {title}
          </h3>
          <p className="text-sm font-medium text-slate-500 mt-1">{description}</p>
        </div>
        {!editing && (
          <Button
            size="sm"
            variant="outline"
            onClick={handleStartEdit}
            className="shrink-0 gap-1.5 text-slate-700 border-slate-300 hover:bg-slate-50"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit
          </Button>
        )}
      </div>

      {editing ? (
        <>
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="min-h-[200px] font-mono text-xs"
            placeholder={placeholder}
          />
          <div className="flex items-center gap-3">
            <input
              type="text"
              value={changelogNote}
              onChange={(e) => setChangelogNote(e.target.value)}
              placeholder="Optional: note what changed (e.g. 'Added refund clause')"
              className="flex-1 h-10 rounded-xl border-2 border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none transition-all"
            />
            <Button
              size="sm"
              variant="outline"
              onClick={handleCancel}
              disabled={saving}
              className="gap-1.5 text-slate-600 border-slate-300 hover:bg-slate-50 shrink-0"
            >
              <X className="h-3.5 w-3.5" /> Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              {saving ? (
                <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Saving…</>
              ) : (
                <><Save className="h-3.5 w-3.5 mr-1.5" /> Save</>
              )}
            </Button>
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <pre className="text-xs font-mono text-slate-700 whitespace-pre-wrap leading-relaxed">
            {value || <span className="text-slate-400 italic">(empty — click Edit to add)</span>}
          </pre>
        </div>
      )}

      {changelog.length > 0 && (
        <div className="border-t border-slate-100 pt-3 space-y-2">
          <div className="flex items-center gap-2">
            <Clock className="h-3.5 w-3.5 text-slate-400" />
            <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500">Change History</h4>
          </div>
          <div className="space-y-1.5">
            {changelog.slice(0, 8).map((entry, i) => (
              <div key={i} className="flex items-start gap-3 text-xs">
                <span className="font-mono text-slate-400 shrink-0 w-32">
                  {new Date(entry.date).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </span>
                <span className="text-slate-600 font-medium">{entry.note}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </SoftCard>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

const DEFAULT_PROGRAM_EXPECTATIONS = `1. Actively participate in all academic, project-based, and experiential components.
2. Demonstrate ownership of your learning, professional conduct, and collaboration.
3. Engage sincerely in real-world projects, apprenticeships, reviews, and feedback cycles.
4. Adhere to Let's Enterprise's academic guidelines, attendance norms, and code of conduct.`

export function ProposalSettings({
  initialTerms,
  initialChangelog,
  initialProgramExpectations,
  initialProgramExpectationsChangelog,
}: {
  initialTerms: string
  initialChangelog: string
  initialProgramExpectations: string
  initialProgramExpectationsChangelog: string
}) {
  return (
    <div className="space-y-6">
      <EditableBlock
        title="Terms & Conditions"
        description="Injected into every fee proposal PDF and the offer letter PDF appendix."
        storageKey="PROPOSAL_TERMS"
        changelogKey="PROPOSAL_TERMS_CHANGELOG"
        initialValue={initialTerms}
        initialChangelog={parseChangelog(initialChangelog)}
        placeholder="1. Fees once paid are non-refundable…"
      />

      <EditableBlock
        title="Programme Expectations"
        description="Injected into every fee proposal PDF and the offer letter PDF appendix, alongside Terms & Conditions."
        storageKey="PROGRAM_EXPECTATIONS"
        changelogKey="PROGRAM_EXPECTATIONS_CHANGELOG"
        initialValue={initialProgramExpectations || DEFAULT_PROGRAM_EXPECTATIONS}
        initialChangelog={parseChangelog(initialProgramExpectationsChangelog)}
        placeholder={DEFAULT_PROGRAM_EXPECTATIONS}
      />
    </div>
  )
}
