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

interface ProgramDraft {
  _key: string
  name: string
  registrationFee: string
  year1Fee: string
  year2Fee: string
  year3Fee: string
  targetStudents: string
}

interface OfferDraft {
  _key: string
  name: string
  type: string
  waiverAmount: string
  deadline: string
  spreadAcrossYears: boolean
}

interface ScholarshipDraft {
  _key: string
  name: string
  category: string
  minAmount: string
  maxAmount: string
  spreadAcrossYears: boolean
}

const OFFER_TYPES = [
  "EARLY_BIRD",
  "FIRST_N",
  "FULL_PAYMENT",
  "ACCEPTANCE_7DAY",
  "REFERRAL",
  "OTHER",
]

export function NewFeeScheduleForm() {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [year, setYear] = useState(String(new Date().getFullYear() + 1))
  const [batchName, setBatchName] = useState("")

  const [programs, setPrograms] = useState<ProgramDraft[]>([
    { _key: "p1", name: "", registrationFee: "50000", year1Fee: "", year2Fee: "", year3Fee: "", targetStudents: "" },
  ])
  const [offers, setOffers] = useState<OfferDraft[]>([])
  const [scholarships, setScholarships] = useState<ScholarshipDraft[]>([])

  const addProgram = () =>
    setPrograms((prev) => [
      ...prev,
      { _key: `p-${Date.now()}`, name: "", registrationFee: "50000", year1Fee: "", year2Fee: "", year3Fee: "", targetStudents: "" },
    ])

  const removeProgram = (key: string) => setPrograms((prev) => prev.filter((p) => p._key !== key))

  const updateProgram = (key: string, field: keyof ProgramDraft, value: string) =>
    setPrograms((prev) => prev.map((p) => (p._key === key ? { ...p, [field]: value } : p)))

  const addOffer = () =>
    setOffers((prev) => [
      ...prev,
      { _key: `o-${Date.now()}`, name: "", type: "FULL_PAYMENT", waiverAmount: "0", deadline: "", spreadAcrossYears: true },
    ])

  const removeOffer = (key: string) => setOffers((prev) => prev.filter((o) => o._key !== key))

  const updateOffer = (key: string, field: keyof OfferDraft, value: string | boolean) =>
    setOffers((prev) => prev.map((o) => (o._key === key ? { ...o, [field]: value } : o)))

  const addScholarship = (category: string) =>
    setScholarships((prev) => [
      ...prev,
      { _key: `s-${Date.now()}-${category}`, name: "", category, minAmount: "0", maxAmount: "0", spreadAcrossYears: true },
    ])

  const removeScholarship = (key: string) => setScholarships((prev) => prev.filter((s) => s._key !== key))

  const updateScholarship = (key: string, field: keyof ScholarshipDraft, value: string | boolean) =>
    setScholarships((prev) => prev.map((s) => (s._key === key ? { ...s, [field]: value } : s)))

  const handleCreate = async () => {
    if (!year || programs.some((p) => !p.name || !p.year1Fee)) {
      toast.error("Year and program names/fees are required")
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/fee-schedule/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ year, name: batchName || `Batch ${year}`, programs, offers, scholarships }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed")
      toast.success(`Fee schedule for Batch ${year} created`)
      router.push(`/fee-schedule/${year}`)
      router.refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to create. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Batch details */}
      <Card className="shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Batch Details</CardTitle>
        </CardHeader>
        <CardContent className="flex gap-4">
          <div className="w-48 space-y-1">
            <Label className="text-xs">Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 2027"
            />
          </div>
          <div className="flex-1 space-y-1">
            <Label className="text-xs">Batch Name</Label>
            <Input
              value={batchName}
              onChange={(e) => setBatchName(e.target.value)}
              placeholder={`e.g. Batch ${year}`}
            />
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs ({programs.length})</TabsTrigger>
          <TabsTrigger value="offers">Offers ({offers.length})</TabsTrigger>
          <TabsTrigger value="scholarships">Scholarships ({scholarships.length})</TabsTrigger>
        </TabsList>

        {/* Programs */}
        <TabsContent value="programs" className="mt-4 space-y-4">
          {programs.map((program) => (
            <Card key={program._key} className="shadow-sm">
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm font-semibold">
                  {program.name || "New Program"}
                </CardTitle>
                {programs.length > 1 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50 h-7 px-2"
                    onClick={() => removeProgram(program._key)}
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
                    onChange={(e) => updateProgram(program._key, "name", e.target.value)}
                    placeholder="e.g. Entrepreneurial Jobs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Target Students</Label>
                  <Input
                    type="number"
                    value={program.targetStudents}
                    onChange={(e) => updateProgram(program._key, "targetStudents", e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Registration Fee (₹)</Label>
                  <Input
                    type="number"
                    value={program.registrationFee}
                    onChange={(e) => updateProgram(program._key, "registrationFee", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 1 — Growth (₹)</Label>
                  <Input
                    type="number"
                    value={program.year1Fee}
                    onChange={(e) => updateProgram(program._key, "year1Fee", e.target.value)}
                    placeholder="e.g. 400000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 2 — Projects (₹)</Label>
                  <Input
                    type="number"
                    value={program.year2Fee}
                    onChange={(e) => updateProgram(program._key, "year2Fee", e.target.value)}
                    placeholder="e.g. 400000"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Year 3 — Work (₹)</Label>
                  <Input
                    type="number"
                    value={program.year3Fee}
                    onChange={(e) => updateProgram(program._key, "year3Fee", e.target.value)}
                    placeholder="e.g. 400000"
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
          <div className="flex justify-between items-center">
            <p className="text-xs font-medium text-slate-500">Configure offers for this batch. You can add more after creation.</p>
            <Button variant="outline" size="sm" onClick={addOffer}>
              + Add Offer
            </Button>
          </div>
          {offers.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No offers yet — click &quot;+ Add Offer&quot; to add one.</p>
          )}
          {offers.map((offer) => (
            <Card key={offer._key} className="shadow-sm">
              <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                <div className="space-y-1 md:col-span-1">
                  <Label className="text-xs">Offer Name</Label>
                  <Input
                    value={offer.name}
                    onChange={(e) => updateOffer(offer._key, "name", e.target.value)}
                    placeholder="e.g. Early Bird"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <select
                    value={offer.type}
                    onChange={(e) => updateOffer(offer._key, "type", e.target.value)}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm"
                  >
                    {OFFER_TYPES.map((t) => (
                      <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Waiver Amount (₹)</Label>
                  <Input
                    type="number"
                    value={offer.waiverAmount}
                    onChange={(e) => updateOffer(offer._key, "waiverAmount", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deadline (if applicable)</Label>
                  <Input
                    type="date"
                    value={offer.deadline}
                    onChange={(e) => updateOffer(offer._key, "deadline", e.target.value)}
                  />
                </div>
                <div className="md:col-span-1 flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id={`spread-${offer._key}`}
                    checked={offer.spreadAcrossYears}
                    onChange={(e) => updateOffer(offer._key, "spreadAcrossYears", e.target.checked)}
                    className="w-4 h-4 accent-blue-600"
                  />
                  <label htmlFor={`spread-${offer._key}`} className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                    Spread across 3 years (÷3 per year)
                    {!offer.spreadAcrossYears && (
                      <span className="ml-2 text-amber-600 font-semibold">— Year 1 only</span>
                    )}
                  </label>
                </div>
                <div className="flex justify-end items-center">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => removeOffer(offer._key)}
                  >
                    Remove
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
                <h3 className="text-sm font-semibold text-slate-700">Category {cat}</h3>
                <Button variant="outline" size="sm" onClick={() => addScholarship(cat)}>
                  + Add Scholarship
                </Button>
              </div>
              {scholarships.filter((s) => s.category === cat).length === 0 && (
                <p className="text-xs text-slate-400 py-3">No Category {cat} scholarships.</p>
              )}
              {scholarships
                .filter((s) => s.category === cat)
                .map((s) => (
                  <Card key={s._key} className="shadow-sm mb-3">
                    <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Scholarship Name</Label>
                        <Input
                          value={s.name}
                          onChange={(e) => updateScholarship(s._key, "name", e.target.value)}
                          placeholder="e.g. Merit Scholarship"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Min Amount (₹)</Label>
                        <Input
                          type="number"
                          value={s.minAmount}
                          onChange={(e) => updateScholarship(s._key, "minAmount", e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Max Amount (₹)</Label>
                        <Input
                          type="number"
                          value={s.maxAmount}
                          onChange={(e) => updateScholarship(s._key, "maxAmount", e.target.value)}
                        />
                      </div>
                      <div className="md:col-span-2 flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id={`spread-sch-${s._key}`}
                          checked={s.spreadAcrossYears}
                          onChange={(e) => updateScholarship(s._key, "spreadAcrossYears", e.target.checked)}
                          className="w-4 h-4 accent-blue-600"
                        />
                        <label htmlFor={`spread-sch-${s._key}`} className="text-xs font-medium text-slate-600 cursor-pointer select-none">
                          Spread across 3 years (÷3 per year)
                          {!s.spreadAcrossYears && (
                            <span className="ml-2 text-amber-600 font-semibold">— Year 1 only</span>
                          )}
                        </label>
                      </div>
                      <div className="flex justify-end items-center">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-500 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeScholarship(s._key)}
                        >
                          Remove
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          ))}
        </TabsContent>
      </Tabs>

      {/* Actions */}
      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push("/fee-schedule")}>
          Cancel
        </Button>
        <Button onClick={handleCreate} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700 text-white">
          {saving ? (
            <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creating...</>
          ) : (
            <><Save className="h-4 w-4 mr-2" /> Create Fee Schedule</>
          )}
        </Button>
      </div>
    </div>
  )
}
