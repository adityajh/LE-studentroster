import { Card, CardContent } from "@/components/ui/card"
import { Settings } from "lucide-react"

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage team members, email configuration, and API keys
        </p>
      </div>
      <Card className="shadow-sm">
        <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <Settings className="h-12 w-12 mb-3 text-gray-300" />
          <p className="text-sm font-medium">Coming in Phase 7</p>
          <p className="text-xs mt-1">Team management, email config, API keys</p>
        </CardContent>
      </Card>
    </div>
  )
}
