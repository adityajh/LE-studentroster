import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { recordAuditLog } from "@/lib/audit"
import { splitWaivers } from "@/lib/fee-calc"

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
      offers: { include: { offer: { select: { id: true, conditions: true, waiverAmount: true } } } },
      scholarships: { include: { scholarship: true } },
      deductions: true,
      installments: { orderBy: { dueDate: "asc" } },
      program: true,
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
    linkedinHandle, instagramHandle, universityChoice, universityStatus,
    baseFee, customTerms,
    registrationFee, // optional override → updates registrationFeeOverride + year=0 installment
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
  trackChange("registrationFee", student.financial?.registrationFeeOverride, registrationFee)
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
          linkedinHandle: linkedinHandle ?? undefined,
          instagramHandle: instagramHandle ?? undefined,
          universityChoice: universityChoice ?? undefined,
          universityStatus: universityStatus ?? undefined,
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
            registrationFeeOverride: registrationFee !== undefined ? Number(registrationFee) : undefined,
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
          const remainingInstallments = student.installments.filter(
            inst => inst.year > 0 && inst.status !== "PAID"
          )

          if (remainingInstallments.length > 0) {
            if (installmentType === "ANNUAL") {
              // Fetch the current offer records (post-update) for their conditions
              const currentOfferIds = offers !== undefined
                ? (offers as string[])
                : student.offers.map(o => o.offerId)
              const currentOffers = currentOfferIds.length > 0
                ? await tx.offer.findMany({ where: { id: { in: currentOfferIds } } })
                : []

              let schsForCalc: { amount: number; spreadAcrossYears: boolean }[]
              if (scholarships !== undefined) {
                const newScholarships = scholarships as { scholarshipId: string; amount: number }[]
                const schIds = newScholarships.map(s => s.scholarshipId)
                const schRecords = schIds.length
                  ? await tx.scholarship.findMany({ where: { id: { in: schIds } } })
                  : []
                schsForCalc = newScholarships.map(s => ({
                  amount: s.amount,
                  spreadAcrossYears: schRecords.find(r => r.id === s.scholarshipId)?.spreadAcrossYears ?? true,
                }))
              } else {
                schsForCalc = student.scholarships.map(sc => ({
                  amount: Number(sc.amount),
                  spreadAcrossYears: (sc.scholarship as { spreadAcrossYears?: boolean }).spreadAcrossYears ?? true,
                }))
              }
              const { spreadY1, spreadY2, spreadY3, onetimeTotal } = splitWaivers(
                currentOffers.map(o => ({ conditions: o.conditions, waiverAmount: Number(o.waiverAmount) })),
                schsForCalc
              )

              // Use program year fees as the base for each year
              const programYearFees: Record<number, number> = {
                1: Number(student.program!.year1Fee),
                2: Number(student.program!.year2Fee),
                3: Number(student.program!.year3Fee),
              }
              const spreadByYear: Record<number, number> = { 1: spreadY1, 2: spreadY2, 3: spreadY3 }

              for (const inst of remainingInstallments) {
                const yearFee = programYearFees[inst.year] ?? 0
                const yearSpread = spreadByYear[inst.year] ?? 0
                const amt = Math.max(0, Math.round(yearFee - yearSpread - (inst.year === 1 ? onetimeTotal + (newTotalDeduction ?? 0) : 0)))
                await tx.installment.update({ where: { id: inst.id }, data: { amount: amt } })
              }
            } else {
              // ONE_TIME: single installment = full net fee minus registration
              const regFeeInstallment = student.installments.find(i => i.year === 0)
              const regFeeAmount = regFeeInstallment ? Number(regFeeInstallment.amount) : 0
              const amt = Math.max(0, newNetFee - regFeeAmount)
              for (const inst of remainingInstallments) {
                await tx.installment.update({ where: { id: inst.id }, data: { amount: amt } })
              }
            }
          }
        }
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
