"use client"

import { useState, useTransition } from "react"
import { updateSetting } from "@/app/actions/settings"
import { useRouter } from "next/navigation"
import { Loader2, Save, Mail, Eye, EyeOff, Send } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

type EmailConfig = {
  smtpUser: string
  smtpPassword: string
  fromName: string
  fromEmail: string
  paymentUrl: string
}

export function EmailTab({ initial }: { initial: EmailConfig }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [showPass, setShowPass] = useState(false)

  const [form, setForm] = useState(initial)
  const [testTo, setTestTo] = useState("")
  const [testLoading, setTestLoading] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null)

  async function handleTestEmail() {
    if (!testTo) return
    setTestLoading(true)
    setTestResult(null)
    try {
      const res = await fetch("/api/settings/test-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testTo }),
      })
      const data = await res.json()
      if (!res.ok) setTestResult({ ok: false, message: data.error ?? "Failed" })
      else setTestResult({ ok: true, message: `Sent to ${data.sentTo} from ${data.from}` })
    } catch {
      setTestResult({ ok: false, message: "Request failed" })
    } finally {
      setTestLoading(false)
    }
  }

  function handleSave() {
    startTransition(async () => {
      await Promise.all([
        updateSetting("SMTP_USER", form.smtpUser),
        updateSetting("SMTP_PASSWORD", form.smtpPassword),
        updateSetting("SMTP_FROM_NAME", form.fromName),
        updateSetting("SMTP_FROM_EMAIL", form.fromEmail),
        updateSetting("REMINDER_PAYMENT_URL", form.paymentUrl),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-bold text-slate-800">Email Configuration</h2>
        <p className="text-sm text-slate-500 mt-0.5">
          Configure the Hostinger email account that sends automated fee reminders and offer emails.
        </p>
      </div>

      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 shadow-sm">
        {/* SMTP Account */}
        <div>
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-4">SMTP Account</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="smtpUser">Email Address</Label>
              <Input
                id="smtpUser"
                type="email"
                placeholder="hi@letsenterprise.in"
                value={form.smtpUser}
                onChange={(e) => setForm({ ...form, smtpUser: e.target.value })}
              />
              <p className="text-xs text-slate-400">The Hostinger email account used to send emails.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="smtpPass">Password</Label>
              <div className="relative">
                <Input
                  id="smtpPass"
                  type={showPass ? "text" : "password"}
                  placeholder="Your Hostinger email password"
                  value={form.smtpPassword}
                  onChange={(e) => setForm({ ...form, smtpPassword: e.target.value })}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                >
                  {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-slate-400">
                Your Hostinger email account password (not a separate app password).
              </p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-4">Sender Identity</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="fromName">Display Name</Label>
              <Input
                id="fromName"
                placeholder="Let's Enterprise"
                value={form.fromName}
                onChange={(e) => setForm({ ...form, fromName: e.target.value })}
              />
              <p className="text-xs text-slate-400">What recipients see as the sender name.</p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="fromEmail">From Email Address</Label>
              <Input
                id="fromEmail"
                type="email"
                placeholder="hi@letsenterprise.in"
                value={form.fromEmail}
                onChange={(e) => setForm({ ...form, fromEmail: e.target.value })}
              />
              <p className="text-xs text-slate-400">Defaults to the SMTP address above if left blank.</p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 pt-5">
          <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400 mb-4">Payment Link</p>
          <div className="space-y-1.5">
            <Label htmlFor="paymentUrl" className="flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-slate-400" />
              Payment Instructions URL
            </Label>
            <Input
              id="paymentUrl"
              placeholder="https://pay.letsent.com (optional)"
              value={form.paymentUrl}
              onChange={(e) => setForm({ ...form, paymentUrl: e.target.value })}
            />
            <p className="text-xs text-slate-400">Appended at the bottom of every reminder email as payment instructions.</p>
          </div>
        </div>
      </div>

      {/* Test email */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-sm">
        <p className="text-[10px] uppercase font-bold tracking-widest text-slate-400">Send Test Email</p>
        <div className="flex gap-3 items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="testTo">Recipient</Label>
            <Input
              id="testTo"
              type="email"
              placeholder="you@example.com"
              value={testTo}
              onChange={(e) => setTestTo(e.target.value)}
            />
          </div>
          <Button
            type="button"
            onClick={handleTestEmail}
            disabled={testLoading || !testTo}
            className="bg-slate-800 hover:bg-slate-900 text-white"
          >
            {testLoading
              ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Sending...</>
              : <><Send className="h-4 w-4 mr-2" />Send Test</>
            }
          </Button>
        </div>
        {testResult && (
          <p className={`text-xs font-semibold px-3 py-2 rounded-lg border ${
            testResult.ok
              ? "bg-emerald-50 border-emerald-200 text-emerald-700"
              : "bg-rose-50 border-rose-200 text-rose-600"
          }`}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.message}
          </p>
        )}
      </div>

      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={pending}
          className="bg-indigo-600 hover:bg-indigo-700 text-white min-w-[140px]"
        >
          {pending
            ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Saving...</>
            : saved
              ? <><Save className="h-4 w-4 mr-2 text-emerald-400" />Saved!</>
              : <><Save className="h-4 w-4 mr-2" />Save Changes</>
          }
        </Button>
      </div>
    </div>
  )
}
