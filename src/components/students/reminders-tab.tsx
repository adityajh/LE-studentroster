import { Bell, CheckCircle2, XCircle, Clock } from "lucide-react"
import { cn } from "@/lib/utils"

type ReminderLog = {
  id: string
  type: "ONE_MONTH" | "ONE_WEEK" | "DUE_DATE"
  emailStatus: "SENT" | "FAILED" | "BOUNCED"
  sentAt: Date
  errorMessage: string | null
  installment: {
    label: string
    dueDate: Date
  }
}

const REMINDER_LABELS: Record<ReminderLog["type"], string> = {
  ONE_MONTH: "1 Month Reminder",
  ONE_WEEK:  "1 Week Reminder",
  DUE_DATE:  "Due Date Reminder",
}

const STATUS_STYLES: Record<ReminderLog["emailStatus"], { icon: typeof CheckCircle2; classes: string; label: string }> = {
  SENT:    { icon: CheckCircle2, classes: "text-emerald-600 bg-emerald-50 border-emerald-200",  label: "Sent"    },
  FAILED:  { icon: XCircle,      classes: "text-rose-600 bg-rose-50 border-rose-200",           label: "Failed"  },
  BOUNCED: { icon: XCircle,      classes: "text-amber-600 bg-amber-50 border-amber-200",        label: "Bounced" },
}

export function RemindersTab({ logs }: { logs: ReminderLog[] }) {
  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mb-3">
          <Bell className="h-5 w-5 text-slate-400" />
        </div>
        <p className="text-sm font-bold text-slate-500">No reminders sent yet</p>
        <p className="text-xs font-medium text-slate-400 mt-1 text-center max-w-xs">
          Automated reminders will appear here once the cron job processes upcoming installments.
        </p>
      </div>
    )
  }

  return (
    <div className="relative">
      {/* Timeline line */}
      <div className="absolute left-[19px] top-4 bottom-4 w-px bg-slate-100" />

      <div className="space-y-1">
        {logs.map((log) => {
          const style = STATUS_STYLES[log.emailStatus]
          const StatusIcon = style.icon
          return (
            <div key={log.id} className="relative flex items-start gap-4 px-5 py-3.5">
              {/* Dot */}
              <div className={cn(
                "relative z-10 w-10 h-10 rounded-full border-2 flex items-center justify-center shrink-0 bg-white",
                style.classes.split(" ").filter(c => c.startsWith("border")).join(" ")
              )}>
                <StatusIcon className={cn("h-4 w-4", style.classes.split(" ").filter(c => c.startsWith("text")).join(" "))} />
              </div>

              <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-slate-800">{REMINDER_LABELS[log.type]}</p>
                    <p className="text-xs font-medium text-slate-500 mt-0.5">
                      For: <span className="font-semibold text-slate-700">{log.installment.label}</span>
                      {" · "}due {new Date(log.installment.dueDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                    {log.errorMessage && (
                      <p className="text-[10px] font-medium text-rose-500 mt-1 font-mono">
                        {log.errorMessage}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <span className={cn(
                      "inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider px-2 py-1 rounded-lg border",
                      style.classes
                    )}>
                      {style.label}
                    </span>
                    <p className="text-[10px] font-medium text-slate-400 mt-1">
                      {new Date(log.sentAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                      {" "}
                      {new Date(log.sentAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
