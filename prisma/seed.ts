import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config() 

import { PrismaClient, Prisma } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

const adapter = new PrismaNeon({
  connectionString: process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || "",
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("Seeding 2026 batch data...")

  // ─── Batch ────────────────────────────────────────────────────────────────
  const batch2026 = await prisma.batch.upsert({
    where: { year: 2026 },
    update: {},
    create: {
      year: 2026,
      name: "Batch 2026",
    },
  })
  console.log("✓ Batch 2026 created")

  // ─── Programs ─────────────────────────────────────────────────────────────
  const programs = [
    {
      name: "UG-MED (Working BBA)",
      totalFee: 1350000,
      registrationFee: 50000,
      year1Fee: 565000,
      year2Fee: 400000,
      year3Fee: 350000,
      targetStudents: 35,
      yearWiseDetails: {
        year1: {
          label: "Growth Year",
          dueDate: "2026-08-07",
          details: "Common across all programs",
        },
        year2: {
          label: "Projects Year",
          dueDate: "2027-05-15",
          details:
            "2 Apprenticeships, 4 Advanced Challenges, 1 Consulting Project, 1 Kickstart Project, 2 Skill Tracks, 1 Camp, 1 Career Workshop, 4 Career Coaching",
        },
        year3: {
          label: "Work Year",
          dueDate: "2028-05-15",
          details:
            "Multi-Domain Project, 2 Final Challenges, 2 Skill Tracks, 4 Career Coaching, 9 month apprenticeship",
        },
      },
    },
    {
      name: "Working BBA - Family Business",
      totalFee: 1750000,
      registrationFee: 50000,
      year1Fee: 565000,
      year2Fee: 525000,
      year3Fee: 610000,
      targetStudents: 5,
      yearWiseDetails: {
        year1: {
          label: "Growth Year",
          details: "Common across all programs",
        },
        year2: {
          label: "Projects Year",
          details:
            "1 Apprenticeship, 4 Advanced Challenges, 1 Consulting Project, 1 Kickstart Project, 2 Skill Tracks, 1 Camp, 1 Career Workshop, 4 Career Coaching, 1 Family Project, Family Business Workshop, 4 Business Coaching",
        },
        year3: {
          label: "Work Year",
          details:
            "Multi-Domain Project, 2 Final Challenges, 2 Skill Tracks, 4 Career Coaching, 9 month Family Business Project, Family Business Workshop, 8 Business Coaching",
        },
      },
    },
    {
      name: "Working BBA - Venture Builder",
      totalFee: 1950000,
      registrationFee: 50000,
      year1Fee: 565000,
      year2Fee: 625000,
      year3Fee: 710000,
      targetStudents: 10,
      yearWiseDetails: {
        year1: {
          label: "Growth Year",
          details: "Common across all programs",
        },
        year2: {
          label: "Projects Year",
          details:
            "2 Apprenticeships, 4 Advanced Challenges, 1 Consulting Project, 1 Kickstart Project, 2 Skill Tracks, 1 Camp, 1 Career Workshop, 4 Career Coaching, 1 Venture Project, Founder Led Venture Workshop, 4 Business Coaching",
        },
        year3: {
          label: "Work Year",
          details:
            "Multi-Domain Project, 2 Final Challenges, 2 Skill Tracks, 4 Career Coaching, 9 month Venture Building, Founder Led Venture Workshop, 8 Business Coaching",
        },
      },
    },
  ]

  for (const program of programs) {
    await prisma.program.upsert({
      where: {
        // Use name + batchId as unique identifier for upsert
        id: (
          await prisma.program.findFirst({
            where: { name: program.name, batchId: batch2026.id },
          })
        )?.id ?? "new",
      },
      update: program,
      create: { ...program, batchId: batch2026.id },
    })
  }
  console.log("✓ 3 Programs created")

  // ─── Fee Schedule ─────────────────────────────────────────────────────────
  const feeSchedule = await prisma.feeSchedule.upsert({
    where: { batchId: batch2026.id },
    update: {},
    create: {
      batchId: batch2026.id,
      isLocked: false,
    },
  })
  console.log("✓ Fee Schedule 2026 created (unlocked)")

  // ─── Offers ───────────────────────────────────────────────────────────────
  type OfferInput = Omit<Prisma.OfferCreateManyInput, "feeScheduleId">
  const offers: OfferInput[] = [
    {
      name: "First 10 Registrations",
      type: "FIRST_N_REGISTRATIONS" as const,
      waiverAmount: 20000,
      conditions: { maxStudents: 10 },
    },
    {
      // 1st year payment before 30 Mar 2026 — ₹1,00,000 spread across 3 years
      name: "Early Payment — Before 30 Mar 2026",
      type: "EARLY_BIRD" as const,
      waiverAmount: 100000,
      deadline: new Date("2026-03-30T23:59:59Z"),
      conditions: { spreadAcrossYears: true },
    },
    {
      // 1st year payment before 31 May 2026 — ₹50,000 spread across 3 years
      name: "Early Payment — Before 31 May 2026",
      type: "EARLY_BIRD" as const,
      waiverAmount: 50000,
      deadline: new Date("2026-05-31T23:59:59Z"),
      conditions: { spreadAcrossYears: true },
    },
    {
      name: "Pay Within 7 Days of Acceptance Letter",
      type: "ACCEPTANCE_7DAY" as const,
      waiverAmount: 25000,
      conditions: { daysFromAcceptance: 7 },
    },
    {
      // 10% of ₹13,50,000 = ₹1,35,000
      name: "Full 3-Year Payment",
      type: "FULL_PAYMENT" as const,
      waiverAmount: 135000,
      conditions: { percentageOfTotal: 10, note: "10% waiver on total fees" },
    },
  ]

  // Delete existing offers for this fee schedule and recreate
  await prisma.offer.deleteMany({ where: { feeScheduleId: feeSchedule.id } })
  await prisma.offer.createMany({
    data: offers.map((o) => ({ ...o, feeScheduleId: feeSchedule.id })),
  })
  console.log("✓ 5 Offers created")

  // ─── Scholarships ─────────────────────────────────────────────────────────
  const scholarships = [
    // Category A — max 1 per student
    { category: "A" as const, name: "Young Innovator", minAmount: 25000, maxAmount: 100000 },
    { category: "A" as const, name: "Leadership & Community Impact", minAmount: 15000, maxAmount: 50000 },
    { category: "A" as const, name: "Athlete Excellence", minAmount: 15000, maxAmount: 50000,
      // conditions JSON stores tier info for reference
    },
    { category: "A" as const, name: "Entrepreneurial Spirit", minAmount: 0, maxAmount: 100000 },
    { category: "A" as const, name: "Creative Talent", minAmount: 15000, maxAmount: 50000 },
    // Category B — max 1 per student
    // Note: Referral is applied to the REFERRING student's record, not the new student
    { category: "B" as const, name: "Referral", minAmount: 25000, maxAmount: 25000 },
    { category: "B" as const, name: "Defence", minAmount: 25000, maxAmount: 25000 },
    { category: "B" as const, name: "Single Parent", minAmount: 25000, maxAmount: 25000 },
    { category: "B" as const, name: "Learning Differences", minAmount: 25000, maxAmount: 25000 },
  ]

  await prisma.scholarship.deleteMany({ where: { feeScheduleId: feeSchedule.id } })
  await prisma.scholarship.createMany({
    data: scholarships.map((s) => ({ ...s, feeScheduleId: feeSchedule.id })),
  })
  console.log("✓ 9 Scholarships created (5 Cat A, 4 Cat B)")

  console.log("\n✅ Seed complete!")
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
