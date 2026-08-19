import { NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"

export async function GET() {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { email: "aditya@letsenterprise.in" },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        passwordHash: true,
      },
    })

    return NextResponse.json({
      success: true,
      userFound: !!dbUser,
      email: dbUser?.email,
      hasPasswordHash: !!dbUser?.passwordHash,
      passwordHashLength: dbUser?.passwordHash?.length ?? 0,
      envDatabaseUrlSet: !!process.env.DATABASE_URL,
      envDatabaseUrlUnpooledSet: !!process.env.DATABASE_URL_UNPOOLED,
    })
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: error?.message || String(error),
      stack: error?.stack,
    }, { status: 500 })
  }
}
