"use server"

import { prisma } from "@/lib/prisma"
import { auth } from "@/auth"
import { revalidatePath } from "next/cache"

export async function updateReminderSetting(
  id: string,
  data: {
    subject: string
    bodyHtml: string
    isActive: boolean
    daysOut: number
  }
) {
  const session = await auth()
  const dbUser = await prisma.user.findUnique({
    where: { email: session?.user?.email ?? "" },
    select: { role: true },
  })

  if (dbUser?.role !== "ADMIN") {
    throw new Error("Unauthorized")
  }

  await prisma.reminderSetting.update({
    where: { id },
    data: {
      subject: data.subject,
      bodyHtml: data.bodyHtml,
      isActive: data.isActive,
      daysOut: data.daysOut,
    },
  })

  revalidatePath("/reminders")
}
