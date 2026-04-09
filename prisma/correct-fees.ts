import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ""
  const adapter = new PrismaNeon({ connectionString })
  const prisma = new PrismaClient({ adapter })

  console.log("Starting fee correction process...")

  const cohortConfig: Record<number, { total: number, y1: number, y2: number, y3: number, dates: string[] }> = {
    2023: { 
      total: 925000, 
      y1: 395000, y2: 295000, y3: 195000, 
      dates: ["2023-08-01", "2024-06-01", "2026-05-01"] 
    },
    2024: { 
      total: 925000, 
      y1: 395000, y2: 295000, y3: 195000, 
      dates: ["2024-08-01", "2025-06-01", "2026-06-01"] 
    },
    2025: { 
      total: 1200000, 
      y1: 565000, y2: 350000, y3: 235000, 
      dates: ["2026-08-07", "2027-05-15", "2028-05-15"] 
    },
  }

  const students = await prisma.student.findMany({
    where: { batch: { year: { in: [2023, 2024, 2025] } } },
    include: { batch: true, financial: true, payments: true }
  })

  for (const s of students) {
    const config = cohortConfig[s.batch.year]
    if (!config) continue

    console.log(`Processing ${s.name} (${s.rollNo}) [${s.batch.year}]...`)

    // 1. Update Financials
    const totalWaiver = Number(s.financial?.totalWaiver || 0)
    const totalDeduction = Number(s.financial?.totalDeduction || 0)
    const netFee = config.total - totalWaiver - totalDeduction

    await prisma.studentFinancial.update({
      where: { studentId: s.id },
      data: {
        baseFee: config.total,
        netFee: netFee
      }
    })

    // 2. Delete existing installments to re-generate
    // We only delete if they were the "placeholder" ones or if we want to reset them to the new schedule
    // User said: "keep custom if payment spread, for now" for Cohort 1 & 2.
    // However, the previous import created standard ones based on bad totals.
    // I will reset them to the new 3-year schedule unless they have more than 4 payments (indicating custom spread).
    
    const shouldReset = s.batch.year === 2025 || s.payments.length <= 4

    if (shouldReset) {
      // Unlink payments from installments first to avoid FK errors if we delete installments
      await prisma.payment.updateMany({
        where: { studentId: s.id },
        data: { installmentId: null }
      })

      await prisma.installment.deleteMany({
        where: { studentId: s.id }
      })

      // Create new 3 installments
      const installments = [
        { year: 1, label: "Year 1 Fee", amount: config.y1, date: config.dates[0] },
        { year: 2, label: "Year 2 Fee", amount: config.y2, date: config.dates[1] },
        { year: 3, label: "Year 3 Fee", amount: config.y3, date: config.dates[2] },
      ]

      const dbInstallments = []
      for (const inst of installments) {
        const dbInst = await prisma.installment.create({
          data: {
            studentId: s.id,
            year: inst.year,
            label: inst.label,
            amount: inst.amount,
            dueDate: new Date(inst.date),
            status: "UPCOMING"
          }
        })
        dbInstallments.push(dbInst)
      }

      // 3. Re-link payments greedily
      if (s.batch.year === 2025) {
        // Special rule for Cohort 3: All payments are for Year 1
        const y1Inst = dbInstallments[0]
        let paidAmount = 0
        for (const p of s.payments) {
          await prisma.payment.update({
            where: { id: p.id },
            data: { installmentId: y1Inst.id }
          })
          paidAmount += Number(p.amount)
        }
        
        if (paidAmount >= config.y1) {
            await prisma.installment.update({
                where: { id: y1Inst.id },
                data: { status: "PAID", paidAmount: config.y1, paidDate: s.payments[0].date }
            })
        } else if (paidAmount > 0) {
            await prisma.installment.update({
                where: { id: y1Inst.id },
                data: { status: "PARTIAL", paidAmount: paidAmount }
            })
        }
      } else {
        // Cohort 1 & 2: Greedy mapping
        let remainingPayments = [...s.payments].sort((a, b) => a.date.getTime() - b.date.getTime())
        for (const inst of dbInstallments) {
          let instBalance = Number(inst.amount)
          for (let i = 0; i < remainingPayments.length; i++) {
            const p = remainingPayments[i]
            const pAmt = Number(p.amount)
            if (pAmt <= 0) continue

            const applied = Math.min(pAmt, instBalance)
            await prisma.payment.update({
              where: { id: p.id },
              data: { installmentId: inst.id }
            })
            
            p.amount = (pAmt - applied) as any // temporary untyped update for local loop
            instBalance -= applied

            if (instBalance <= 0) {
              await prisma.installment.update({
                where: { id: inst.id },
                data: { status: "PAID", paidAmount: inst.amount, paidDate: p.date }
              })
              break
            }
          }
          
          if (instBalance > 0 && instBalance < Number(inst.amount)) {
            await prisma.installment.update({
              where: { id: inst.id },
              data: { status: "PARTIAL", paidAmount: Number(inst.amount) - instBalance }
            })
          }
          remainingPayments = remainingPayments.filter(p => Number(p.amount) > 0)
        }
      }
    }
  }

  console.log("\nCorrection complete!")
  await prisma.$disconnect()
}

main().catch(console.error)
