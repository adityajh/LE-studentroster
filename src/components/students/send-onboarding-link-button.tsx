"use client"

import { useState } from "react"
import { Link2, Loader2, CheckCircle2, ShieldCheck, Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"

type Props = {
  studentId: string
  currentStatus: string
  isAdmin: boolean
}

export function SendOnboardingLinkButton({ studentId, currentStatus, isAdmin }: Props) {
  const [loading, setLoading] = useState(false)
  const [approving, setApproving] = useState(false)
  const [generatedUrl, setGeneratedUrl] = useState<string | null>(null)
  const [showLinkModal, setShowLinkModal] = useState(false)

  const isApproved = currentStatus === "APPROVED"
  const isSubmitted = currentStatus === "SUBMITTED"

  const handleGenerateLink = async (sendEmail: boolean) => {
    setLoading(true)
    try {
      const res = await fetch(`/api/students/${studentId}/onboarding-link`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sendEmail }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Failed to generate link")
        return
      }
      const data = await res.json()
      setGeneratedUrl(data.onboardingUrl)
      setShowLinkModal(true)
      if (sendEmail) {
        if (data.emailSent === false) {
          toast.warning(data.emailSkipReason ?? "Email could not be sent — copy the link manually")
        } else {
          toast.success("Onboarding link sent to student's email")
        }
      }
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async () => {
    setApproving(true)
    try {
      const res = await fetch(`/api/students/${studentId}/approve-onboarding`, {
        method: "POST",
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error ?? "Failed to approve")
        return
      }
      toast.success("Profile approved!")
      window.location.reload()
    } finally {
      setApproving(false)
    }
  }

  const copyLink = () => {
    if (generatedUrl) {
      navigator.clipboard.writeText(generatedUrl)
      toast.success("Link copied to clipboard")
    }
  }

  if (isApproved) return null

  return (
    <>
      <div className="flex items-center gap-2">
        {/* Send / Resend link */}
        {!isApproved && (
          <div className="relative group">
            <button
              disabled={loading}
              onClick={() => handleGenerateLink(true)}
              className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold transition-all shrink-0 bg-[#3663AD] hover:bg-[#25BCBD] text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60 disabled:transform-none"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Link2 className="h-4 w-4" />
              )}
              {currentStatus === "LINK_SENT" || isSubmitted ? "Resend Link" : "Send Onboard Link"}
            </button>
          </div>
        )}

        {/* Approve — only for SUBMITTED + admin */}
        {isSubmitted && isAdmin && (
          <button
            disabled={approving}
            onClick={handleApprove}
            className="flex items-center gap-1.5 h-9 px-4 rounded-xl text-sm font-bold transition-all shrink-0 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm hover:shadow-md hover:-translate-y-0.5 disabled:opacity-60"
          >
            {approving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ShieldCheck className="h-4 w-4" />
            )}
            Approve Profile
          </button>
        )}
      </div>

      {/* Link modal */}
      {showLinkModal && generatedUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm" onClick={() => setShowLinkModal(false)}>
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[#3663AD]/10 flex items-center justify-center">
                <CheckCircle2 className="h-5 w-5 text-[#3663AD]" />
              </div>
              <div>
                <h2 className="text-lg font-black text-slate-900">Onboarding Link Created</h2>
                <p className="text-xs text-slate-500 font-medium">Valid for 14 days</p>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-4">
              <p className="text-xs font-mono text-slate-600 break-all leading-relaxed">{generatedUrl}</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={copyLink}
                className="flex-1 flex items-center justify-center gap-2 h-10 rounded-xl bg-[#3663AD] hover:bg-[#25BCBD] text-white text-sm font-bold transition-all"
              >
                <Copy className="h-4 w-4" /> Copy Link
              </button>
              <a
                href={generatedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 h-10 px-4 rounded-xl border-2 border-slate-200 text-slate-600 text-sm font-bold hover:border-[#3663AD] hover:text-[#3663AD] transition-all"
              >
                <ExternalLink className="h-4 w-4" /> Preview
              </a>
              <button
                onClick={() => setShowLinkModal(false)}
                className="h-10 px-4 rounded-xl border-2 border-slate-200 text-slate-500 text-sm font-bold hover:border-slate-300 transition-all"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
