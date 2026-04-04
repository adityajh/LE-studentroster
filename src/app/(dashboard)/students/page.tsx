import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Users } from "lucide-react"

export default function StudentsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Students</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage student enrollment and fee payments
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Users className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Coming in Phase 3</p>
          <p className="text-xs mt-1">Student list, enrollment and payment tracking</p>
        </CardContent>
      </Card>
    </div>
  )
}
