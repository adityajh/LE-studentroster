"use client"

import { useState, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Plus, Trash2, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { formatINR } from "@/lib/fee-schedule"

// ─── Types ────────────────────────────────────────────────────────────────────

type InstallmentStatus = "UPCOMING" | "DUE" | "OVERDUE" | "PARTIAL" | "PAID"

type ExistingInstallment = {
  id: string
  label: string
  dueDate: Date
  amount: { toString(): string }
  year: number
  status: InstallmentStatus
  paidAmount?: { toString(): string } | null
}

type EditRow = {
  /** undefined = new row */
  id?: string
  label: string
  dueDate: string    // "YYYY-MM-DD"
  amount: string     // string for controlled input
  year: number
  status: InstallmentStatus
  _delete?: boolean
  _isNew?: boolean
}

type Financial = {
  netFee: { toString(): string }
  isLocked: boolean
  installmentType: string
} | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInput(d: Date): string {
  return new Date(d).toISOString().slice(0, 10)
}

const STATUS_STYLES: Record<InstallmentStatus, string> = {
  PAID:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARTIAL:  "bg-amber-50 text-amber-700 border-amber-200",
  DUE:      "bg-rose-50 text-rose-700 border-rose-200",
  OVERDUE:  "bg-rose-100 text-rose-800 border-rose-300",
  UPCOMING: "bg-slate-50 text-slate-500 border-slate-200",
}

const inputCls = "h-9 rounded-lg border-2 border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 focus:border-indigo-500 focus:outline-none transition-all w-full"
const inputLockedCls = "h-9 rounded-lg border-2 border-slate-100 bg-slate-50 px-3 text-sm font-semibold text-slate-400 cursor-not-allowed w-full"

// ─── Component ────────────────────────────────────────────────────────────────

export function InstallmentEditor({
  installments,
  financial,
  isAdmin,
  studentId,
}: {
  installments: ExistingInstallment[]
  financial: Financial
  isAdmin: boolean
  studentId: string
}) {
  const router = useRouter()
  const netFee = financial ? Number(financial.netFee.toString()) : 0

  // Initialise rows sorted by dueDate
  const [rows, setRows] = useState<EditRow[]>(() =>
    [...installments]
      .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .map(i => ({
        id:     i.id,
        label:  i.label,
        dueDate: toDateInput(new Date(i.dueDate)),
        amount: String(Number(i.amount.toString())),
        year:   i.year,
        status: i.status,
      }))
  )

  const [changeReason, setChangeReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [saved, setSaved] = useState(false)

  // ── Derived ──
  const activeRows = rows.filter(r => !r._delete)
  const total = activeRows.reduce((s, r) => s + (parseFloat(r.amount) || 0), 0)
  const totalMatchesNet = Math.abs(total - netFee) < 1
  const hasChanges = rows.some(
    r => r._delete || r._isNew ||
      (() => {
        const orig = installments.find(i => i.id === r.id)
        if (!orig) return false
        return (
          r.label !== orig.label ||
          r.dueDate !== toDateInput(new Date(orig.dueDate)) ||
          parseFloat(r.amount) !== Number(orig.amount.toString()) ||
          r.year !== orig.year
        )
      })()
  )
  const showReasonField = financial?.isLocked && hasChanges

  // ── Mutation helpers ──
  const updateRow = useCallback((idx: number, patch: Partial<EditRow>) => {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r))
  }, [])

  const deleteRow = useCallback((idx: number) => {
    setRows(prev => prev.map((r, i) => {
      if (i !== idx) return r
      if (r._isNew) return { ...r, _delete: true } // just hide new rows
      return { ...r, _delete: true }
    }))
  }, [])

  const addRow = useCallback(() => {
    const lastActive = [...rows].filter(r => !r._delete).at(-1)
    setRows(prev => [...prev, {
      label:   "",
      dueDate: "",
      amount:  "",
      year:    lastActive?.year ?? 1,
      status:  "UPCOMING",
      _isNew:  true,
    }])
  }, [rows])

  // ── Submit ──
  const handleSave = async () => {
    if (!isAdmin) return
    if (showReasonField && !changeReason.trim()) {
      setError("Reason for change is required for locked records.")
      return
    }

    const payload = rows
      .filter(r => !(r._isNew && r._delete)) // skip new rows that were immediately deleted
      .map(r => ({
        id:       r.id,
        label:    r.label,
        dueDate:  r.dueDate,
        amount:   parseFloat(r.amount) || 0,
        year:     r.year,
        _delete:  r._delete ? true : undefined,
      }))

    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/installments`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installments: payload, changeReason: changeReason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Save failed")
      setSaved(true)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }

  // ─── Read-only view (staff) ───────────────────────────────────────────────

  if (!isAdmin) {
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">Label</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">Due Date</th>
              <th className="text-right text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">Amount</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">Year</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-slate-400 px-4 py-2.5">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {activeRows.map((r, idx) => (
              <tr key={r.id ?? idx} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-4 py-3 font-semibold text-slate-800">{r.label || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-500">{r.dueDate}</td>
                <td className="px-4 py-3 text-right font-bold text-slate-800">{formatINR(parseFloat(r.amount) || 0)}</td>
                <td className="px-4 py-3 text-slate-500 text-xs">Year {r.year === 0 ? "Reg" : r.year}</td>
                <td className="px-4 py-3">
                  <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border", STATUS_STYLES[r.status])}>
                    {r.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="px-4 py-3 border-t border-slate-100 flex justify-between text-xs font-bold text-slate-500">
          <span>Total ({activeRows.length} installments)</span>
          <span className="text-slate-800">{formatINR(total)}</span>
        </div>
      </div>
    )
  }

  // ─── Admin edit view ──────────────────────────────────────────────────────

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-xl border border-indigo-100">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-indigo-50/50 border-b border-indigo-100">
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-indigo-400 px-3 py-2.5">Label</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-indigo-400 px-3 py-2.5">Due Date</th>
              <th className="text-right text-[10px] uppercase tracking-widest font-bold text-indigo-400 px-3 py-2.5">Amount (₹)</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-indigo-400 px-3 py-2.5">Year</th>
              <th className="text-left text-[10px] uppercase tracking-widest font-bold text-indigo-400 px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((r, idx) => {
              if (r._delete) return null
              const isPaid = r.status === "PAID"
              const isPartial = r.status === "PARTIAL"
              return (
                <tr key={r.id ?? `new-${idx}`} className={cn("transition-colors", r._isNew ? "bg-indigo-50/30" : "hover:bg-slate-50/30")}>
                  {/* Label */}
                  <td className="px-3 py-2">
                    <input
                      className={inputCls}
                      value={r.label}
                      onChange={e => updateRow(idx, { label: e.target.value })}
                      placeholder="e.g. Year 1 — Growth"
                    />
                  </td>

                  {/* Due date */}
                  <td className="px-3 py-2">
                    <input
                      type="date"
                      className={inputCls}
                      value={r.dueDate}
                      onChange={e => updateRow(idx, { dueDate: e.target.value })}
                    />
                  </td>

                  {/* Amount */}
                  <td className="px-3 py-2">
                    {isPaid ? (
                      <div className="relative">
                        <input className={inputLockedCls} value={Number(r.amount).toLocaleString("en-IN")} readOnly />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-black uppercase text-slate-400">PAID</span>
                      </div>
                    ) : (
                      <div>
                        <input
                          type="number"
                          className={cn(inputCls, isPartial && "border-amber-300")}
                          value={r.amount}
                          onChange={e => updateRow(idx, { amount: e.target.value })}
                          placeholder="0"
                        />
                        {isPartial && (
                          <p className="text-[10px] text-amber-600 font-semibold mt-0.5 pl-1">Partial payment recorded</p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Year */}
                  <td className="px-3 py-2">
                    <select
                      className={cn(inputCls, "appearance-none")}
                      value={r.year}
                      onChange={e => updateRow(idx, { year: parseInt(e.target.value) })}
                    >
                      <option value={0}>Reg</option>
                      <option value={1}>Year 1</option>
                      <option value={2}>Year 2</option>
                      <option value={3}>Year 3</option>
                    </select>
                  </td>

                  {/* Status badge */}
                  <td className="px-3 py-2">
                    <span className={cn("text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded border whitespace-nowrap", STATUS_STYLES[r.status])}>
                      {r.status}
                    </span>
                  </td>

                  {/* Delete */}
                  <td className="px-3 py-2 text-center">
                    {!isPaid && (
                      <button
                        type="button"
                        onClick={() => deleteRow(idx)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Add row */}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 text-xs font-bold text-indigo-500 hover:text-indigo-700 transition-colors px-1"
      >
        <Plus className="h-3.5 w-3.5" />
        Add installment
      </button>

      {/* Footer total */}
      <div className={cn(
        "flex items-center justify-between rounded-xl px-4 py-2.5 border text-sm font-bold",
        totalMatchesNet
          ? "bg-emerald-50 border-emerald-200 text-emerald-700"
          : "bg-amber-50 border-amber-200 text-amber-700"
      )}>
        <span>Total ({activeRows.length} installments)</span>
        <div className="text-right">
          <span>{formatINR(total)}</span>
          {!totalMatchesNet && (
            <p className="text-[10px] font-semibold opacity-80">
              Net fee: {formatINR(netFee)} — custom plans may differ
            </p>
          )}
        </div>
      </div>

      {/* Reason for change */}
      {showReasonField && (
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-amber-600">
            Reason for Change (Required)
          </label>
          <input
            value={changeReason}
            onChange={e => setChangeReason(e.target.value)}
            placeholder="e.g. Revised payment schedule agreed with student"
            className="w-full h-11 rounded-xl border-2 border-amber-300 bg-amber-50 px-4 text-sm font-semibold text-slate-800 placeholder:text-slate-400 focus:border-amber-500 focus:outline-none transition-all"
          />
        </div>
      )}

      {error && (
        <p className="text-sm font-semibold bg-rose-50 border border-rose-200 text-rose-600 px-4 py-3 rounded-xl">
          {error}
        </p>
      )}

      {saved && (
        <p className="text-sm font-semibold bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl">
          Schedule saved successfully.
        </p>
      )}

      {hasChanges && (
        <button
          type="button"
          onClick={handleSave}
          disabled={loading}
          className="flex items-center gap-2 h-10 px-6 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-sm font-bold rounded-xl transition-all"
        >
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {loading ? "Saving…" : "Save Schedule"}
        </button>
      )}
    </div>
  )
}
