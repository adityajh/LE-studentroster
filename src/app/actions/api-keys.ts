"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { createHash, randomBytes } from "crypto"
import { revalidatePath } from "next/cache"

async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.email) throw new Error("Unauthorized")
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email },
    select: { role: true, id: true },
  })
  if (dbUser?.role !== "ADMIN") throw new Error("Forbidden")
  return dbUser
}

export async function getApiKeys() {
  await requireAdmin()
  return prisma.apiKey.findMany({
    include: { createdBy: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  })
}

export async function createApiKey(name: string) {
  const me = await requireAdmin()

  // Generate a cryptographically secure random key
  const plainKey = `le_${randomBytes(24).toString("hex")}`
  const keyHash = createHash("sha256").update(plainKey).digest("hex")

  await prisma.apiKey.create({
    data: { name, keyHash, createdById: me.id },
  })

  revalidatePath("/settings")
  // Return the plaintext key ONCE — it will never be retrievable again
  return { plainKey }
}

export async function revokeApiKey(id: string) {
  await requireAdmin()
  await prisma.apiKey.update({ where: { id }, data: { isActive: false } })
  revalidatePath("/settings")
  return { success: true }
}
