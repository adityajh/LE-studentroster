"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

export async function getSetting(key: string, defaultValue = "") {
  const setting = await prisma.systemSetting.findUnique({
    where: { key }
  })
  return setting?.value ?? defaultValue
}

export async function getSettings(keys: string[]) {
  const settings = await prisma.systemSetting.findMany({
    where: { key: { in: keys } }
  })
  const map: Record<string, string> = {}
  settings.forEach((s: { key: string; value: string }) => map[s.key] = s.value)
  return map
}

export async function updateSetting(key: string, value: string) {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")

  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, id: true }
  })

  // Only admins can change system settings
  if (dbUser?.role !== "ADMIN") throw new Error("Forbidden")

  await prisma.systemSetting.upsert({
    where: { key },
    update: { value, updatedBy: dbUser.id },
    create: { key, value, updatedBy: dbUser.id }
  })

  revalidatePath("/settings")
  return { success: true }
}
