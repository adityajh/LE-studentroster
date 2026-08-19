import { NextResponse } from "next/server"
import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"
import { Pool } from "@neondatabase/serverless"

export async function GET() {
  try {
    const rawUrl = process.env.DATABASE_URL
    const rawUnpooled = process.env.DATABASE_URL_UNPOOLED

    const connectionString =
      rawUnpooled ||
      rawUrl ||
      "postgresql://neondb_owner:npg_bmrZJ91UKvHO@ep-floral-forest-a48v8463.us-east-1.aws.neon.tech/neondb?sslmode=require"

    const pool = new Pool({ connectionString })
    const adapter = new PrismaNeon(pool as any)
    const testPrisma = new PrismaClient({ adapter })

    const users = await testPrisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    })
    await testPrisma.$disconnect()

    return NextResponse.json({
      rawUrlDefined: !!rawUrl,
      rawUrlPrefix: rawUrl ? rawUrl.substring(0, 15) : null,
      rawUnpooledDefined: !!rawUnpooled,
      rawUnpooledPrefix: rawUnpooled ? rawUnpooled.substring(0, 15) : null,
      usersCount: users.length,
      users: users.map(u => ({
        email: u.email,
        name: u.name,
        role: u.role,
        hasPasswordHash: !!u.passwordHash,
      })),
    })
  } catch (err: any) {
    return NextResponse.json({
      error: err?.message || String(err),
      rawUrlDefined: !!process.env.DATABASE_URL,
      rawUnpooledDefined: !!process.env.DATABASE_URL_UNPOOLED,
      stack: err?.stack,
    }, { status: 500 })
  }
}
