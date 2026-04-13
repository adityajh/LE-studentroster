"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getReminderSettings() {
  return prisma.reminderSetting.findMany({ orderBy: { daysOut: "desc" } })
}

export async function updateReminderSetting(
  type: string,
  data: { bodyText?: string; isActive?: boolean }
) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true },
  })
  if (dbUser?.role !== "ADMIN") throw new Error("Forbidden")

  const daysOut = type === "ONE_MONTH" ? 30 : type === "ONE_WEEK" ? 7 : 0

  await prisma.reminderSetting.upsert({
    where: { type },
    update: data,
    create: {
      type,
      daysOut,
      subject: "",
      bodyText: data.bodyText ?? "",
      isActive: data.isActive ?? true,
    },
  })

  revalidatePath("/settings")
}
