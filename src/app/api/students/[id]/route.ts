import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recordAuditLog } from "@/lib/audit"

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const { id } = await params
  const student = await prisma.student.findUnique({ 
    where: { id },
    include: { financial: true }
  })
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  const body = await req.json()
  const { 
    firstName, lastName, email, contact, bloodGroup, city, address, localAddress,
    parent1Name, parent1Email, parent1Phone, parent2Name, parent2Email, parent2Phone,
    localGuardianName, localGuardianPhone, localGuardianEmail,
    baseFee, customTerms,
    changeReason 
  } = body

  // Check locking
  const isLocked = student.financial?.isLocked ?? false
  const financialFields = ["baseFee", "customTerms"]
  const hasFinancialUpdate = baseFee !== undefined || customTerms !== undefined
  
  // Get user role for enforcement
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"

  if (isLocked && hasFinancialUpdate && !isAdmin) {
    return NextResponse.json({ error: "Financial data is locked. Only admins can modify it." }, { status: 403 })
  }

  if (isLocked && hasFinancialUpdate && !changeReason) {
    return NextResponse.json({ error: "Reason for change is required for locked records." }, { status: 400 })
  }

  // Identity logic
  const newFirstName = firstName ?? student.firstName
  const newLastName = lastName ?? student.lastName
  const name = (firstName || lastName) ? `${newFirstName} ${newLastName}`.trim() : student.name

  // Prepare audit tracking
  const auditLogs: { field: string; oldValue: string; newValue: string; reason?: string }[] = []
  const userId = dbUser?.id || session.user.id!

  const trackChange = (field: string, oldVal: any, newVal: any) => {
    if (newVal !== undefined && newVal !== oldVal) {
      auditLogs.push({ field, oldValue: String(oldVal ?? ""), newValue: String(newVal ?? ""), reason: changeReason })
    }
  }

  trackChange("firstName", student.firstName, firstName)
  trackChange("lastName", student.lastName, lastName)
  trackChange("email", student.email, email)
  trackChange("contact", student.contact, contact)
  trackChange("baseFee", student.financial?.baseFee, baseFee)
  trackChange("customTerms", student.financial?.customTerms, customTerms)

  // Transaction for consistency
  try {
    await prisma.$transaction(async (tx) => {
      // Update Student
      await tx.student.update({
        where: { id },
        data: {
          firstName, lastName, name, email, contact, bloodGroup, city, address, localAddress,
          parent1Name, parent1Email, parent1Phone, parent2Name, parent2Email, parent2Phone,
          localGuardianName, localGuardianPhone, localGuardianEmail,
        }
      })

      // Update Financial
      if (hasFinancialUpdate) {
        const bFee = baseFee !== undefined ? parseFloat(baseFee) : Number(student.financial?.baseFee ?? 0)
        await tx.studentFinancial.update({
          where: { studentId: id },
          data: {
            baseFee: bFee,
            customTerms: customTerms ?? undefined,
            netFee: bFee - Number(student.financial?.totalWaiver || 0) - Number(student.financial?.totalDeduction || 0)
          }
        })
      }

      // Record Audit Logs
      for (const log of auditLogs) {
        await recordAuditLog({
          studentId: id,
          userId,
          ...log
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Update failed:", err)
    return NextResponse.json({ error: "Failed to update record" }, { status: 500 })
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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
    return NextResponse.json({ error: "Only admins can delete records." }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.student.delete({
      where: { id }
    })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete failed:", err)
    return NextResponse.json({ error: "Failed to delete student record" }, { status: 500 })
  }
}
