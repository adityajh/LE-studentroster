"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Loader2, Save } from "lucide-react"

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
}

interface Scholarship {
  id: string
  name: string
  category: string
  minAmount: { toString(): string }
  maxAmount: { toString(): string }
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
      totalFee: p.totalFee.toString(),
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
    }))
  )

  const [scholarships, setScholarships] = useState(
    (batch.feeSchedule?.scholarships ?? []).map((s) => ({
      id: s.id,
      name: s.name,
      category: s.category,
      minAmount: s.minAmount.toString(),
      maxAmount: s.maxAmount.toString(),
    }))
  )

  const [deletedOfferIds, setDeletedOfferIds] = useState<string[]>([])
  const [deletedScholarshipIds, setDeletedScholarshipIds] = useState<string[]>([])

  const updateProgram = (id: string, field: string, value: string) => {
    setPrograms((prev) => prev.map((p) => (p.id === id ? { ...p, [field]: value } : p)))
  }

  const updateOffer = (id: string, field: string, value: string) => {
    setOffers((prev) => prev.map((o) => (o.id === id ? { ...o, [field]: value } : o)))
  }

  const removeOffer = (id: string) => {
    setOffers((prev) => prev.filter((o) => o.id !== id))
    if (!id.startsWith("new-")) setDeletedOfferIds((prev) => [...prev, id])
  }

  const addOffer = () => {
    setOffers((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}`,
        name: "",
        type: "FULL_PAYMENT", // default enum
        waiverAmount: "0",
        deadline: "",
      },
    ])
  }

  const updateScholarship = (id: string, field: string, value: string) => {
    setScholarships((prev) => prev.map((s) => (s.id === id ? { ...s, [field]: value } : s)))
  }

  const removeScholarship = (id: string) => {
    setScholarships((prev) => prev.filter((s) => s.id !== id))
    if (!id.startsWith("new-")) setDeletedScholarshipIds((prev) => [...prev, id])
  }

  const addScholarship = (category: string) => {
    setScholarships((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${category}`,
        name: "",
        category,
        minAmount: "0",
        maxAmount: "0",
      },
    ])
  }

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
        }),
      })
      if (!res.ok) throw new Error("Failed")
      toast.success("Fee schedule saved")
      router.push(`/fee-schedule/${batch.year}`)
      router.refresh()
    } catch {
      toast.error("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="programs">
        <TabsList>
          <TabsTrigger value="programs">Programs</TabsTrigger>
          <TabsTrigger value="offers">Offers</TabsTrigger>
          <TabsTrigger value="scholarships">Scholarships</TabsTrigger>
        </TabsList>

        {/* Programs */}
        <TabsContent value="programs" className="mt-4 space-y-4">
          {programs.map((program) => (
            <Card key={program.id} className="shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base">{program.name}</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-2 md:grid-cols-3 gap-4">
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
                <div className="space-y-1">
                  <Label className="text-xs">Target Students</Label>
                  <Input
                    type="number"
                    value={program.targetStudents}
                    onChange={(e) => updateProgram(program.id, "targetStudents", e.target.value)}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
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
                  <Label className="text-xs">Waiver Amount (₹)</Label>
                  <Input
                    type="number"
                    value={offer.waiverAmount}
                    onChange={(e) => updateOffer(offer.id, "waiverAmount", e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deadline (if applicable)</Label>
                  <Input
                    type="date"
                    value={offer.deadline}
                    onChange={(e) => updateOffer(offer.id, "deadline", e.target.value)}
                  />
                </div>
                <div className="md:col-span-3 flex justify-end">
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
                      <div className="md:col-span-3 flex justify-end">
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
