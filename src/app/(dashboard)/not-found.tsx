import Link from "next/link"
import { Search } from "lucide-react"

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
      <div className="w-16 h-16 rounded-full bg-slate-100 flex items-center justify-center">
        <Search className="h-8 w-8 text-slate-400" />
      </div>
      <div>
        <h2 className="text-xl font-extrabold text-slate-900">Page Not Found</h2>
        <p className="text-sm font-medium text-slate-500 mt-1">
          The record you're looking for doesn't exist or has been removed.
        </p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-slate-900 hover:bg-slate-700 text-white text-sm font-bold rounded-xl transition-all"
      >
        Go to Dashboard
      </Link>
    </div>
  )
}
