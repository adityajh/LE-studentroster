"use client"

import { useState } from "react"
import { toast } from "sonner"
import { updateReminderSetting } from "@/app/actions/reminder-settings"
import { Loader2, Play, CheckCircle2, AlertCircle, Copy as CopyIcon, Info, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type ReminderSetting = {
  id: string
  type: string
  daysOut: number
  bodyText: string
  isActive: boolean
}

type ResourceLinkRow = { key: string; label: string; url: string }

function copyTag(tag: string) {
  navigator.clipboard.writeText(tag)
  toast.success(`Copied ${tag}`)
}

type LastRunStats = {
  checked: number
  sent: number
  skipped: number
  failed: number
  runAt: string
} | null

const REMINDER_META: Record<string, { label: string; description: string; vars: string[] }> = {
  ONE_MONTH: {
    label: "1 Month Before",
    description: "Sent ~30 days before the installment due date.",
    vars: ["{{studentName}}", "{{installmentLabel}}", "{{amount}}", "{{dueDate}}"],
  },
  ONE_WEEK: {
    label: "1 Week Before",
    description: "Sent ~7 days before the installment due date.",
    vars: ["{{studentName}}", "{{installmentLabel}}", "{{amount}}", "{{dueDate}}"],
  },
  DUE_DATE: {
    label: "On Due Date",
    description: "Sent on the day the payment is due.",
    vars: ["{{studentName}}", "{{installmentLabel}}", "{{amount}}", "{{dueDate}}"],
  },
}

function ReminderCard({ setting }: { setting: ReminderSetting }) {
  const meta = REMINDER_META[setting.type] ?? { label: setting.type, description: "", vars: [] }
  const [bodyText, setBodyText] = useState(setting.bodyText)
  const [isActive, setIsActive] = useState(setting.isActive)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState("")

  const isDirty = bodyText !== setting.bodyText || isActive !== setting.isActive

  async function save() {
    setSaving(true)
    setError("")
    try {
      await updateReminderSetting(setting.type, { bodyText, isActive })
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn(
      "rounded-xl border p-5 space-y-4 transition-all",
      isActive ? "border-slate-200 bg-white" : "border-slate-200 bg-slate-50 opacity-60"
    )}>
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <p className="font-bold text-slate-900 text-sm">{meta.label}</p>
            {!isActive && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
                Disabled
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">{meta.description}</p>
        </div>
        {/* Active toggle */}
        <button
          type="button"
          onClick={() => setIsActive((v) => !v)}
          className={cn(
            "relative inline-flex h-5 w-9 items-center rounded-full transition-colors shrink-0",
            isActive ? "bg-emerald-500" : "bg-slate-300"
          )}
        >
          <span className={cn(
            "inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform",
            isActive ? "translate-x-4" : "translate-x-1"
          )} />
        </button>
      </div>

      <div className="space-y-1.5">
        <label className="block text-xs font-semibold text-slate-600">
          Email Body
        </label>
        <textarea
          rows={6}
          className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-y"
          value={bodyText}
          onChange={(e) => setBodyText(e.target.value)}
          placeholder="Write the reminder email body here..."
        />
      </div>

      {error && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{error}</p>
      )}

      <div className="flex justify-end">
        <button
          type="button"
          onClick={save}
          disabled={saving || !isDirty}
          className="flex items-center gap-1.5 px-4 py-2 bg-slate-900 text-white text-xs font-bold rounded-lg hover:bg-slate-700 disabled:opacity-40 transition-all"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <CheckCircle2 className="w-3 h-3" /> : null}
          {saved ? "Saved" : "Save"}
        </button>
      </div>
    </div>
  )
}

