"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { Loader2, Upload, Trash2, ExternalLink, CheckSquare, Square } from "lucide-react"

type Doc = {
  id: string
  type: string
  fileName: string
  fileUrl: string
  fileSize: number | null
  uploadedAt: Date | string
}

export const DOC_TYPES: { value: string; label: string; isPhoto?: boolean }[] = [
  { value: "STUDENT_PHOTO",      label: "Student Photo",          isPhoto: true },
  { value: "TENTH_MARKSHEET",    label: "10th Marksheet" },
  { value: "TWELFTH_MARKSHEET",  label: "12th Marksheet" },
  { value: "ACCEPTANCE_LETTER",  label: "Acceptance Letter" },
  { value: "AADHAR_CARD",        label: "Aadhar Card" },
  { value: "DRIVERS_LICENSE",    label: "Driver's License" },
]

const MAX_FILE_SIZE = 1 * 1024 * 1024 // 1 MB

function formatBytes(bytes: number | null) {
  if (!bytes) return ""
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/**
 * Compact document status row — coloured squares for quick scanning.
 * Used in the student detail sidebar above the full upload section.
 */
export function DocumentStatusStrip({ documents }: { documents: Pick<Doc, "type">[] }) {
  const uploaded = new Set(documents.map((d) => d.type))
  return (
    <div className="flex flex-wrap gap-2">
      {DOC_TYPES.map(({ value, label }) => {
        const done = uploaded.has(value)
        return (
          <div
            key={value}
            title={label}
            className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
              done
                ? "bg-emerald-500/10 text-emerald-700 border-emerald-500/20"
                : "bg-slate-100 text-slate-400 border-slate-200"
            }`}
          >
            {done
              ? <CheckSquare className="h-3 w-3 shrink-0" />
              : <Square className="h-3 w-3 shrink-0" />
            }
            {label}
          </div>
        )
      })}
    </div>
  )
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
    if (file.size > MAX_FILE_SIZE) {
      setError(`"${file.name}" is ${(file.size / (1024 * 1024)).toFixed(1)} MB — max allowed is 1 MB.`)
      return
    }
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
      <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
        <div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400">Documents</p>
          <p className="text-base font-extrabold text-slate-900 font-headline mt-0.5">Student Files</p>
        </div>
        <span className="text-xs font-semibold text-slate-400">Max 1 MB per file</span>
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
            <div key={value} className="px-5 py-4 flex items-center gap-4 group hover:bg-slate-50/60 transition-colors">

              {/* Status square indicator */}
              {isPhoto ? (
                <div className={`w-10 h-10 rounded-xl overflow-hidden shrink-0 border-2 transition-all ${
                  doc ? "border-emerald-300 shadow-sm shadow-emerald-100" : "border-slate-200 bg-slate-50"
                }`}>
                  {doc ? (
                    <img src={doc.fileUrl} alt="Student" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Square className="h-4 w-4 text-slate-300" />
                    </div>
                  )}
                </div>
              ) : (
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-all ${
                  doc
                    ? "bg-emerald-500 shadow-sm shadow-emerald-200"
                    : "bg-slate-100"
                }`}>
                  {doc
                    ? <CheckSquare className="h-4 w-4 text-white" />
                    : <Square className="h-4 w-4 text-slate-400" />
                  }
                </div>
              )}

              {/* File info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-slate-800">{label}</p>
                {doc ? (
                  <p className="text-[10px] font-medium text-slate-400 truncate max-w-[220px] mt-0.5">
                    {doc.fileName}
                    {doc.fileSize && ` · ${formatBytes(doc.fileSize)}`}
                  </p>
                ) : (
                  <p className="text-[10px] font-medium text-slate-400 mt-0.5">Not uploaded</p>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1.5 shrink-0">
                {doc && (
                  <>
                    <a
                      href={doc.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-[#3663AD] hover:bg-[#3663AD]/5 transition-all"
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
                  accept=".pdf,.jpg,.jpeg,.png,.tif,.tiff"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) handleUpload(value, file)
                    e.target.value = ""
                  }}
                />
                <button
                  onClick={() => inputRefs.current[value]?.click()}
                  disabled={!!isUploading}
                  className={`flex items-center gap-1.5 h-8 px-3 text-xs font-bold rounded-lg border-2 transition-all disabled:opacity-50 ${
                    doc
                      ? "border-slate-200 text-slate-500 hover:border-[#3663AD]/40 hover:text-[#3663AD] hover:bg-[#3663AD]/5"
                      : "border-[#3663AD]/30 text-[#3663AD] bg-[#3663AD]/5 hover:bg-[#3663AD]/10"
                  }`}
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
