"use client"

import { Button } from "@/components/ui/button"
import { Download, FileText, Loader2, FileArchive } from "lucide-react"
import { useState } from "react"

export function ProposalTab({ studentId }: { studentId: string }) {
  const [downloading, setDownloading] = useState<"pdf" | "docx" | null>(null)

  const downloadFile = async (format: "pdf" | "docx") => {
    setDownloading(format)
    try {
      const res = await fetch(`/api/students/${studentId}/proposal?format=${format}`)
      if (!res.ok) throw new Error("Failed to download")
      
      // Get filename from header if possible
      const disposition = res.headers.get('Content-Disposition')
      let filename = `proposal.${format}`
      if (disposition && disposition.indexOf('filename=') !== -1) {
        let filenameRegex = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/
        let matches = filenameRegex.exec(disposition)
        if (matches != null && matches[1]) { 
          filename = matches[1].replace(/['"]/g, '')
        }
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
    } catch (e) {
      console.error(e)
      alert("Failed to generate file. Check server logs.")
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="p-8 pb-12 flex flex-col items-center justify-center text-center">
      <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 border-4 border-slate-50">
        <FileText className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-bold text-slate-900 mb-2">Proposal Letters</h3>
      <p className="text-sm font-medium text-slate-500 max-w-sm mb-8">
        Generate an official letter detailing the student's complete financial breakdown, payment schedule, and terms.
      </p>

      <div className="flex items-center gap-4">
        <Button
          onClick={() => downloadFile("pdf")}
          disabled={downloading !== null}
          className="bg-red-600 hover:bg-red-700 text-white min-w-[160px]"
        >
          {downloading === "pdf" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><Download className="h-4 w-4 mr-2" /> Download PDF</>
          )}
        </Button>
        <Button
          onClick={() => downloadFile("docx")}
          disabled={downloading !== null}
          variant="outline"
          className="min-w-[160px]"
        >
          {downloading === "docx" ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating...</>
          ) : (
            <><FileArchive className="h-4 w-4 mr-2" /> Download Word</>
          )}
        </Button>
      </div>
    </div>
  )
}
