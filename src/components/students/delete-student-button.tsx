"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Trash2, AlertTriangle, Loader2 } from "lucide-react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"

interface DeleteStudentButtonProps {
  studentId: string
  studentName: string
}

export function DeleteStudentButton({ studentId, studentName }: DeleteStudentButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

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
      router.push("/students")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
      setLoading(false)
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <button
          className="flex items-center gap-2 h-10 px-4 text-rose-600 hover:text-rose-700 hover:bg-rose-50 font-bold rounded-xl transition-all"
          title="Delete Student"
        >
          <Trash2 className="h-4 w-4" />
          <span className="hidden md:inline">Delete</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent className="bg-white rounded-2xl border-2 border-slate-100 shadow-2xl">
        <AlertDialogHeader>
          <div className="w-12 h-12 rounded-full bg-rose-100 flex items-center justify-center mb-4">
            <AlertTriangle className="h-6 w-6 text-rose-600" />
          </div>
          <AlertDialogTitle className="text-xl font-black text-slate-900">
            Delete Student?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm font-medium text-slate-500">
            Are you sure you want to delete <strong className="text-slate-900">{studentName}</strong>? 
            This action is permanent and will delete all installments, payments, and documents.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <p className="text-xs font-bold text-rose-600 mt-2 bg-rose-50 px-3 py-2 rounded-lg border border-rose-100">
            {error}
          </p>
        )}
        <AlertDialogFooter className="mt-6">
          <AlertDialogCancel className="rounded-xl border-2 border-slate-100 font-bold text-slate-500 hover:bg-slate-50 transition-all">
            Cancel
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault()
              handleDelete()
            }}
            disabled={loading}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-xl px-6 transition-all shadow-lg shadow-rose-200"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, Delete Record"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