function MergeTagPanel({ resourceLinks }: { resourceLinks: ResourceLinkRow[] }) {
  const [open, setOpen] = useState(false)
  const reminderTags = [
    { tag: "{{studentName}}",     hint: "Student's full name" },
    { tag: "{{installmentLabel}}", hint: "e.g. Year 1 Fee" },
    { tag: "{{amount}}",          hint: "Amount due" },
    { tag: "{{dueDate}}",         hint: "Installment due date" },
  ]
  const globalTags = [
    { tag: "{{bankDetails}}",  hint: "From Settings → Emails → Bank Details" },
    { tag: "{{cashFreeLink}}", hint: "From Settings → Emails → Cash Free Link" },
    ...resourceLinks.map((l) => ({ tag: `{{${l.key}}}`, hint: l.label })),
  ]
  const total = reminderTags.length + globalTags.length

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 text-left"
      >
        <Info className="h-4 w-4 text-indigo-600 shrink-0" />
        <span className="text-[10px] uppercase font-bold tracking-widest text-slate-500">Merge Tags</span>
        <span className="text-xs text-slate-400 font-medium">{total} available · click to copy</span>
        <ChevronDown className={`h-4 w-4 text-slate-400 ml-auto transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 w-16 shrink-0">
              Reminder
            </span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {reminderTags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => copyTag(t.tag)}
                  title={`${t.hint} — click to copy`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded transition-colors"
                >
                  <CopyIcon className="h-2.5 w-2.5 opacity-50" />
                  {t.tag}
                </button>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="text-[10px] uppercase font-bold tracking-widest text-slate-400 w-16 shrink-0">
              Global
            </span>
            <div className="flex flex-wrap gap-1.5 flex-1">
              {globalTags.map((t) => (
                <button
                  key={t.tag}
                  type="button"
                  onClick={() => copyTag(t.tag)}
                  title={`${t.hint} — click to copy`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded transition-colors"
                >
                  <CopyIcon className="h-2.5 w-2.5 opacity-50" />
                  {t.tag}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export function RemindersTab({
  settings,
  lastRun,
  resourceLinks,
}: {
  settings: ReminderSetting[]
  lastRun: LastRunStats
  resourceLinks: ResourceLinkRow[]
}) {
  const [running, setRunning] = useState(false)
  const [runResult, setRunResult] = useState<{ sent: number; skipped: number; failed: number; runAt: string } | null>(null)
  const [runError, setRunError] = useState("")

  async function runNow() {
    setRunning(true)
    setRunError("")
    setRunResult(null)
    try {
      const res = await fetch("/api/cron/reminders", {
        headers: process.env.NEXT_PUBLIC_CRON_SECRET
          ? { Authorization: `Bearer ${process.env.NEXT_PUBLIC_CRON_SECRET}` }
          : {},
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Run failed")
      setRunResult({ sent: data.sent, skipped: data.skipped, failed: data.failed, runAt: data.runAt })
    } catch (e) {
      setRunError(e instanceof Error ? e.message : "Run failed")
    } finally {
      setRunning(false)
    }
  }

  const displayRun = runResult ?? lastRun

  // Sort so ONE_MONTH → ONE_WEEK → DUE_DATE
  const ORDER = ["ONE_MONTH", "ONE_WEEK", "DUE_DATE"]
  const sorted = [...settings].sort((a, b) => ORDER.indexOf(a.type) - ORDER.indexOf(b.type))

  return (
    <div className="space-y-8">
      {/* Header + Run Now */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-slate-800">Fee Payment Reminders</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Runs daily at 7 AM IST. Sends to student + parent email. Each reminder type fires once per installment.
          </p>
        </div>
        <button
          type="button"
          onClick={runNow}
          disabled={running}
          className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-xs font-bold rounded-lg hover:bg-indigo-700 disabled:opacity-60 shrink-0"
        >
          {running ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
          Run Now
        </button>
      </div>

      {/* Last run stats */}
      {displayRun && (
        <div className={cn(
          "rounded-xl border px-4 py-3 flex items-center gap-6 text-sm",
          (displayRun.failed ?? 0) > 0 ? "border-amber-200 bg-amber-50" : "border-emerald-200 bg-emerald-50"
        )}>
          {(displayRun.failed ?? 0) > 0
            ? <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
            : <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          }
          <div className="flex gap-6 flex-wrap text-xs">
            <span><strong>{displayRun.sent}</strong> sent</span>
            <span><strong>{displayRun.skipped}</strong> skipped</span>
            <span><strong>{displayRun.failed}</strong> failed</span>
          </div>
          <span className="text-xs text-slate-400 ml-auto">
            {new Date(displayRun.runAt).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>
      )}

      {runError && (
        <p className="text-xs text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{runError}</p>
      )}

      <MergeTagPanel resourceLinks={resourceLinks} />

      {/* Reminder cards */}
      <div className="space-y-4">
        {sorted.length === 0 ? (
          <p className="text-sm text-slate-400 italic">No reminder settings found. Run the seed script to initialise defaults.</p>
        ) : (
          sorted.map((s) => <ReminderCard key={s.type} setting={s} />)
        )}
      </div>
    </div>
  )
}
