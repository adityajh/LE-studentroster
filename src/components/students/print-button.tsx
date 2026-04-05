"use client"

import { Printer } from "lucide-react"

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 h-9 px-4 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all"
    >
      <Printer className="h-4 w-4" />
      Print Receipt
    </button>
  )
}
