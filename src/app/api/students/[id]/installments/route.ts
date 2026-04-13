import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { syncFifoToDb } from "@/lib/fifo"
import { recordAuditLog } from "@/lib/audit"

type InstallmentRow = {
  id?: string
  label: string
  dueDate: string
  amount: number
  year: number
  _delete?: true
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { id: true, role: true },
  })
  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can edit the installment schedule." }, { status: 403 })
  }

  const { id: studentId } = await params
  const body = await req.json()
  const { installments, changeReason } = body as {
    installments: InstallmentRow[]
    changeReason?: string
  }

  if (!Array.isArray(installments)) {
    return NextResponse.json({ error: "installments must be an array" }, { status: 400 })
  }

  // Load student with financial + current installments
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      financial: { select: { isLocked: true, netFee: true } },
      installments: { orderBy: { dueDate: "asc" } },
    },
  })
  if (!student) {
    return NextResponse.json({ error: "Student not found" }, { status: 404 })
  }

  if (student.financial?.isLocked && !changeReason?.trim()) {
    return NextResponse.json(
      { error: "Reason for change is required for locked records." },
      { status: 400 }
    )
  }

  // Guard: cannot delete PAID installments
  const deletedIds = installments
    .filter(r => r._delete && r.id)
    .map(r => r.id!)

  if (deletedIds.length > 0) {
    const paidDeleted = student.installments.filter(
      i => deletedIds.includes(i.id) && i.status === "PAID"
    )
    if (paidDeleted.length > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete installment(s) with recorded payments: ${paidDeleted.map(i => i.label).join(", ")}`,
        },
        { status: 400 }
      )
    }
  }

  // Build audit summary
  const oldMap = new Map(student.installments.map(i => [i.id, i]))
  const auditLines: string[] = []

  for (const row of installments) {
    if (row._delete && row.id) {
      const old = oldMap.get(row.id)
      auditLines.push(`Deleted: "${old?.label ?? row.id}"`)
    } else if (!row.id) {
      auditLines.push(`Added: "${row.label}" ₹${row.amount} due ${row.dueDate}`)
    } else {
      const old = oldMap.get(row.id)
      if (old) {
        const changes: string[] = []
        if (old.label !== row.label) changes.push(`label "${old.label}"→"${row.label}"`)
        if (Number(old.amount) !== row.amount) changes.push(`amount ₹${Number(old.amount)}→₹${row.amount}`)
        if (old.dueDate.toISOString().slice(0, 10) !== row.dueDate.slice(0, 10))
          changes.push(`due ${old.dueDate.toISOString().slice(0, 10)}→${row.dueDate.slice(0, 10)}`)
        if (changes.length > 0) auditLines.push(`"${row.label}": ${changes.join(", ")}`)
      }
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      // Delete
      if (deletedIds.length > 0) {
        await tx.installment.deleteMany({ where: { id: { in: deletedIds } } })
      }

      // Update existing
      for (const row of installments) {
        if (row._delete || !row.id) continue
        await tx.installment.update({
          where: { id: row.id },
          data: {
            label:   row.label,
            dueDate: new Date(row.dueDate),
            amount:  row.amount,
            year:    row.year,
          },
        })
      }

      // Create new
      const newRows = installments.filter(r => !r._delete && !r.id)
      if (newRows.length > 0) {
        await tx.installment.createMany({
          data: newRows.map(r => ({
            studentId,
            label:   r.label,
            dueDate: new Date(r.dueDate),
            amount:  r.amount,
            year:    r.year,
            status:  new Date(r.dueDate) <= new Date() ? "DUE" : "UPCOMING",
          })),
        })
      }

      // Re-run FIFO so statuses reflect the updated schedule
      await syncFifoToDb(tx, studentId)

      // Audit log
      if (auditLines.length > 0) {
        await recordAuditLog({
          studentId,
          userId: dbUser.id,
          field: "installmentSchedule",
          oldValue: student.installments
            .map(i => `${i.label}: ₹${Number(i.amount)} due ${i.dueDate.toISOString().slice(0, 10)}`)
            .join(" | "),
          newValue: auditLines.join(" | "),
          reason: changeReason,
        })
      }
    })

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Installment schedule update failed:", err)
    return NextResponse.json({ error: "Failed to update installment schedule" }, { status: 500 })
  }
}
