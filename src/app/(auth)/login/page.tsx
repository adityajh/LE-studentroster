"use client"

import { useState } from "react"
import { signIn } from "next-auth/react"
import Image from "next/image"
import { Loader2, Mail } from "lucide-react"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return
    setLoading(true)
    setError("")
    try {
      const result = await signIn("nodemailer", { email, redirect: false })
      if (result?.error) {
        setError("Something went wrong. Please try again.")
      } else {
        setSent(true)
      }
    } catch {
      setError("Something went wrong. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex justify-center mb-10">
          <Image
            src="/le-logo-light.png"
            alt="Let's Enterprise"
            width={180}
            height={60}
            className="object-contain"
            priority
          />
        </div>

        {/* Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="flex justify-center">
                <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4">
                  <Mail className="h-7 w-7 text-emerald-400" />
                </div>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                  Magic Link Sent
                </p>
                <p className="text-lg font-extrabold text-white">Check your inbox</p>
              </div>
              <p className="text-sm font-medium text-slate-400">
                We sent a sign-in link to{" "}
                <span className="text-slate-200 font-semibold">{email}</span>.
                It expires in 24 hours.
              </p>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
                  Student Roster
                </p>
                <p className="text-lg font-extrabold text-white">Sign in</p>
                <p className="text-sm font-medium text-slate-400 mt-1">
                  Enter your email to receive a magic link
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
                    Email address
                  </label>
                  <input
                    type="email"
                    placeholder="you@letsent.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    disabled={loading}
                    className="w-full bg-slate-800 border-2 border-slate-700 text-white font-semibold h-12 rounded-xl px-4 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all"
                  />
                </div>

                {error && (
                  <p className="text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-2 rounded-lg">
                    {error}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={loading || !email}
                  className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    "Send magic link"
                  )}
                </button>
              </form>
            </>
          )}
        </div>

        <p className="text-center text-[10px] uppercase tracking-widest font-bold text-slate-600 mt-8">
          Let&apos;s Enterprise · Student Roster System
        </p>
      </div>
    </div>
  )
}
