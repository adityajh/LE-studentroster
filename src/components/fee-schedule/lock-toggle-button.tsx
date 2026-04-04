"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Lock, Unlock, Loader2 } from "lucide-react"
import { toast } from "sonner"

interface LockToggleButtonProps {
  feeScheduleId: string
  isLocked: boolean
  userId: string
}

export function LockToggleButton({ feeScheduleId, isLocked, userId }: LockToggleButtonProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleToggle = async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/fee-schedule/lock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feeScheduleId, lock: !isLocked, userId }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success(isLocked ? "Fee schedule unlocked" : "Fee schedule locked successfully")
      setOpen(false)
      router.refresh()
    } catch {
      toast.error("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <Button
            variant={isLocked ? "outline" : "default"}
            size="sm"
            className={isLocked ? "" : "bg-green-600 hover:bg-green-700"}
          />
        }
      >
        {isLocked ? (
          <><Unlock className="h-4 w-4 mr-1" /> Unlock</>
        ) : (
          <><Lock className="h-4 w-4 mr-1" /> Lock Schedule</>
        )}
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {isLocked ? "Unlock fee schedule?" : "Lock fee schedule?"}
          </DialogTitle>
          <DialogDescription>
            {isLocked
              ? "Unlocking will allow edits to programs, offers, and scholarships. Only do this if corrections are needed."
              : "Locking prevents any edits to programs, offers, and scholarships for this batch year. This is recommended once student enrollments begin. You can unlock it again if needed."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
          <Button
            onClick={handleToggle}
            disabled={loading}
            className={isLocked ? "" : "bg-green-600 hover:bg-green-700"}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Working...</>
            ) : isLocked ? (
              "Yes, unlock"
            ) : (
              "Yes, lock it"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
