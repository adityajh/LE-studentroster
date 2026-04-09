import { prisma } from "@/lib/prisma"
import { Badge } from "@/components/ui/badge" // Wait, I need to create the brand components first! I will just use standard classes for now and update later, or implement basic ones here.
import { Eye, Mail, MailWarning, Clock } from "lucide-react"
import { auth } from "@/auth"
import { redirect } from "next/navigation"

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
  })

  const totalSent = logs.filter(l => l.emailStatus === "SENT").length
  const totalFailed = logs.filter(l => l.emailStatus === "FAILED" || l.emailStatus === "BOUNCED").length
  const totalRead = logs.filter(l => l.readAt != null).length

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
                  <div className="text-sm text-slate-600 p-3 bg-slate-50 rounded-lg border border-slate-200 font-mono text-xs line-clamp-2">
                    {setting.bodyHtml}
                  </div>
                </div>
              </div>
              <div className="shrink-0">
                  {/* Future: Add an edit button that opens a modal to patch ReminderSetting */}
                 <button className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50">
                    Edit Setting
                 </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
