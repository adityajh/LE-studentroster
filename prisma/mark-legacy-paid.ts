import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { prisma } from "../src/lib/prisma"

async function main() {
  const args = process.argv.slice(2)

  let studentsToProcess: any[] = []

  if (args.length > 0) {
    console.log(`Processing specified roll numbers / student IDs: ${args.join(", ")}...`)
    studentsToProcess = await prisma.student.findMany({
      where: {
        OR: [
          { rollNo: { in: args } },
          { id: { in: args } }
        ]
      },
      include: {
        installments: true,
        financial: true
      }
    })
  } else {
    console.log("No roll numbers passed. Defaulting to Cohort 2023 students...")
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
    studentsToProcess = batch2023?.students ?? []
  }

  if (studentsToProcess.length === 0) {
    console.log("No matching students found to process.")
    return
  }

  const now = new Date()
  let updatedInstallmentsCount = 0
  let createdPaymentsCount = 0

  for (const student of studentsToProcess) {
    // Only process past or currently due installments (dueDate <= now and status !== PAID)
    const unpaidPastInstallments = student.installments.filter(
      (i: any) => i.status !== "PAID" && new Date(i.dueDate).getTime() <= now.getTime()
    )

    for (const inst of unpaidPastInstallments) {
      const unpaidAmount = inst.amount.toNumber() - (inst.paidAmount?.toNumber() ?? 0)
      if (unpaidAmount <= 0) continue

      await prisma.$transaction([
        prisma.installment.update({
          where: { id: inst.id },
          data: {
            status: "PAID",
            paidAmount: inst.amount,
            paidDate: inst.dueDate,
            paymentMethod: "EXTERNAL_ACCOUNT",
            notes: (inst.notes ? inst.notes + " | " : "") + "Collected in external account",
          },
        }),
        prisma.payment.create({
          data: {
            studentId: student.id,
            installmentId: inst.id,
            amount: unpaidAmount,
            date: inst.dueDate,
            payerName: student.name,
            paymentMode: "OTHER",
            referenceNo: "LEGACY-EXT-ACC",
            notes: "Collected in external account",
          },
        }),
      ])

      updatedInstallmentsCount++
      createdPaymentsCount++
    }
  }

  console.log(`✓ Updated ${updatedInstallmentsCount} past due installments to PAID for ${studentsToProcess.length} student(s).`)
  console.log(`✓ Created ${createdPaymentsCount} payment records.`)

  await prisma.$disconnect()
}

main().catch(console.error)
