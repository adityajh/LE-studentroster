"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
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

export async function getTeamMembers() {
  await requireAdmin()
  return prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })
}

export async function updateUserRole(userId: string, role: "ADMIN" | "STAFF") {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("Cannot change your own role")
  await prisma.user.update({ where: { id: userId }, data: { role } })
  revalidatePath("/settings")
  return { success: true }
}
