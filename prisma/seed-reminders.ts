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
      subject: "Fee Reminder — {{installmentLabel}} due in 1 month",
      bodyText: `Dear {{studentName}},

This is a friendly reminder that your {{installmentLabel}} payment of {{amount}} is due on {{dueDate}} — one month from now.

Please ensure your payment reaches us on or before the due date to avoid any disruption to your programme. If you have already arranged for this payment, you may disregard this message.

For any questions or assistance, please don't hesitate to reach out to us.`,
    },
    {
      type: "ONE_WEEK",
      daysOut: 7,
      subject: "Fee Reminder — {{installmentLabel}} due in 1 week",
      bodyText: `Dear {{studentName}},

Your {{installmentLabel}} payment of {{amount}} is due on {{dueDate}} — just one week away.

Please make your payment at the earliest to ensure it is processed in time. If you have already made the payment, you may disregard this reminder.

If you are facing any difficulty, please contact us right away so we can assist you.`,
    },
    {
      type: "DUE_DATE",
      daysOut: 0,
      subject: "Payment Due Today — {{installmentLabel}}",
      bodyText: `Dear {{studentName}},

Your {{installmentLabel}} payment of {{amount}} is due today, {{dueDate}}.

Please make your payment today to avoid any delay or disruption to your programme. If you have already transferred the amount, it may take a short while to reflect in our records — you may disregard this reminder in that case.

For urgent assistance, please contact us immediately.`,
    },
  ]

  for (const setting of settings) {
    await prisma.reminderSetting.upsert({
      where: { type: setting.type },
      update: { subject: setting.subject, bodyText: setting.bodyText },
      create: {
        type: setting.type,
        daysOut: setting.daysOut,
        subject: setting.subject,
        bodyText: setting.bodyText,
        isActive: true,
      },
    })
  }

  console.log("Seeding complete.")
  await prisma.$disconnect()
}

main().catch(console.error)
