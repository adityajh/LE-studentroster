"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload, FileText, Trash2, ExternalLink } from "lucide-react"

type Doc = {
  id: string
  type: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  uploadedAt: Date | string
}

const DOC_TYPES: { value: string; label: string; isPhoto?: boolean }[] = [
  { value: "STUDENT_PHOTO",      label: "Student Photo",    isPhoto: true },
  { value: "TENTH_MARKSHEET",    label: "10th Marksheet" },
  { value: "TWELFTH_MARKSHEET",  label: "12th Marksheet" },
  { value: "ACCEPTANCE_LETTER",  label: "Acceptance Letter" },
  { value: "AADHAR_CARD",        label: "Aadhar Card" },
  { value: "DRIVERS_LICENSE",    label: "Driver's License" },
]

function formatBytes(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function DocumentUpload({
  studentId,
  documents,
}: {
  studentId: string
  documents: Doc[]
}) {
  const router = useRouter()
  const [uploading, setUploading] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [error, setError] = useState("")
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({})

  const docMap = Object.fromEntries(documents.map((d) => [d.type, d]))

  const handleUpload = async (docType: string, file: File) => {
    setUploading(docType)
    setError("")
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("type", docType)
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "POST",
        body: fd,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Upload failed")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed")
    } finally {
      setUploading(null)
    }
  }

  const handleDelete = async (docId: string, docType: string) => {
    setDeleting(docType)
    setError("")
    try {
      const res = await fetch(`/api/students/${studentId}/documents`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ docId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? "Delete failed")
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed")
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="bg-white border border-slate-200/50 rounded-2xl shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-slate-100">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Documents</p>
        <p className="text-base font-extrabold text-slate-900 mt-0.5">Student Files</p>
      </div>

      {error && (
        <div className="px-5 pt-3">
          <p className="text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-600 px-3 py-2 rounded-lg">
            {error}
          </p>
        </div>
      )}

      <div className="divide-y divide-slate-50">
        {DOC_TYPES.map(({ value, label, isPhoto }) => {
          const doc = docMap[value]
          const isUploading = uploading === value
          const isDeleting = deleting === value

          return (
            <div key={value} className="px-5 py-4 flex items-center justify-between gap-4">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                {isPhoto ? (
                  <div className="w-10 h-10 rounded-full overflow-hidden bg-slate-100 shrink-0 border-2 border-slate-200">
                    {doc ? (
                      <img src={doc.fileUrl} alt="Student" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <FileText className="h-4 w-4 text-slate-300" />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className={`p-2 rounded-lg shrink-0 ${doc ? "bg-emerald-50" : "bg-slate-50"}`}>
                    <FileText className={`h-4 w-4 ${doc ? "text-emerald-600" : "text-slate-400"}`} />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{label}</p>
                  {doc ? (
                    <p className="text-[10px] font-medium text-slate-400 truncate max-w-[200px]">
                      {doc.fileName}
                      {doc.fileSize && ` · ${formatBytes(doc.fileSize)}`}
                    </p>
                  ) : (
                    <p className="text-[10px] font-medium text-slate-400">Not uploaded</p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {doc && (
                  <>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                      title="View"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                    <button
                      onClick={() => handleDelete(doc.id, value)}
                      disabled={!!isDeleting}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all disabled:opacity-50"
                      title="Delete"
                    >
                      {isDeleting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </>
                )}

                <input
                  ref={(el) => { inputRefs.current[value] = el }}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(value, file)
                    e.target.value = ""
                  }}
                />
                <button
                  onClick={() => inputRefs.current[value]?.click()}
                  disabled={isUploading}
                  className="flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg border-2 border-indigo-200 text-indigo-600 hover:bg-indigo-50 transition-all disabled:opacity-50"
                >
                  {isUploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {doc ? "Replace" : "Upload"}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
