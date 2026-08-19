import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    })
    return NextResponse.json({
      dbUsersCount: users.length,
      users: users.map(u => ({
        email: u.email,
        name: u.name,
        role: u.role,
        hasPasswordHash: !!u.passwordHash,
        passwordHashPrefix: u.passwordHash ? u.passwordHash.substring(0, 7) : null,
      })),
      databaseUrlHost: process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL.replace("postgresql://", "http://")).host : "NOT_SET",
      unpooledHost: process.env.DATABASE_URL_UNPOOLED ? new URL(process.env.DATABASE_URL_UNPOOLED.replace("postgresql://", "http://")).host : "NOT_SET",
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message, stack: err.stack }, { status: 500 })
  }
}
