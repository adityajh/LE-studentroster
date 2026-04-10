"use client"

import { useState, useTransition } from "react"
import { updateUserRole } from "@/app/actions/team"
import { useRouter } from "next/navigation"
import { ShieldCheck, User, Loader2, ChevronDown } from "lucide-react"
import { cn } from "@/lib/utils"

type TeamMember = {
  id: string
  name: string | null
  email: string
  role: "ADMIN" | "STAFF"
  createdAt: Date
}

export function TeamTab({ members, currentUserId }: { members: TeamMember[], currentUserId: string }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [loadingId, setLoadingId] = useState<string | null>(null)

  function changeRole(userId: string, role: "ADMIN" | "STAFF") {
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

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-bold text-slate-800">Team Members</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Manage roles. New staff can log in with their email — promote them to Admin here.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400">
            <tr>
              <th className="px-6 py-4 text-left">Member</th>
              <th className="px-6 py-4 text-left">Role</th>
              <th className="px-6 py-4 text-left">Joined</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {members.map((m) => {
              const isMe = m.id === currentUserId
              const isLoading = loadingId === m.id
              return (
                <tr key={m.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                        <span className="text-xs font-black text-indigo-600">
                          {(m.name || m.email).charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="font-semibold text-slate-800">{m.name || "—"}</p>
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
                      {m.role}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-slate-500">
                    {new Date(m.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {isMe ? (
                      <span className="text-xs text-slate-400 italic">You</span>
                    ) : isLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin text-slate-400 ml-auto" />
                    ) : (
                      <div className="relative inline-block text-left">
                        <select
                          value={m.role}
                          onChange={(e) => changeRole(m.id, e.target.value as "ADMIN" | "STAFF")}
                          disabled={pending}
                          className="appearance-none bg-slate-50 border border-slate-200 text-slate-700 text-xs font-bold px-3 py-1.5 rounded-lg pr-7 cursor-pointer hover:border-indigo-300 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="STAFF">Staff</option>
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
