import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ""
  const adapter = new PrismaNeon({ connectionString })
  const prisma = new PrismaClient({ adapter })

  console.log("Creating legacy master data (2023, 2024, 2025)...")

  const batches = [
    { year: 2023, fees: 885000, reg: 40000 },
    { year: 2024, fees: 0, reg: 0 },
    { year: 2025, fees: 565000, reg: 50000 },
  ]

  for (const b of batches) {
    const batch = await prisma.batch.upsert({
      where: { year: b.year },
      update: {},
      create: { year: b.year, name: `Batch ${b.year}` },
    })

    await prisma.program.upsert({
      where: {
        id: (await prisma.program.findFirst({
          where: { name: "Enterprise Leadership", batchId: batch.id }
        }))?.id ?? "new"
      },
      update: {
        totalFee: b.fees,
        registrationFee: b.reg,
        year1Fee: Math.floor(b.fees / 3),
        year2Fee: Math.floor(b.fees / 3),
        year3Fee: b.fees - (Math.floor(b.fees / 3) * 2),
      },
      create: {
        name: "Enterprise Leadership",
        batchId: batch.id,
        totalFee: b.fees,
        registrationFee: b.reg,
        year1Fee: Math.floor(b.fees / 3),
        year2Fee: Math.floor(b.fees / 3),
        year3Fee: b.fees - (Math.floor(b.fees / 3) * 2),
      }
    })

    await prisma.feeSchedule.upsert({
      where: { batchId: batch.id },
      update: {},
      create: { batchId: batch.id, isLocked: false }
    })
    
    console.log(`✓ Batch ${b.year} and Enterprise Leadership program created`)
  }

  await prisma.$disconnect()
}

main().catch(console.error)
