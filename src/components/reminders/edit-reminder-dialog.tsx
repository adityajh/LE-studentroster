"use client"

import { useState } from "react"
import { updateReminderSetting } from "@/app/actions/reminders"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"

type Setting = {
  id: string
  type: string
  daysOut: number
  subject: string
  bodyHtml: string
  isActive: boolean
}

export function EditReminderDialog({ setting }: { setting: Setting }) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [formData, setFormData] = useState({
    subject: setting.subject,
    bodyHtml: setting.bodyHtml,
    isActive: setting.isActive,
    daysOut: setting.daysOut,
  })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await updateReminderSetting(setting.id, {
        subject: formData.subject,
        bodyHtml: formData.bodyHtml,
        isActive: formData.isActive,
        daysOut: Number(formData.daysOut),
      })
      setOpen(false)
      router.refresh()
    } catch (err) {
      console.error(err)
      alert("Failed to update reminder setting")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="px-4 py-2 border border-slate-300 rounded-lg text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors">
        Edit Setting
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Edit Reminder Template</DialogTitle>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-6 mt-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
            <div className="space-y-0.5">
              <Label className="text-sm font-bold text-slate-800">Active Status</Label>
              <p className="text-xs text-slate-500">Enable or disable this specific reminder.</p>
            </div>
            <Switch
              checked={formData.isActive}
              onCheckedChange={(checked: boolean) => setFormData({ ...formData, isActive: checked })}
            />
          </div>

          <div className="space-y-2">
            <Label>Days Before Due</Label>
            <Input
              type="number"
              value={formData.daysOut}
              onChange={(e) => setFormData({ ...formData, daysOut: parseInt(e.target.value) })}
              required
            />
            <p className="text-xs text-slate-500">Use 0 for the exact due date.</p>
          </div>

          <div className="space-y-2">
            <Label>Subject Line</Label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              required
            />
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
              Variables: {"{{studentName}}"}, {"{{installmentLabel}}"}, {"{{amount}}"}, {"{{dueDate}}"}
            </p>
          </div>

          <div className="space-y-2">
            <Label>Email Body (HTML)</Label>
            <Textarea
              className="font-mono text-xs h-32"
              value={formData.bodyHtml}
              onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setFormData({ ...formData, bodyHtml: e.target.value })}
              required
            />
            <p className="text-[10px] uppercase font-bold tracking-wider text-slate-400 mt-1">
              Variables: {"{{studentName}}"}, {"{{installmentLabel}}"}, {"{{amount}}"}, {"{{dueDate}}"}
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading} className="bg-enterprise-blue hover:bg-bright-teal text-white">
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
