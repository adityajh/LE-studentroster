import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import bcrypt from "bcryptjs"

export async function POST(req: NextRequest) {
  try {
    const { email, password } = await req.json()
    const cleanEmail = (email || "").trim().toLowerCase()
    
    const dbUser = await prisma.user.findFirst({
      where: {
        email: { equals: cleanEmail, mode: "insensitive" },
      },
    })

    if (!dbUser) {
      return NextResponse.json({ status: "USER_NOT_FOUND", email: cleanEmail })
    }

    const isDefault = password === "ChangeMe123!"
    const isMatch = dbUser.passwordHash ? bcrypt.compareSync(password, dbUser.passwordHash) : false

    return NextResponse.json({
      status: "SUCCESS",
      user: { id: dbUser.id, email: dbUser.email, role: dbUser.role },
      hasPasswordHash: !!dbUser.passwordHash,
      isDefaultPasswordMatch: isDefault,
      isBcryptMatch: isMatch,
    })
  } catch (err: any) {
    return NextResponse.json({ status: "ERROR", message: err?.message, stack: err?.stack }, { status: 500 })
  }
}
