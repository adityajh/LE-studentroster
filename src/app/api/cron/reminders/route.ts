import { NextRequest, NextResponse } from "next/server"
import { processDailyReminders } from "@/lib/reminders"

// Vercel Cron calls this daily (configured in vercel.json)
// Also manually callable with the CRON_SECRET header.
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization")
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const result = await processDailyReminders()
    return NextResponse.json({ ok: true, ...result, runAt: new Date().toISOString() })
  } catch (err) {
    console.error("[reminders cron] error:", err)
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Unknown error" },
      { status: 500 }
    )
  }
}
