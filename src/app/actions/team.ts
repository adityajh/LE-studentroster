"use server"

import { auth } from "@/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { ROLE_VALUES, type AppRole } from "@/lib/roles"

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

export async function updateUserRole(userId: string, role: AppRole) {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("Cannot change your own role")
  if (!ROLE_VALUES.includes(role)) throw new Error("Invalid role")
  await prisma.user.update({ where: { id: userId }, data: { role } })
  revalidatePath("/settings")
  return { success: true }
}

export async function addTeamMember(email: string, role: AppRole) {
  await requireAdmin()
  if (!email?.trim()) throw new Error("Email is required")
  if (!ROLE_VALUES.includes(role)) throw new Error("Invalid role")

  const normalised = email.trim().toLowerCase()

  // Upsert: if user already exists just update their role, otherwise create
  await prisma.user.upsert({
    where: { email: normalised },
    update: { role },
    create: { email: normalised, role },
  })

  revalidatePath("/settings")
  return { success: true }
}

export async function removeTeamMember(userId: string) {
  const me = await requireAdmin()
  if (me.id === userId) throw new Error("Cannot remove yourself")

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } })
  if (!user) throw new Error("User not found")

  // Nullify optional FK references first
  await prisma.payment.updateMany({ where: { recordedById: userId }, data: { recordedById: null } })
  await prisma.studentDocument.updateMany({ where: { uploadedById: userId }, data: { uploadedById: null } })

  // Attempt delete — will throw if audit logs reference this user
  try {
    await prisma.user.delete({ where: { id: userId } })
  } catch {
    throw new Error(
      "This user has recorded actions in the audit log and cannot be deleted. " +
      "Change their role to Staff to restrict access instead."
    )
  }

  revalidatePath("/settings")
  return { success: true }
}
