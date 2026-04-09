import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge" // Wait, I need to create the brand components first! I will just use standard classes for now and update later, or implement basic ones here.
import { Eye, Mail, MailWarning, Clock, CheckCircle2, XCircle } from "lucide-react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { EditReminderDialog } from "@/components/reminders/edit-reminder-dialog"
import { formatINR } from "@/lib/fee-schedule"

export default async function RemindersDashboard() {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email! },
    select: { role: true },
  })

  // Admin access only perhaps?
  if (dbUser?.role !== "ADMIN") {
    redirect("/dashboard")
  }

  const settings = await prisma.reminderSetting.findMany({
    orderBy: { daysOut: "desc" },
  })

  const logs = await prisma.reminderLog.findMany({
    orderBy: { sentAt: "desc" },
    include: {
      installment: {
        include: { student: true }
      }
    },
    take: 100, // show last 100 in the UI
  })

  // Calculate totals from complete dataset (not just the 100 fetched for display)
  const allLogsStats = await prisma.reminderLog.findMany({
    select: { emailStatus: true, readAt: true }
  })
  
  const totalSent = allLogsStats.filter(l => l.emailStatus === "SENT").length
  const totalFailed = allLogsStats.filter(l => l.emailStatus === "FAILED" || l.emailStatus === "BOUNCED").length
  const totalRead = allLogsStats.filter(l => l.readAt != null).length

  // Fetch Upcoming pipeline
  const today = new Date()
  const maxLookahead = new Date(today)
  maxLookahead.setDate(maxLookahead.getDate() + 31)

  const upcomingInstallments = await prisma.installment.findMany({
    where: {
      status: { in: ["UPCOMING", "DUE", "PARTIAL"] },
      dueDate: { lte: maxLookahead, gte: today },
      student: { status: "ACTIVE" }
    },
    include: {
      student: { select: { id: true, name: true, rollNo: true } }
    },
    orderBy: { dueDate: "asc" }
  })

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900">Reminders Engine</h1>
        <p className="text-slate-500 mt-1">Configure automated fee reminders and monitor delivery metrics.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200/50 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center">
              <Mail className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Sent</p>
              <p className="text-2xl font-black text-slate-900">{totalSent}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/50 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Eye className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Total Read</p>
              <p className="text-2xl font-black text-slate-900">{totalRead}</p>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200/50 p-6 rounded-3xl shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
              <MailWarning className="h-5 w-5 text-rose-600" />
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Failed</p>
              <p className="text-2xl font-black text-slate-900">{totalFailed}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Settings List */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Reminder Templates (DB Configured)</h2>
        <div className="space-y-4">
          {settings.map(setting => (
            <div key={setting.id} className="bg-white border border-slate-200 p-6 rounded-2xl flex flex-col md:flex-row md:items-start justify-between gap-6">
              <div className="flex-1 space-y-4">
                <div className="flex items-center gap-3">
                  <span className="bg-slate-100 text-slate-700 font-bold px-3 py-1 rounded-full text-xs uppercase tracking-wider">
                    {setting.type}
                  </span>
                  <span className="text-sm font-semibold text-slate-500 flex items-center gap-1.5">
                    <Clock className="w-4 h-4" /> {setting.daysOut} days before due
                  </span>
                  {setting.isActive ? (
                    <span className="text-emerald-600 bg-emerald-50 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border border-emerald-200">Active</span>
                  ) : (
                    <span className="text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase border border-slate-300">Inactive</span>
                  )}
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Subject</p>
                  <p className="font-semibold text-slate-800">{setting.subject}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Body Preview</p>
                  <div className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs line-clamp-2 whitespace-pre-wrap">
                    {setting.bodyText}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                <EditReminderDialog setting={setting} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Detailed Log History */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Recent Outgoing Logs</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400">
              <tr>
                <th className="px-6 py-4 font-headline">Time</th>
                <th className="px-6 py-4 font-headline">Student</th>
                <th className="px-6 py-4 font-headline">Action</th>
                <th className="px-6 py-4 font-headline">Status</th>
                <th className="px-6 py-4 font-headline text-right">Read Receipt</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">No logs recorded yet.</td>
                </tr>
              )}
              {logs.map(log => {
                const isSent = log.emailStatus === "SENT"
                const isFailed = log.emailStatus === "FAILED" || log.emailStatus === "BOUNCED"
                const isRead = log.readAt != null
                return (
                  <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-semibold text-slate-800">{new Date(log.sentAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                      <p className="text-xs text-slate-400">{new Date(log.sentAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}</p>
                    </td>
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-900">{log.installment.student.name}</p>
                      <p className="text-xs text-slate-500">{log.installment.label} · {formatINR(log.installment.amount)}</p>
                    </td>
                    <td className="px-6 py-4">
                      <span className="bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider">
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                       {isSent && (
                         <span className="inline-flex items-center gap-1.5 text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider">
                           <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Sent
                         </span>
                       )}
                       {isFailed && (
                         <span className="inline-flex items-center gap-1.5 text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider tooltip">
                           <XCircle className="w-3 h-3 text-rose-500" /> {log.emailStatus}
                           {log.errorMessage && <span className="ml-1 text-rose-400 truncate max-w-[100px] block" title={log.errorMessage}>- {log.errorMessage}</span>}
                         </span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       {isRead ? (
                          <div className="flex flex-col items-end">
                             <span className="inline-flex items-center gap-1 text-emerald-600 font-bold text-[10px] uppercase tracking-wider">
                               <Eye className="w-3.5 h-3.5" /> Opened
                             </span>
                             <span className="text-[10px] text-slate-400 mt-0.5">
                               {new Date(log.readAt!).toLocaleDateString("en-IN", { month: "short", day: "numeric" })} {new Date(log.readAt!).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                             </span>
                          </div>
                       ) : (
                         isSent ? <span className="text-slate-400 text-xs font-medium">Unread</span> : <span className="text-slate-300 text-xs font-medium">-</span>
                       )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Upcoming Pipeline */}
      <div>
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-200 pb-2 mb-4">Upcoming Installments (Next 30 Days)</h2>
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm max-h-96 overflow-y-auto">
          <table className="w-full text-left text-sm whitespace-nowrap">
            <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400 sticky top-0 shadow-sm">
              <tr>
                <th className="px-6 py-4 font-headline">Due Date</th>
                <th className="px-6 py-4 font-headline">Student</th>
                <th className="px-6 py-4 font-headline">Installment</th>
                <th className="px-6 py-4 font-headline">Amount</th>
                <th className="px-6 py-4 font-headline">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {upcomingInstallments.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500 font-medium">No upcoming installments in the next 30 days.</td>
                </tr>
              )}
              {upcomingInstallments.map(inst => (
                <tr key={inst.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-semibold text-slate-800">{new Date(inst.dueDate).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</p>
                  </td>
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-900">{inst.student.name}</p>
                    <p className="text-[10px] font-mono text-slate-500">{inst.student.rollNo}</p>
                  </td>
                  <td className="px-6 py-4 font-medium text-slate-600">
                    {inst.label}
                  </td>
                  <td className="px-6 py-4 font-bold text-indigo-600">
                    {formatINR(inst.amount)}
                  </td>
                  <td className="px-6 py-4">
                    <span className="bg-amber-100 text-amber-700 font-bold px-2.5 py-1 rounded-md text-[10px] uppercase tracking-wider border border-amber-200">
                      {inst.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
