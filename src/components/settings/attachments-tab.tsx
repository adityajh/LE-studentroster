"use client"

import { useState } from "react"
import { SoftCard, Eyebrow } from "@/components/ui/brand"
import { ChevronDown, FileText, Loader2, X } from "lucide-react"
import { cn } from "@/lib/utils"

type PdfDoc = {
  name: string
  subtitle: string
  filenamePattern: string
  previewUrl: string
  usedIn: string[]
  configurable: string[]
}

const PDFS: PdfDoc[] = [
  {
    name: "Offer Letter",
    subtitle: "Sent to candidates with the offer of admission",
    filenamePattern: "LE-{Program}-{Student}-OfferLetter-{Date}.pdf",
    previewUrl: "/api/preview/pdf/offer-letter",
    usedIn: [
      "Offer Email — manual, \"Send Offer Email\" button",
      "Revised Offer Email — automatic, after 7-day window lapses",
    ],
    configurable: [
      "Opening paragraph body — Settings → Emails → Offer Letter Body",
      "Bank details section — Settings → Emails → Bank Details",
    ],
  },
  {
    name: "Fee Structure",
    subtitle: "Personalised fee schedule sent after enrolment is confirmed",
    filenamePattern: "LE-{Program}-{Student}-FeeDetails.pdf",
    previewUrl: "/api/preview/pdf/fee-structure",
    usedIn: [
      "Enrolment Confirmation — automatic on registration payment",
      "Onboarding Welcome Email — manual, Complete Onboarding wizard",
    ],
    configurable: [
      "Terms & Conditions boilerplate — Settings → T&C's",
    ],
  },
  {
    name: "Payment Receipt",
    subtitle: "Issued each time a payment is recorded",
    filenamePattern: "Receipt_{ReceiptNo}.pdf",
    previewUrl: "/api/preview/pdf/receipt",
    usedIn: [
      "Payment Receipt email — automatic on each recorded payment",
    ],
    configurable: [],
  },
]

type CardState = "collapsed" | "info" | "preview"

function PdfCard({ doc }: { doc: PdfDoc }) {
  const [state, setState] = useState<CardState>("collapsed")
  const [loading, setLoading] = useState(false)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function openPreview() {
    if (pdfUrl) {
      setState("preview")
      return
    }
    setLoading(true)
    setError("")
    try {
      const res = await fetch(doc.previewUrl)
      if (!res.ok) throw new Error(`${res.status}`)
      const blob = await res.blob()
      setPdfUrl(URL.createObjectURL(blob))
      setState("preview")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load preview")
      setState("info")
    } finally {
      setLoading(false)
    }
  }

  const isOpen = state !== "collapsed"

  return (
    <div className="border border-slate-200 rounded-xl overflow-hidden">
      {/* Header — click to toggle info panel */}
      <button
        type="button"
        onClick={() => setState((s) => s === "collapsed" ? "info" : "collapsed")}
        className="w-full text-left px-5 py-4 bg-slate-50 hover:bg-slate-100/70 transition-colors flex items-start justify-between gap-4"
      >
        <div className="flex items-start gap-3">
          <FileText className="h-5 w-5 text-violet-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-bold text-slate-800">{doc.name}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">{doc.subtitle}</p>
            <p className="text-[10px] font-mono text-slate-400 mt-1">{doc.filenamePattern}</p>
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-slate-400 mt-1 shrink-0 transition-transform", isOpen && "rotate-180")} />
      </button>

      {/* Info panel */}
      {isOpen && (
        <div className="border-t border-slate-200 bg-white">
          <div className="p-5 space-y-4">
            {/* Used in */}
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Attached to</p>
              <ul className="space-y-1">
                {doc.usedIn.map((u) => (
                  <li key={u} className="flex items-start gap-2 text-xs font-medium text-slate-600">
                    <span className="text-slate-300 mt-0.5 shrink-0">→</span>{u}
                  </li>
                ))}
              </ul>
            </div>

            {/* Configurable */}
            {doc.configurable.length > 0 && (
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1.5">Configurable sections</p>
                <ul className="space-y-1">
                  {doc.configurable.map((c) => (
                    <li key={c} className="flex items-start gap-2 text-xs font-medium text-indigo-600">
                      <span className="text-indigo-300 mt-0.5 shrink-0">✎</span>{c}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Preview toggle */}
            <div className="flex items-center justify-between pt-1">
              {error && <p className="text-xs text-rose-500">{error}</p>}
              <button
                type="button"
                onClick={state === "preview" ? () => setState("info") : openPreview}
                disabled={loading}
                className={cn(
                  "ml-auto flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  state === "preview"
                    ? "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    : "bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-60"
                )}
              >
                {loading
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</>
                  : state === "preview"
                  ? <><X className="h-3.5 w-3.5" /> Close Preview</>
                  : <><FileText className="h-3.5 w-3.5" /> Preview PDF</>
                }
              </button>
            </div>
          </div>

          {/* Embedded PDF viewer */}
          {state === "preview" && pdfUrl && (
            <div className="border-t border-slate-200">
              <iframe
                src={pdfUrl}
                className="w-full"
                style={{ height: "700px" }}
                title={`${doc.name} preview`}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function AttachmentsTab() {
  return (
    <div className="space-y-6">
      <SoftCard className="p-6 space-y-4">
        <div>
          <Eyebrow>PDF Documents</Eyebrow>
          <h3 className="text-lg font-headline font-bold text-slate-900 mt-1">Attachment Library</h3>
          <p className="text-sm font-medium text-slate-500 mt-1">
            All PDFs generated and attached by the system. Click any card to view details and preview with sample data.
          </p>
        </div>
        <div className="space-y-3">
          {PDFS.map((doc) => (
            <PdfCard key={doc.name} doc={doc} />
          ))}
        </div>
      </SoftCard>
    </div>
  )
}
