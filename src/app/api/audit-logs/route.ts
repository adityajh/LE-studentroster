import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  // Get user role for enforcement
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true },
  })
  
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can view global audit logs." }, { status: 403 })
  }

  try {
    const logs = await prisma.studentAuditLog.findMany({
      include: {
        student: {
          select: {
            rollNo: true,
            name: true,
          }
        },
        changedByUser: {
          select: {
            name: true,
            email: true,
          }
        }
      },
      orderBy: { createdAt: "desc" },
      take: 200, // Limit to recent 200 logs
    })

    return NextResponse.json(logs)
  } catch (err) {
    console.error("Failed to fetch audit logs:", err)
    return NextResponse.json({ error: "Failed to fetch audit logs" }, { status: 500 })
  }
}
