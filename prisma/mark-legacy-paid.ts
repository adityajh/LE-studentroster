import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { prisma } from "../src/lib/prisma"

async function main() {
  console.log("Starting legacy payment update for Cohort 2023 & specified students...")

  // Find 2023 batch
  const batch2023 = await prisma.batch.findFirst({
    where: { year: 2023 },
    include: {
      students: {
        include: {
          installments: true,
          financial: true,
        }
      }
    }
  })

  if (!batch2023) {
    console.error("Batch 2023 not found")
    return
  }

  console.log(`Found ${batch2023.students.length} students in Cohort 2023. Processing unpaid installments...`)

  let updatedInstallmentsCount = 0
  let createdPaymentsCount = 0

  for (const student of batch2023.students) {
    const unpaidInstallments = student.installments.filter((i) => i.status !== "PAID")

    for (const inst of unpaidInstallments) {
      const unpaidAmount = inst.amount.toNumber() - (inst.paidAmount?.toNumber() ?? 0)
      if (unpaidAmount <= 0) continue

      await prisma.$transaction([
        // Update installment to PAID
        prisma.installment.update({
          where: { id: inst.id },
          data: {
            status: "PAID",
            paidAmount: inst.amount,
            paidDate: inst.dueDate,
            paymentMethod: "EXTERNAL_ACCOUNT",
            notes: (inst.notes ? inst.notes + " | " : "") + "Collected in external/legacy account",
          },
        }),
        // Create matching payment record for source-of-truth payment totals
        prisma.payment.create({
          data: {
            studentId: student.id,
            installmentId: inst.id,
            amount: unpaidAmount,
            date: inst.dueDate,
            payerName: student.name,
            paymentMode: "OTHER",
            referenceNo: "LEGACY-EXT-ACC",
            notes: "Collected in external account (Cohort 2023 legacy fix)",
          },
        }),
      ])

      updatedInstallmentsCount++
      createdPaymentsCount++
    }
  }

  console.log(`✓ Updated ${updatedInstallmentsCount} installments to PAID for Cohort 2023.`)
  console.log(`✓ Created ${createdPaymentsCount} payment records.`)

  await prisma.$disconnect()
}

main().catch(console.error)
