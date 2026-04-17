"use client"

import { Download, FileText, Loader2, Upload, Clock, History, ShieldAlert, RefreshCw } from "lucide-react"
import { useState, useRef } from "react"
import { toast } from "sonner"

type LetterVersion = {
  id: string
  fileUrl: string
  fileName: string
  source: "GENERATED" | "UPLOADED"
  isActive: boolean
  createdAt: string
  createdBy: { name: string | null } | null
}

type Props = {
  studentId: string
  isAdmin: boolean
  initialLetter: LetterVersion | null
  initialHistory: LetterVersion[]
}

function sourceLabel(source: "GENERATED" | "UPLOADED") {
  return source === "GENERATED" ? "Auto-generated at enrolment" : "Manually uploaded"
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric",
  })
}

export function ProposalTab({ studentId, isAdmin, initialLetter, initialHistory }: Props) {
  const [letter, setLetter] = useState<LetterVersion | null>(initialLetter)
  const [history, setHistory] = useState<LetterVersion[]>(initialHistory)
  const [downloading, setDownloading] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false)
  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const downloadPdf = async () => {
    setDownloading(true)
    try {
      const res = await fetch(`/api/students/${studentId}/proposal`)
      if (!res.ok) throw new Error("Failed to download")
      const disposition = res.headers.get("Content-Disposition")
      let filename = letter?.fileName ?? "fee-letter.pdf"
      if (disposition) {
        const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(disposition)
        if (m?.[1]) filename = m[1].replace(/['"]/g, "")
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      toast.error("Failed to download fee letter")
    } finally {
      setDownloading(false)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.endsWith(".pdf")) { toast.error("Only PDF files accepted"); return }
    if (file.size > 10 * 1024 * 1024) { toast.error("File exceeds 10 MB"); return }
    setPendingFile(file)
    setShowConfirm(true)
    // reset input so the same file can be re-selected
    e.target.value = ""
  }

  const regenerate = async () => {
    setRegenerating(true)
    try {
      const res = await fetch(`/api/students/${studentId}/fee-letter`, { method: "PUT" })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Regeneration failed")
      }
      const data = await res.json()
      if (letter) setHistory((h) => [{ ...letter, isActive: false }, ...h])
      setLetter(data.version)
      toast.success("Fee letter regenerated from current data")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Regeneration failed")
    } finally {
      setRegenerating(false)
    }
  }

  const confirmUpload = async () => {
    if (!pendingFile) return
    setShowConfirm(false)
    setUploading(true)
    try {
      const form = new FormData()
      form.append("file", pendingFile)
      const res = await fetch(`/api/students/${studentId}/fee-letter`, { method: "POST", body: form })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error ?? "Upload failed")
      }
      const data = await res.json()
      // Move current letter to history and set new one as active
      if (letter) setHistory((h) => [{ ...letter, isActive: false }, ...h])
      setLetter(data.version)
      toast.success("Fee letter updated successfully")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed")
    } finally {
      setUploading(false)
      setPendingFile(null)
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Active letter card */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 bg-red-50 rounded-xl flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-red-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Fee Letter</h3>
              {letter ? (
                <div className="mt-0.5 space-y-0.5">
                  <p className="text-xs text-slate-500 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {formatDate(letter.createdAt)}
                    {" · "}
                    <span className={letter.source === "UPLOADED" ? "text-violet-600 font-semibold" : "text-emerald-600 font-semibold"}>
                      {sourceLabel(letter.source)}
                    </span>
                    {letter.createdBy && (
                      <span className="text-slate-400">· {letter.createdBy.name}</span>
                    )}
                  </p>
                </div>
              ) : (
                <p className="text-xs text-slate-400 mt-0.5">No letter on file — generates fresh from current data</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && (
              <>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  onChange={handleFileSelect}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
                >
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {letter ? "Replace" : "Upload"}
                </button>
              </>
            )}
            {isAdmin && (
              <button
                onClick={() => setShowRegenerateConfirm(true)}
                disabled={regenerating || uploading}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-bold hover:bg-slate-50 transition-colors disabled:opacity-50"
              >
                {regenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {letter ? "Regenerate" : "Generate"}
              </button>
            )}
            {letter && (
              <button
                onClick={downloadPdf}
                disabled={downloading}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold transition-colors disabled:opacity-50"
              >
                {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                Download PDF
              </button>
            )}
          </div>
        </div>
      </div>

      {/* History */}
      {history.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-slate-400">
            <History className="h-3 w-3" /> Previous versions
          </div>
          <div className="rounded-2xl border border-slate-100 bg-slate-50 divide-y divide-slate-100">
            {history.map((v) => (
              <div key={v.id} className="flex items-center justify-between px-4 py-3 gap-4">
                <div>
                  <p className="text-xs font-medium text-slate-600">
                    {formatDate(v.createdAt)}
                    {" · "}
                    <span className="text-slate-400">{sourceLabel(v.source)}</span>
                    {v.createdBy && <span className="text-slate-400"> · {v.createdBy.name}</span>}
                  </p>
                  <p className="text-[11px] text-slate-400 font-mono truncate max-w-xs">{v.fileName}</p>
                </div>
                <a
                  href={v.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-[#3663AD] hover:underline shrink-0"
                >
                  View
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Confirm regenerate dialog */}
      {showRegenerateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowRegenerateConfirm(false)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">
                  {letter ? "Regenerate Fee Letter?" : "Generate Fee Letter?"}
                </h2>
                <p className="text-xs text-slate-500">
                  {letter ? "The current letter will be archived" : "Generated from current financial data"}
                </p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              {letter
                ? "A new fee letter will be generated from the student's current financial data. The existing letter will be moved to version history."
                : "A fee letter will be generated from the student's current financial data and saved as the active letter."}
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="flex-1 h-10 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => { setShowRegenerateConfirm(false); regenerate() }}
                className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors"
              >
                {letter ? "Regenerate" : "Generate"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm replace dialog */}
      {showConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => { setShowConfirm(false); setPendingFile(null) }}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
                <ShieldAlert className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-base font-black text-slate-900">Replace Fee Letter?</h2>
                <p className="text-xs text-slate-500">The current letter will be archived</p>
              </div>
            </div>
            <p className="text-sm text-slate-600">
              The existing fee letter will be moved to version history and{" "}
              <strong>{pendingFile?.name}</strong> will become the active letter. This cannot be undone.
            </p>
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowConfirm(false); setPendingFile(null) }}
                className="flex-1 h-10 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmUpload}
                className="flex-1 h-10 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-sm font-bold transition-colors"
              >
                Replace
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
