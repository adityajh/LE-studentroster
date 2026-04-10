"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DeleteStudentButtonProps {
  studentId: string
  studentName: string
}

export function DeleteStudentButton({ studentId, studentName }: DeleteStudentButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [open, setOpen] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}`, {
        method: "DELETE",
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error ?? "Failed to delete student")
      }
      setOpen(false)
      router.push("/students")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            className="flex items-center gap-2 h-10 px-4 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold rounded-xl transition-all"
            title="Delete Student"
          >
            <Trash2 className="h-4 w-4" />
            <span className="hidden md:inline">Delete</span>
          </button>
        }
      />
      <DialogContent className="max-w-sm border-2 border-slate-100 shadow-2xl overflow-hidden">
        <DialogHeader className="p-0">
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4 mx-auto sm:mx-0">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <DialogTitle className="text-xl font-black text-slate-900">
            Delete Student?
          </DialogTitle>
          <DialogDescription className="text-sm font-medium text-slate-500">
            Are you sure you want to delete <strong className="text-slate-900">{studentName}</strong>? 
            This action is permanent and will delete all installments, payments, and documents.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <p className="text-xs font-bold text-rose-600 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
            {error}
          </p>
        )}
        <DialogFooter className="mt-6 flex gap-2">
          <DialogClose
            render={
              <Button variant="outline" className="rounded-xl border-2 border-slate-100 font-bold text-slate-500 hover:bg-slate-50 transition-all">
                Cancel
              </Button>
            }
          />
          <Button
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-6 transition-all shadow-lg shadow-rose-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete Record"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
