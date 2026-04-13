import React from "react"
import { cn } from "@/lib/utils"

/**
 * Common LE Soft Card Component
 * Usage: Light-mode dashboard widgets, lists, or static content containers.
 */
export function SoftCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-white border border-slate-200/60 p-8 rounded-[1.25rem] shadow-[0_2px_8px_-2px_rgba(0,0,0,0.05),0_1px_4px_-1px_rgba(0,0,0,0.02)] hover:shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08),0_2px_8px_-2px_rgba(0,0,0,0.04)] hover:-translate-y-0.5 transition-all duration-300", className)}>
      {children}
    </div>
  )
}

/**
 * Common LE Admin Card Component
 * Usage: Used for tables and data-heavy views in dark mode admin panels.
 */
export function AdminCard({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <div className={cn("bg-[#160E44]/90 backdrop-blur-md border border-white/10 rounded-2xl overflow-hidden p-6 shadow-2xl", className)}>
      {children}
    </div>
  )
}

/**
 * Section Eyebrow Label
 * Usage: The small, tracked-out text above a main heading or data point.
 */
export function Eyebrow({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <p className={cn("text-[10px] uppercase tracking-[0.2em] font-bold text-slate-400 font-headline", className)}>
      {children}
    </p>
  )
}

/**
 * Hero Campaign Heading
 * Usage: Massive, unapologetic text for campaign headers (e.g. PROOF > POTENTIAL)
 */
export function HeroHeading({ children, className }: { children: React.ReactNode, className?: string }) {
  return (
    <h1 className={cn("font-headline font-black text-5xl md:text-7xl text-deep-blue uppercase tracking-tight leading-none", className)}>
      {children}
    </h1>
  )
}

/**
 * Proof Stat Block
 * Usage: High density evidence block (e.g. "10 Challenges", "15 Months")
 */
export function ProofStat({ 
  value, 
  label, 
  className 
}: { 
  value: string | number
  label: string
  className?: string 
}) {
  return (
    <div className={cn("flex flex-col border-l-4 border-enterprise-blue pl-4", className)}>
      <span className="font-headline font-black text-4xl text-enterprise-blue leading-none mb-1">{value}</span>
      <span className="text-sm font-bold text-slate-500 uppercase tracking-widest">{label}</span>
    </div>
  )
}
