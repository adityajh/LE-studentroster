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
    include: {
      financial: true,
      offers: true,
      scholarships: true,
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
    },
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
    registrationFee, // optional registration fee override → updates depositAmount + year=0 installment
    // Financial plan updates (Admin only)
    offers,       // string[] — offerId list
    scholarships, // { scholarshipId: string; amount: number }[]
    deductions,   // { description: string; amount: number }[]
    changeReason,
  } = body

  // ── Role enforcement ──────────────────────────────────────────────────────
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { id: true, role: true },
  })
  const isAdmin = dbUser?.role === "ADMIN"

  const hasFinancialUpdate =
    baseFee !== undefined ||
    registrationFee !== undefined ||
    customTerms !== undefined ||
    offers !== undefined ||
    scholarships !== undefined ||
    deductions !== undefined

  const isLocked = student.financial?.isLocked ?? false

  if (hasFinancialUpdate && !isAdmin) {
    return NextResponse.json({ error: "Financial data is locked. Only admins can modify it." }, { status: 403 })
  }

  if (isLocked && hasFinancialUpdate && !changeReason) {
    return NextResponse.json({ error: "Reason for change is required for locked records." }, { status: 400 })
  }

  // ── Identity ──────────────────────────────────────────────────────────────
  const newFirstName = firstName ?? student.firstName
  const newLastName = lastName ?? student.lastName
  const name = (firstName || lastName) ? `${newFirstName} ${newLastName}`.trim() : student.name

  // ── Audit helpers ─────────────────────────────────────────────────────────
  const auditLogs: { field: string; oldValue: string; newValue: string; reason?: string }[] = []
  const userId = dbUser?.id || session.user.id!

  const trackChange = (field: string, oldVal: any, newVal: any) => {
    if (newVal !== undefined && String(newVal) !== String(oldVal ?? "")) {
      auditLogs.push({ field, oldValue: String(oldVal ?? ""), newValue: String(newVal ?? ""), reason: changeReason })
    }
  }

  trackChange("firstName", student.firstName, firstName)
  trackChange("lastName", student.lastName, lastName)
  trackChange("email", student.email, email)
  trackChange("contact", student.contact, contact)
  trackChange("baseFee", student.financial?.baseFee, baseFee)
  trackChange("registrationFee", student.financial?.depositAmount, registrationFee)
  trackChange("customTerms", student.financial?.customTerms, customTerms)

  // ── Financial recalculation ───────────────────────────────────────────────
  let newNetFee: number | undefined
  let newTotalWaiver: number | undefined
  let newTotalDeduction: number | undefined

  if (hasFinancialUpdate && isAdmin) {
    const bFee = baseFee !== undefined
      ? parseFloat(baseFee)
      : Number(student.financial?.baseFee ?? 0)

    // Compute waiver from new offer list (or keep existing if not updated)
    let offerWaiver = 0
    if (offers !== undefined) {
      const selectedOffers = await prisma.offer.findMany({ where: { id: { in: offers as string[] } } })
      offerWaiver = selectedOffers.reduce((s, o) => s + o.waiverAmount.toNumber(), 0)

      // Audit offer changes
      const oldOfferIds = student.offers.map(o => o.offerId).sort()
      const newOfferIds = [...(offers as string[])].sort()
      if (JSON.stringify(oldOfferIds) !== JSON.stringify(newOfferIds)) {
        trackChange("offers", oldOfferIds.join(", "), newOfferIds.join(", "))
      }
    } else {
      offerWaiver = student.offers.reduce((s, o) => s + o.waiverAmount.toNumber(), 0)
    }

    let scholarshipWaiver = 0
    if (scholarships !== undefined) {
      scholarshipWaiver = (scholarships as { scholarshipId: string; amount: number }[])
        .reduce((s, sc) => s + sc.amount, 0)
      const oldTotal = student.scholarships.reduce((s, sc) => s + sc.amount.toNumber(), 0)
      if (scholarshipWaiver !== oldTotal) {
        trackChange("scholarships", `Total ₹${oldTotal}`, `Total ₹${scholarshipWaiver}`)
      }
    } else {
      scholarshipWaiver = student.scholarships.reduce((s, sc) => s + sc.amount.toNumber(), 0)
    }

    let deductionTotal = 0
    if (deductions !== undefined) {
      deductionTotal = (deductions as { description: string; amount: number }[])
        .reduce((s, d) => s + d.amount, 0)
      const oldTotal = student.deductions.reduce((s, d) => s + d.amount.toNumber(), 0)
      if (deductionTotal !== oldTotal) {
        trackChange("deductions", `Total ₹${oldTotal}`, `Total ₹${deductionTotal}`)
      }
    } else {
      deductionTotal = student.deductions.reduce((s, d) => s + d.amount.toNumber(), 0)
    }

    newTotalWaiver = offerWaiver + scholarshipWaiver
    newTotalDeduction = deductionTotal
    newNetFee = bFee - newTotalWaiver - newTotalDeduction
  }

  // ── Transaction ───────────────────────────────────────────────────────────
  try {
    await prisma.$transaction(async (tx) => {
      // Update Student core fields
      await tx.student.update({
        where: { id },
        data: {
          firstName, lastName, name, email, contact, bloodGroup, city, address, localAddress,
          parent1Name, parent1Email, parent1Phone, parent2Name, parent2Email, parent2Phone,
          localGuardianName, localGuardianPhone, localGuardianEmail,
        },
      })

      // Financial updates (admin only)
      if (hasFinancialUpdate && isAdmin && newNetFee !== undefined) {
        const bFee = baseFee !== undefined
          ? parseFloat(baseFee)
          : Number(student.financial?.baseFee ?? 0)

        // Sync Offers
        if (offers !== undefined) {
          await tx.studentOffer.deleteMany({ where: { studentId: id } })
          if ((offers as string[]).length > 0) {
            const selectedOffers = await tx.offer.findMany({ where: { id: { in: offers as string[] } } })
            await tx.studentOffer.createMany({
              data: selectedOffers.map(o => ({
                studentId: id,
                offerId: o.id,
                waiverAmount: o.waiverAmount,
              })),
            })
          }
        }

        // Sync Scholarships
        if (scholarships !== undefined) {
          await tx.studentScholarship.deleteMany({ where: { studentId: id } })
          if ((scholarships as any[]).length > 0) {
            await tx.studentScholarship.createMany({
              data: (scholarships as { scholarshipId: string; amount: number }[]).map(sc => ({
                studentId: id,
                scholarshipId: sc.scholarshipId,
                amount: sc.amount,
              })),
            })
          }
        }

        // Sync Deductions
        if (deductions !== undefined) {
          await tx.studentDeduction.deleteMany({ where: { studentId: id } })
          if ((deductions as any[]).length > 0) {
            await tx.studentDeduction.createMany({
              data: (deductions as { description: string; amount: number }[]).map(d => ({
                studentId: id,
                description: d.description,
                amount: d.amount,
              })),
            })
          }
        }

        // Update StudentFinancial
        await tx.studentFinancial.update({
          where: { studentId: id },
          data: {
            baseFee: bFee,
            totalWaiver: newTotalWaiver,
            totalDeduction: newTotalDeduction,
            netFee: newNetFee,
            customTerms: customTerms ?? undefined,
            depositAmount: registrationFee !== undefined ? Number(registrationFee) : undefined,
          },
        })

        // Update year=0 installment if registration fee changed and not yet paid
        if (registrationFee !== undefined) {
          const regInst = student.installments.find(i => i.year === 0 && i.status !== "PAID")
          if (regInst) {
            await tx.installment.update({
              where: { id: regInst.id },
              data: { amount: Number(registrationFee) },
            })
          }
        }

        // ── Installment redistribution ──────────────────────────────────────
        // Only for ANNUAL and ONE_TIME plans (not CUSTOM)
        const installmentType = student.financial?.installmentType
        if (installmentType !== "CUSTOM") {
          // Find non-registration, non-fully-paid installments
          const remainingInstallments = student.installments.filter(
            inst => inst.year > 0 && inst.status !== "PAID"
          )

          if (remainingInstallments.length > 0) {
            // Compute total already settled (from paid installments only)
            const paidInstallments = student.installments.filter(i => i.status === "PAID")
            const totalSettled = paidInstallments.reduce((s, i) => s + Number(i.amount), 0)
            const regFeeInstallment = student.installments.find(i => i.year === 0)
            const regFeeAmount = regFeeInstallment ? Number(regFeeInstallment.amount) : 0

            // Net fee minus registration fee = distributable fee
            const distributableFee = newNetFee - regFeeAmount
            const remainingFee = Math.max(0, distributableFee - totalSettled)
            const perInstallment = Math.round(remainingFee / remainingInstallments.length)

            for (let i = 0; i < remainingInstallments.length; i++) {
              const inst = remainingInstallments[i]
              // Last installment gets any rounding remainder
              const amt = i === remainingInstallments.length - 1
                ? remainingFee - perInstallment * (remainingInstallments.length - 1)
                : perInstallment
              await tx.installment.update({
                where: { id: inst.id },
                data: { amount: Math.max(0, amt) },
              })
            }
          }
        }
      } else if (baseFee !== undefined && newNetFee === undefined) {
        // Simple base fee change only (no offer/scholarship changes)
        const bFee = parseFloat(baseFee)
        await tx.studentFinancial.update({
          where: { studentId: id },
          data: {
            baseFee: bFee,
            customTerms: customTerms ?? undefined,
            netFee: bFee - Number(student.financial?.totalWaiver || 0) - Number(student.financial?.totalDeduction || 0),
          },
        })
      }

      // Write Audit Logs
      for (const log of auditLogs) {
        await recordAuditLog({ studentId: id, userId, ...log })
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

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Only admins can delete records." }, { status: 403 })
  }

  const { id } = await params

  try {
    await prisma.student.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("Delete failed:", err)
    return NextResponse.json({ error: "Failed to delete student record" }, { status: 500 })
  }
}
