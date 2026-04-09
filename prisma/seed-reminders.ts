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
      bodyHtml: "<p>Dear {{studentName}},</p><p>This is a reminder that your upcoming fee payment ({{installmentLabel}}) of <strong>{{amount}}</strong> is due on <strong>{{dueDate}}</strong>.</p>"
    },
    {
      type: "ONE_WEEK",
      daysOut: 7,
      subject: "Fee Reminder - {{installmentLabel}} due in 1 week",
      bodyHtml: "<p>Dear {{studentName}},</p><p>This is a reminder that your upcoming fee payment ({{installmentLabel}}) of <strong>{{amount}}</strong> is due on <strong>{{dueDate}}</strong>.</p>"
    },
    {
      type: "DUE_DATE",
      daysOut: 0,
      subject: "Payment Due Today - {{installmentLabel}}",
      bodyHtml: "<p>Dear {{studentName}},</p><p>This is a reminder that your fee payment ({{installmentLabel}}) of <strong>{{amount}}</strong> is due today.</p>"
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
        bodyHtml: setting.bodyHtml,
        isActive: true
      }
    })
  }

  console.log("Seeding complete.")
  await prisma.$disconnect()
}

main().catch(console.error)
