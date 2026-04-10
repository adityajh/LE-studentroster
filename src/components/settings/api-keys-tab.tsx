"use client"

import { useState, useTransition } from "react"
import { createApiKey, revokeApiKey } from "@/app/actions/api-keys"
import { useRouter } from "next/navigation"
import { Loader2, Plus, Key, Copy, Check, ShieldOff, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ApiKey = {
  id: string
  name: string
  isActive: boolean
  createdAt: Date
  lastUsedAt: Date | null
  createdBy: { name: string | null; email: string }
}

export function ApiKeysTab({ keys }: { keys: ApiKey[] }) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [newKeyName, setNewKeyName] = useState("")
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [revoking, setRevoking] = useState<string | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  function handleCreate() {
    if (!newKeyName.trim()) return
    startTransition(async () => {
      const res = await createApiKey(newKeyName.trim())
      setNewKeyValue(res.plainKey)
      setNewKeyName("")
      router.refresh()
    })
  }

  function handleCopy() {
    if (!newKeyValue) return
    navigator.clipboard.writeText(newKeyValue)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleRevoke(id: string) {
    setRevoking(id)
    startTransition(async () => {
      await revokeApiKey(id)
      setRevoking(null)
      router.refresh()
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-bold text-slate-800">API Keys</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Keys authenticate external integrations with <code className="text-xs bg-slate-100 px-1 py-0.5 rounded">x-api-key</code> header.
          </p>
        </div>
        {!showCreate && (
          <Button size="sm" onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="h-3.5 w-3.5 mr-1.5" /> Generate Key
          </Button>
        )}
      </div>

      {/* Create form */}
      {showCreate && !newKeyValue && (
        <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex items-center gap-3">
          <Input
            placeholder="Key name (e.g. Admissions CRM)"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreate()}
            className="flex-1"
            autoFocus
          />
          <Button onClick={handleCreate} disabled={pending || !newKeyName.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create"}
          </Button>
          <Button variant="outline" onClick={() => setShowCreate(false)} className="shrink-0">Cancel</Button>
        </div>
      )}

      {/* Show new key ONCE */}
      {newKeyValue && (
        <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-5">
          <p className="text-sm font-bold text-amber-800 mb-1">⚠️ Copy this key now — it will never be shown again</p>
          <div className="flex items-center gap-3 mt-3">
            <code className="flex-1 bg-white border border-amber-200 rounded-lg px-4 py-3 text-sm font-mono text-slate-800 break-all">{newKeyValue}</code>
            <Button onClick={handleCopy} size="sm" variant="outline" className="shrink-0">
              {copied ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </div>
          <Button className="mt-3" size="sm" variant="outline" onClick={() => { setNewKeyValue(null); setShowCreate(false) }}>
            Done
          </Button>
        </div>
      )}

      {/* Keys table */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-[10px] uppercase font-bold tracking-widest text-slate-400">
            <tr>
              <th className="px-6 py-4 text-left">Name</th>
              <th className="px-6 py-4 text-left">Status</th>
              <th className="px-6 py-4 text-left">Last Used</th>
              <th className="px-6 py-4 text-left">Created</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {keys.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-10 text-center text-slate-400 font-medium">
                  <Key className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                  No API keys yet. Generate one to start.
                </td>
              </tr>
            )}
            {keys.map((k) => (
              <tr key={k.id} className="hover:bg-slate-50/50 transition-colors">
                <td className="px-6 py-4">
                  <p className="font-semibold text-slate-800">{k.name}</p>
                  <p className="text-xs text-slate-500">by {k.createdBy.name || k.createdBy.email}</p>
                </td>
                <td className="px-6 py-4">
                  <span className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[10px] uppercase font-bold tracking-wider border",
                    k.isActive
                      ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                      : "bg-slate-100 text-slate-400 border-slate-200"
                  )}>
                    {k.isActive ? "Active" : "Revoked"}
                  </span>
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {k.lastUsedAt ? (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(k.lastUsedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  ) : (
                    <span className="text-slate-300">Never</span>
                  )}
                </td>
                <td className="px-6 py-4 text-slate-500 text-xs">
                  {new Date(k.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </td>
                <td className="px-6 py-4 text-right">
                  {k.isActive ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRevoke(k.id)}
                      disabled={revoking === k.id}
                      className="text-rose-600 border-rose-200 hover:bg-rose-50"
                    >
                      {revoking === k.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ShieldOff className="h-3.5 w-3.5 mr-1" />}
                      Revoke
                    </Button>
                  ) : (
                    <span className="text-xs text-slate-300 italic">Revoked</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
