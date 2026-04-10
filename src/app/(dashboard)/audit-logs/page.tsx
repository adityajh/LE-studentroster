import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/prisma"
import { History, User as UserIcon, UserCircle, Calendar, Hash, FileEdit } from "lucide-react"
import { format } from "date-fns"
import { cn } from "@/lib/utils"

export default async function AuditLogsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect("/login")
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const logs = await prisma.studentAuditLog.findMany({
    include: {
      student: {
        select: {
          rollNo: true,
          name: true,
        }
      },
      changedByUser: {
        select: {
          name: true,
          email: true,
        }
      }
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  })

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-slate-950 tracking-tight">System Changelog</h1>
        <p className="text-sm font-medium text-slate-500">Global audit trail of student modifications</p>
      </header>

      <div className="bg-white border-2 border-slate-100 rounded-3xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Timestamp</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Moderator</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Student</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Change Details</th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-widest font-black text-slate-400">Reason</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {logs.map((log) => (
                <tr key={log.id} className="group hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-slate-300" />
                      <div>
                        <p className="text-xs font-bold text-slate-800">
                          {format(new Date(log.createdAt), "dd MMM yyyy")}
                        </p>
                        <p className="text-[10px] font-medium text-slate-400">
                          {format(new Date(log.createdAt), "HH:mm:ss")}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                      <UserCircle className="h-4 w-4 text-indigo-400" />
                      <div>
                        <p className="text-xs font-bold text-slate-700">{log.changedByUser.name}</p>
                        <p className="text-[10px] font-medium text-slate-400 lowercase">{log.changedByUser.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="text-xs font-bold text-slate-800">{log.student.name}</p>
                      <p className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-tight">{log.student.rollNo}</p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-1.5">
                        <FileEdit className="h-3 w-3 text-emerald-500" />
                        <span className="text-[10px] uppercase tracking-widest font-black text-slate-400">{log.field}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[11px]">
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 line-through truncate max-w-[120px]">
                          {log.oldValue || "empty"}
                        </span>
                        <span className="text-slate-300">→</span>
                        <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 font-bold truncate max-w-[120px]">
                          {log.newValue || "empty"}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className={cn(
                      "text-[11px] font-medium leading-relaxed italic",
                      log.reason ? "text-slate-600" : "text-slate-300"
                    )}>
                      {log.reason || "No reason provided"}
                    </p>
                  </td>
                </tr>
              ))}
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-12 text-center">
                    <History className="h-10 w-10 text-slate-200 mx-auto mb-3" />
                    <p className="text-sm font-bold text-slate-400">No audit logs found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
