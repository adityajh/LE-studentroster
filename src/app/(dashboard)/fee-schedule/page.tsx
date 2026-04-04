import { Card, CardContent } from "@/components/ui/card"
import { FileText } from "lucide-react"

export default function FeeSchedulePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Fee Schedule</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage programs, offers, and scholarships per batch year
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileText className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Coming in Phase 2</p>
          <p className="text-xs mt-1">Fee schedule management with lock/unlock</p>
        </CardContent>
      </Card>
    </div>
  )
}
