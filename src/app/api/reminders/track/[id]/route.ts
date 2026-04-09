import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

const TRANSPARENT_GIF = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64"
)

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  try {
    const log = await prisma.reminderLog.findUnique({
      where: { id },
      select: { readAt: true },
    })

    if (log && !log.readAt) {
      await prisma.reminderLog.update({
        where: { id },
        data: { readAt: new Date() },
      })
    }
  } catch (error) {
    // Fail silently so the tracking image always loads
    console.error("Tracking pixel error:", error)
  }

  return new NextResponse(TRANSPARENT_GIF, {
    status: 200,
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
    },
  })
}
