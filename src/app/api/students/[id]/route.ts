import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const student = await prisma.student.findUnique({ where: { id } })
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  const body = await req.json()
  const {
    firstName, lastName,
    email, contact,
    bloodGroup, city,
    address, localAddress,
    parent1Name, parent1Email, parent1Phone,
    parent2Name, parent2Email, parent2Phone,
    localGuardianName, localGuardianPhone, localGuardianEmail,
  } = body

  // Derive full name from first+last if provided
  const name =
    firstName && lastName
      ? `${firstName} ${lastName}`.trim()
      : firstName || lastName || student.name

  const updated = await prisma.student.update({
    where: { id },
    data: {
      firstName:          firstName          ?? null,
      lastName:           lastName           ?? null,
      name,
      email:              email              ?? student.email,
      contact:            contact            ?? student.contact,
      bloodGroup:         bloodGroup         ?? null,
      city:               city               ?? null,
      address:            address            ?? null,
      localAddress:       localAddress       ?? null,
      parent1Name:        parent1Name        ?? null,
      parent1Email:       parent1Email       ?? null,
      parent1Phone:       parent1Phone       ?? null,
      parent2Name:        parent2Name        ?? null,
      parent2Email:       parent2Email       ?? null,
      parent2Phone:       parent2Phone       ?? null,
      localGuardianName:  localGuardianName  ?? null,
      localGuardianPhone: localGuardianPhone ?? null,
      localGuardianEmail: localGuardianEmail ?? null,
    },
  })

  return NextResponse.json({ id: updated.id })
}
