import dotenv from "dotenv"
dotenv.config({ path: ".env.local" })
dotenv.config()

import { PrismaClient } from "@prisma/client"
import { PrismaNeon } from "@prisma/adapter-neon"

async function main() {
  const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL || ""
  const adapter = new PrismaNeon({ connectionString })
  const prisma = new PrismaClient({ adapter })

  console.log("Seeding reminder settings...")

  const settings = [
    {
      type: "ONE_MONTH",
      daysOut: 30,
      subject: "Fee Reminder - {{installmentLabel}} due in 1 month",
      bodyText: "Dear {{studentName}},\n\nThis is a reminder that your upcoming fee payment ({{installmentLabel}}) of {{amount}} is due on {{dueDate}}.\n\nThank you,\nLet's Enterprise"
    },
    {
      type: "ONE_WEEK",
      daysOut: 7,
      subject: "Fee Reminder - {{installmentLabel}} due in 1 week",
      bodyText: "Dear {{studentName}},\n\nThis is a reminder that your upcoming fee payment ({{installmentLabel}}) of {{amount}} is due on {{dueDate}}.\n\nThank you,\nLet's Enterprise"
    },
    {
      type: "DUE_DATE",
      daysOut: 0,
      subject: "Payment Due Today - {{installmentLabel}}",
      bodyText: "Dear {{studentName}},\n\nThis is a friendly reminder that your fee payment ({{installmentLabel}}) of {{amount}} is due today.\n\nThank you,\nLet's Enterprise"
    }
  ]

  for (const setting of settings) {
    await prisma.reminderSetting.upsert({
      where: { type: setting.type },
      update: {},
      create: {
        type: setting.type,
        daysOut: setting.daysOut,
        subject: setting.subject,
        bodyText: setting.bodyText,
        isActive: true
      }
    })
  }

  console.log("Seeding complete.")
  await prisma.$disconnect()
}

main().catch(console.error)
