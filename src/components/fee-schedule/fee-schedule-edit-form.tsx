"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save, Trash2 } from "lucide-react"
import { OFFER_TYPES, OFFER_TYPE_LABELS, deadlineApplicability, defaultOfferDescription } from "@/lib/offer-types"
import { cn } from "@/lib/utils"

interface Program {
  id: string
  name: string
  totalFee: { toString(): string }
  registrationFee: { toString(): string }
  year1Fee: { toString(): string }
  year2Fee: { toString(): string }
  year3Fee: { toString(): string }
  targetStudents: number | null
}

interface Offer {
  id: string
  name: string
  type: string
  waiverAmount: { toString(): string }
  deadline: Date | null
  conditions: unknown
  description: string | null
  firstNLimit: number | null
}

interface Scholarship {
  id: string
  name: string
  category: string
  minAmount: { toString(): string }
  maxAmount: { toString(): string }
  description: string | null
}

interface Batch {
  id: string
  year: number
  programs: Program[]
  feeSchedule: {
    id: string
    offers: Offer[]
    scholarships: Scholarship[]
  } | null
}

export function FeeScheduleEditForm({ batch }: { batch: Batch }) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  const [programs, setPrograms] = useState(
    batch.programs.map((p) => ({
      id: p.id,
      name: p.name,
      registrationFee: p.registrationFee.toString(),
      year1Fee: p.year1Fee.toString(),
      year2Fee: p.year2Fee.toString(),
      year3Fee: p.year3Fee.toString(),
      targetStudents: p.targetStudents?.toString() ?? "",
    }))
  )

  const [offers, setOffers] = useState(
    (batch.feeSchedule?.offers ?? []).map((o) => ({
      id: o.id,
      name: o.name,
      type: o.type,
      waiverAmount: o.waiverAmount.toString(),
      deadline: o.deadline ? new Date(o.deadline).toISOString().split("T")[0] : "",
      spreadAcrossYears: (o.conditions as { spreadAcrossYears?: boolean } | null)?.spreadAcrossYears ?? true,
      description: o.description ?? "",
      firstNLimit: o.firstNLimit?.toString() ?? "",
    }))
  )

  const [scholarships, setScholarships] = useState(
    (batch.feeSchedule?.scholarships ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      minAmount: s.minAmount.toString(),
      maxAmount: s.maxAmount.toString(),
      spreadAcrossYears: (s as { spreadAcrossYears?: boolean }).spreadAcrossYears ?? true,
      description: s.description ?? "",
    }))
  )

  const [deletedOfferIds, setDeletedOfferIds] = useState<string[]>([])
  const [deletedScholarshipIds, setDeletedScholarshipIds] = useState<string[]>([])
  const [deletedProgramIds, setDeletedProgramIds] = useState<string[]>([])

  // ── Program handlers ──────────────────────────────────────────────────────
  const updateProgram = (id: string, field: string, value: string) =>
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))

  const addProgram = () =>
    setPrograms((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        registrationFee: "50000",
        year1Fee: "",
        year2Fee: "",
        year3Fee: "",
        targetStudents: "",
      },
    ])

  const removeProgram = (id: string) => {
    setPrograms((prev) => prev.filter((p) => p.id !== id))
    if (!id.startsWith("new-")) setDeletedProgramIds((prev) => [...prev, id])
  }

  // ── Offer handlers ────────────────────────────────────────────────────────
  const updateOffer = (id: string, field: string, value: string | boolean) =>
    setOffers((prev) => prev.map((o) => {
      if (o.id !== id) return o
      const next = { ...o, [field]: value }
      if (field === "type" && deadlineApplicability(String(value)) === "none") next.deadline = ""
      return next
    }))

  const removeOffer = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id))
    if (!id.startsWith("new-")) setDeletedOfferIds((prev) => [...prev, id])
  }

  const addOffer = () =>
    setOffers((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, name: "", type: "FULL_PAYMENT", waiverAmount: "0", deadline: "", spreadAcrossYears: true, description: "", firstNLimit: "" },
    ])

  // ── Scholarship handlers ──────────────────────────────────────────────────
  const updateScholarship = (id: string, field: string, value: string | boolean) =>
    setScholarships((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))

  const removeScholarship = (id: string) => {
    setScholarships((prev) => prev.filter((s) => s.id !== id))
    if (!id.startsWith("new-")) setDeletedScholarshipIds((prev) => [...prev, id])
  }

  const addScholarship = (category: string) =>
    setScholarships((prev) => [
      ...prev,
      { id: `new-${Date.now()}-${category}`, name: "", category, minAmount: "0", maxAmount: "0", spreadAcrossYears: true, description: "" },
    ])

  // ── Save ──────────────────────────────────────────────────────────────────
  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/fee-schedule/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchId: batch.id,
          feeScheduleId: batch.feeSchedule?.id,
          programs,
          offers,
          scholarships,
          deletedOfferIds,
          deletedScholarshipIds,
          deletedProgramIds,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || "Failed to save")
      }
      toast.success("Fee schedule saved")
      router.push(`/fee-schedule/${batch.year}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs ({programs.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="scholarships">Scholarships</TabsTrigger>
        </TabsList>

        {/* Programs */}
        <TabsContent value="programs" className="mt-4 space-y-4">
          {programs.map((program) => (
            <Card key={program.id} className="shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold text-slate-700">
                  {program.name || "New Program"}
                </CardTitle>
                {programs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                    onClick={() => removeProgram(program.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div className="space-y-1 md:col-span-2">
                  <Label className="text-xs">Program Name</Label>
                  <Input
                    value={program.name}
                    onChange={(e) => updateProgram(program.id, "name", e.target.value)}
                    placeholder="e.g. Entrepreneurial Jobs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target Students</Label>
                  <Input
                    type="number"
                    value={program.targetStudents}
                    onChange={(e) => updateProgram(program.id, "targetStudents", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registration Fee (₹)</Label>
                  <Input
                    type="number"
                    value={program.registrationFee}
                    onChange={(e) => updateProgram(program.id, "registrationFee", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 1 — Growth (₹)</Label>
                  <Input
                    type="number"
                    value={program.year1Fee}
                    onChange={(e) => updateProgram(program.id, "year1Fee", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 2 — Projects (₹)</Label>
                  <Input
                    type="number"
                    value={program.year2Fee}
                    onChange={(e) => updateProgram(program.id, "year2Fee", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 3 — Work (₹)</Label>
                  <Input
                    type="number"
                    value={program.year3Fee}
                    onChange={(e) => updateProgram(program.id, "year3Fee", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
          <Button variant="outline" size="sm" onClick={addProgram}>
            + Add Program
          </Button>
        </TabsContent>

        {/* Offers */}
        <TabsContent value="offers" className="mt-4 space-y-4">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-sm font-semibold text-gray-700">Offers configured</h3>
            <Button variant="outline" size="sm" onClick={addOffer}>
              + Add Offer
            </Button>
          </div>
          {offers.map((offer) => (
            <Card key={offer.id} className="shadow-sm">
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs">Offer Name</Label>
                  <Input
                    value={offer.name}
                    onChange={(e) => updateOffer(offer.id, "name", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={offer.type}
                    onChange={(e) => updateOffer(offer.id, "type", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {OFFER_TYPES.map((t) => (
                      <option key={t} value={t}>{OFFER_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Waiver Amount (₹)</Label>
                  <Input
                    type="number"
                    value={offer.waiverAmount}
                    onChange={(e) => updateOffer(offer.id, "waiverAmount", e.target.value)}
                  />
                </div>
                {(() => {
                  const dl = deadlineApplicability(offer.type)
                  const disabled = dl === "none"
                  return (
                    <div className="space-y-1">
                      <Label className={cn("text-xs", disabled && "text-slate-400")}>
                        Deadline {dl === "required" ? <span className="text-rose-500">*</span> : dl === "optional" ? "(optional)" : "(N/A)"}
                      </Label>
                      <Input
                        type="date"
                        value={disabled ? "" : offer.deadline}
                        disabled={disabled}
                        onChange={(e) => updateOffer(offer.id, "deadline", e.target.value)}
                        className={cn(disabled && "bg-slate-50 text-slate-400 cursor-not-allowed")}
                      />
                    </div>
                  )
                })()}
                {offer.type === "FIRST_N" && (
                  <div className="space-y-1">
                    <Label className="text-xs">First N — number of seats</Label>
                    <Input
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      value={offer.firstNLimit}
                      onChange={(e) => updateOffer(offer.id, "firstNLimit", e.target.value)}
                    />
                  </div>
                )}
                <div className="space-y-1 md:col-span-3">
                  <Label className="text-xs">
                    Description <span className="text-slate-400 font-normal">(one-line; shown in offer letter, dialog, and fee schedule)</span>
                  </Label>
                  <Input
                    value={offer.description}
                    placeholder={defaultOfferDescription({ type: offer.type, deadline: offer.deadline || null, firstNLimit: offer.firstNLimit ? Number(offer.firstNLimit) : null })}
                    onChange={(e) => updateOffer(offer.id, "description", e.target.value)}
                  />
                </div>
                <div className="md:col-span-2 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id={`spread-${offer.id}`}
                    checked={offer.spreadAcrossYears}
                    onChange={(e) => updateOffer(offer.id, "spreadAcrossYears", e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <label htmlFor={`spread-${offer.id}`} className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                    Spread across 3 years (÷3 per year)
                    {!offer.spreadAcrossYears && (
                      <span className="ml-2 text-amber-600 font-semibold">— deducted in full, Year 1 only</span>
                    )}
                  </label>
                </div>
                <div className="flex justify-end items-center">
                  <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeOffer(offer.id)}>
                    Remove Offer
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        {/* Scholarships */}
        <TabsContent value="scholarships" className="mt-4 space-y-6">
          {["A", "B"].map((cat) => (
            <div key={cat}>
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-semibold text-gray-700">Category {cat}</h3>
                <Button variant="outline" size="sm" onClick={() => addScholarship(cat)}>
                  + Add Scholarship
                </Button>
              </div>
              {scholarships
                .filter((s) => s.category === cat)
                .map((s) => (
                  <Card key={s.id} className="shadow-sm mb-3">
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Scholarship Name</Label>
                        <Input
                          value={s.name}
                          onChange={(e) => updateScholarship(s.id, "name", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Amount (₹)</Label>
                        <Input
                          type="number"
                          value={s.minAmount}
                          onChange={(e) => updateScholarship(s.id, "minAmount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Amount (₹)</Label>
                        <Input
                          type="number"
                          value={s.maxAmount}
                          onChange={(e) => updateScholarship(s.id, "maxAmount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1 md:col-span-3">
                        <Label className="text-xs">
                          Description <span className="text-slate-400 font-normal">(one-line; optional)</span>
                        </Label>
                        <Input
                          value={s.description}
                          placeholder="e.g. Awarded to students with national-level sports achievements"
                          onChange={(e) => updateScholarship(s.id, "description", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id={`spread-sch-${s.id}`}
                          checked={s.spreadAcrossYears}
                          onChange={(e) => updateScholarship(s.id, "spreadAcrossYears", e.target.checked)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <label htmlFor={`spread-sch-${s.id}`} className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                          Spread across 3 years (÷3 per year)
                          {!s.spreadAcrossYears && (
                            <span className="ml-2 text-amber-600 font-semibold">— deducted in full, Year 1 only</span>
                          )}
                        </label>
                      </div>
                      <div className="flex justify-end items-center">
                        <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => removeScholarship(s.id)}>
                          Remove Scholarship
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Save */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push(`/fee-schedule/${batch.year}`)}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Save Changes</>
          )}
        </Button>
      </div>
    </div>
  )
}
