"use client"

import { useState, useTransition } from "react"
import { addTeamMember, updateUserRole, removeTeamMember, updateUserName, updateUserCcOnEmails } from "@/app/actions/team"
import { useRouter } from "next/navigation"
import { ShieldCheck, User, Loader2, ChevronDown, Plus, Trash2, X, Pencil, Check } from "lucide-react"
import { cn } from "@/lib/utils"
import { ROLES, ROLE_VALUES, type AppRole } from "@/lib/roles"

type TeamMember = {
  id: string
  name: string | null
  email: string
  role: AppRole
  ccOnEmails: boolean
  createdAt: Date
}

export function TeamTab({ members, currentUserId }: { members: TeamMember[], currentUserId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [addEmail, setAddEmail] = useState("")
  const [addRole, setAddRole] = useState<AppRole>("STAFF")
  const [addError, setAddError] = useState("")
  const [addLoading, setAddLoading] = useState(false)
  const [removeConfirmId, setRemoveConfirmId] = useState<string | null>(null)
  const [editingNameId, setEditingNameId] = useState<string | null>(null)
  const [nameDraft, setNameDraft] = useState("")

  function startEditName(m: TeamMember) {
    setEditingNameId(m.id)
    setNameDraft(m.name ?? "")
  }
  function saveName(userId: string) {
    setLoadingId(userId)
    startTransition(async () => {
      try {
        await updateUserName(userId, nameDraft)
        setEditingNameId(null)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to update name")
      } finally {
        setLoadingId(null)
      }
    })
  }
  function toggleCc(userId: string, next: boolean) {
    setLoadingId(userId)
    startTransition(async () => {
      try {
        await updateUserCcOnEmails(userId, next)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to update CC")
      } finally {
        setLoadingId(null)
      }
    })
  }

  function changeRole(userId: string, role: AppRole) {
    setLoadingId(userId)
    startTransition(async () => {
      try {
        await updateUserRole(userId, role)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to update role")
      } finally {
        setLoadingId(null)
      }
    })
  }

  async function handleAdd(e: React.SyntheticEvent<HTMLFormElement>) {
    e.preventDefault()
    setAddError("")
    setAddLoading(true)
    try {
      await addTeamMember(addEmail, addRole)
      setAddEmail("")
      setAddRole("STAFF")
      setShowAddForm(false)
      router.refresh()
    } catch (err) {
      setAddError(err instanceof Error ? err.message : "Failed to add member")
    } finally {
      setAddLoading(false)
    }
  }

  function handleRemove(userId: string) {
    setLoadingId(userId)
    startTransition(async () => {
      try {
        await removeTeamMember(userId)
        router.refresh()
      } catch (e) {
        alert(e instanceof Error ? e.message : "Failed to remove member")
      } finally {
        setLoadingId(null)
        setRemoveConfirmId(null)
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-800">Team Members</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Add members by email. They can log in once added — promote to Admin to grant full access.
          </p>
        </div>
        <button
          type="button"
          onClick={() => { setShowAddForm((v) => !v); setAddError("") }}
          className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-[#3663AD] text-white text-sm font-bold hover:bg-[#25BCBD] transition-all shrink-0"
        >
          {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {showAddForm ? "Cancel" : "Add Member"}
        </button>
      </div>

      {/* Role legend */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {ROLE_VALUES.map((r) => {
          const def = ROLES[r]
          return (
            <div key={r} className="flex items-start gap-3 p-3 rounded-xl border border-slate-200 bg-slate-50">
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] uppercase font-bold tracking-wider border shrink-0 mt-0.5",
                r === "ADMIN" ? "bg-indigo-50 text-indigo-700 border-indigo-200" : "bg-slate-100 text-slate-600 border-slate-200"
              )}>
                {r === "ADMIN" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                {def.label}
              </span>
              <p className="text-xs text-slate-500 leading-relaxed">{def.description}</p>
            </div>
          )
        })}
      </div>

      {/* Add member form */}
      {showAddForm && (
        <form onSubmit={handleAdd} className="border border-dashed border-[#3663AD]/40 bg-[#3663AD]/5 rounded-2xl p-5 space-y-4">
          <p className="text-sm font-semibold text-slate-700">Add a team member</p>
          <div className="flex gap-3 flex-wrap">
            <input
              type="email"
              required
              placeholder="teammate@example.com"
              value={addEmail}
              onChange={(e) => setAddEmail(e.target.value)}
              className="flex-1 min-w-48 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#3663AD]/40 bg-white"
            />
            <div className="relative">
              <select
                value={addRole}
                onChange={(e) => setAddRole(e.target.value as AppRole)}
                className="appearance-none border border-slate-200 rounded-xl px-3 py-2 pr-8 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-[#3663AD]/40 cursor-pointer"
              >
                {ROLE_VALUES.map((r) => (
                  <option key={r} value={r}>{ROLES[r].label}</option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={addLoading}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 disabled:opacity-60 transition-all"
            >
              {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Add
            </button>
          </div>
          {addError && <p className="text-sm text-rose-600 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{addError}</p>}
          <p className="text-xs text-slate-400">
            If they&apos;ve already logged in their role will be updated. If not, they can log in with this email and will get the assigned role.
          </p>
        </form>
      )}

      {/* Members table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400">
            <tr>
              <th className="px-6 py-4 text-left">Member</th>
              <th className="px-6 py-4 text-left">Role</th>
              <th className="px-6 py-4 text-center" title="When checked, this user is CC'd on all student/parent-facing emails (offer, onboarding, reminders, receipts).">CC Emails</th>
              <th className="px-6 py-4 text-left">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const isMe = m.id === currentUserId
              const isLoading = loadingId === m.id
              const confirmingRemove = removeConfirmId === m.id
              return (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-indigo-600">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        {editingNameId === m.id ? (
                          <div className="flex items-center gap-1.5">
                            <input
                              autoFocus
                              type="text"
                              value={nameDraft}
                              onChange={(e) => setNameDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveName(m.id)
                                if (e.key === "Escape") setEditingNameId(null)
                              }}
                              placeholder="Name"
                              className="text-sm font-semibold border border-indigo-200 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500 min-w-0 w-full max-w-[200px]"
                            />
                            <button
                              type="button"
                              onClick={() => saveName(m.id)}
                              className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 transition-colors"
                              title="Save"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingNameId(null)}
                              className="p-1 rounded-md text-slate-400 hover:bg-slate-50 transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => startEditName(m)}
                            className="group flex items-center gap-1.5 text-left hover:text-indigo-600 transition-colors"
                            title="Click to edit"
                          >
                            <p className="font-semibold text-slate-800 group-hover:text-indigo-600">
                              {m.name || <span className="text-slate-400 italic text-xs">No name yet</span>}
                            </p>
                            <Pencil className="w-3 h-3 text-slate-300 group-hover:text-indigo-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                          </button>
                        )}
                        <p className="text-xs text-slate-500">{m.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider border",
                      m.role === "ADMIN"
                        ? "bg-indigo-50 text-indigo-700 border-indigo-200"
                        : "bg-slate-100 text-slate-600 border-slate-200"
                    )}>
                      {m.role === "ADMIN" ? <ShieldCheck className="w-3 h-3" /> : <User className="w-3 h-3" />}
                      {ROLES[m.role]?.label ?? m.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <label className="inline-flex items-center justify-center cursor-pointer" title={m.ccOnEmails ? "CC'd on all student-facing emails" : "Click to CC on all student-facing emails"}>
                      <input
                        type="checkbox"
                        checked={m.ccOnEmails}
                        onChange={(e) => toggleCc(m.id, e.target.checked)}
                        disabled={pending}
                        className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-2 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
                      />
                    </label>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isMe ? (
                      <span className="text-xs text-slate-400 italic">You</span>
                    ) : isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-auto" />
                    ) : confirmingRemove ? (
                      <div className="flex items-center justify-end gap-2">
                        <span className="text-xs text-slate-500">Remove {m.name || m.email}?</span>
                        <button
                          type="button"
                          onClick={() => handleRemove(m.id)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 text-white text-xs font-bold hover:bg-rose-700 transition-all"
                        >
                          Yes, remove
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(null)}
                          className="px-2.5 py-1 rounded-lg border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-all"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <div className="relative">
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.id, e.target.value as AppRole)}
                            disabled={pending}
                            className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg pr-7 cursor-pointer hover:border-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          >
                            {ROLE_VALUES.map((r) => (
                              <option key={r} value={r}>{ROLES[r].label}</option>
                            ))}
                          </select>
                          <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                        </div>
                        <button
                          type="button"
                          onClick={() => setRemoveConfirmId(m.id)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-all"
                          title="Remove member"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
            {members.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-sm text-slate-400 italic">No team members yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
