"use client"

import { History, User as UserIcon, ShieldAlert, Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { Role } from "@prisma/client"

type AuditLog = {
  id: string
  field: string
  oldValue: string | null
  newValue: string | null
  reason: string | null
  createdAt: Date
  changedByUser: {
    name: string | null
    email: string
    role: Role
  }
}

export function HistoryTab({ logs }: { logs: AuditLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="py-12 text-center bg-white border border-slate-200/50 rounded-2xl">
        <History className="h-10 w-10 mx-auto text-slate-200 mb-3" />
        <p className="text-sm font-semibold text-slate-500">No history recorded yet</p>
        <p className="text-xs text-slate-400 mt-1">Every change to this student record will be logged here.</p>
      </div>
    )
  }

  // Group by date
  const groups: Record<string, AuditLog[]> = {}
  logs.forEach(log => {
    const date = new Date(log.createdAt).toLocaleDateString("en-IN", {
      day: "numeric", month: "long", year: "numeric"
    })
    if (!groups[date]) groups[date] = []
    groups[date].push(log)
  })

  return (
    <div className="space-y-8">
      {Object.entries(groups).map(([date, items]) => (
        <div key={date} className="space-y-4">
          <div className="flex items-center gap-2">
            <span className="h-px flex-1 bg-slate-100" />
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-400 flex items-center gap-1.5 px-3">
              <Calendar className="h-3 w-3" />
              {date}
            </span>
            <span className="h-px flex-1 bg-slate-100" />
          </div>

          <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3 text-left">Time</th>
                  <th className="px-5 py-3 text-left">Changed By</th>
                  <th className="px-5 py-3 text-left">Field</th>
                  <th className="px-5 py-3 text-left">Change</th>
                  <th className="px-5 py-3 text-left">Reason / Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((log) => {
                  const isAdmin = log.changedByUser.role === "ADMIN"
                  return (
                    <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-slate-500 font-medium font-mono text-xs">
                        {new Date(log.createdAt).toLocaleTimeString("en-IN", {
                          hour: "2-digit", minute: "2-digit", hour12: true
                        })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2">
                          {isAdmin ? (
                            <ShieldAlert className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                          ) : (
                            <UserIcon className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 truncate leading-none">
                              {log.changedByUser.name ?? log.changedByUser.email.split("@")[0]}
                            </p>
                            <span className={cn(
                              "text-[8px] uppercase tracking-tighter font-black px-1 rounded",
                              isAdmin ? "bg-indigo-100 text-indigo-700" : "bg-slate-100 text-slate-500"
                            )}>
                              {log.changedByUser.role}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className="text-xs font-bold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-100">
                          {log.field}
                        </span>
                      </td>
                      <td className="px-5 py-4">
                        <div className="space-y-1 max-w-xs">
                          {log.oldValue && (
                            <div className="text-[10px] text-slate-400 line-through truncate" title={log.oldValue}>
                              {log.oldValue}
                            </div>
                          )}
                          <div className="text-xs font-bold text-slate-800 break-words">
                            {log.newValue ?? "—"}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <p className={cn(
                          "text-xs italic",
                          log.reason ? "text-slate-600 font-medium" : "text-slate-300"
                        )}>
                          {log.reason ?? "No reason provided"}
                        </p>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
