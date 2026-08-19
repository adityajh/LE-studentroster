"use client"

import { useState, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Image from "next/image"
import { Loader2, Eye, EyeOff, Lock } from "lucide-react"
import { loginAction } from "@/app/actions/auth"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get("callbackUrl") || "/students"

  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password) return
    setLoading(true)
    setError("")

    try {
      const formData = new FormData()
      formData.set("email", email)
      formData.set("password", password)
      formData.set("callbackUrl", callbackUrl)

      const result = await loginAction(null, formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch (err: any) {
      if (err?.digest?.startsWith("NEXT_REDIRECT") || err?.message?.includes("NEXT_REDIRECT")) {
        return
      }
      setError("Invalid email or password. Please try again.")
      setLoading(false)
    }
  }

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
      <div className="mb-6">
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-400 mb-1">
          Student Roster
        </p>
        <p className="text-lg font-extrabold text-white">Sign in</p>
        <p className="text-sm font-medium text-slate-400 mt-1">
          Enter your email and password to access the portal
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="hidden" name="redirectTo" value={callbackUrl} />
        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Email address
          </label>
          <input
            type="email"
            name="email"
            placeholder="you@letsent.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            disabled={loading}
            className="w-full bg-slate-800 border-2 border-slate-700 text-white font-semibold h-12 rounded-xl px-4 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all text-sm"
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] uppercase tracking-widest font-bold text-slate-400">
            Password
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              name="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="w-full bg-slate-800 border-2 border-slate-700 text-white font-semibold h-12 rounded-xl pl-4 pr-11 placeholder:text-slate-600 focus:border-indigo-500 focus:outline-none transition-all text-sm"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors p-1"
              tabIndex={-1}
            >
              {showPassword ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-xs font-semibold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-3 py-2.5 rounded-lg flex items-center gap-2">
            <Lock className="w-3.5 h-3.5 shrink-0 text-rose-400" />
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading || !email || !password}
          className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 text-sm mt-2"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            "Sign in"
          )}
        </button>
      </form>
    </div>
  )
}

export default function LoginPage() {
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

        {/* Card with Suspense */}
        <Suspense fallback={
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mx-auto text-indigo-500" />
          </div>
        }>
          <LoginForm />
        </Suspense>

        <p className="text-center text-[10px] uppercase tracking-widest font-bold text-slate-600 mt-8">
          Let&apos;s Enterprise · Student Roster System
        </p>
      </div>
    </div>
  )
}


