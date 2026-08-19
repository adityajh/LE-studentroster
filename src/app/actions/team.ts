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
    select: { id: true, name: true, email: true, role: true, ccOnEmails: true, createdAt: true },
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

export async function updateUserName(userId: string, name: string) {
  await requireAdmin()
  const trimmed = name.trim()
  await prisma.user.update({
    where: { id: userId },
    data: { name: trimmed.length > 0 ? trimmed : null },
  })
  revalidatePath("/settings")
  return { success: true }
}

export async function updateUserCcOnEmails(userId: string, ccOnEmails: boolean) {
  await requireAdmin()
  await prisma.user.update({ where: { id: userId }, data: { ccOnEmails } })
  revalidatePath("/settings")
  return { success: true }
}

import bcrypt from "bcryptjs"

export async function addTeamMember(email: string, role: AppRole, password?: string) {
  await requireAdmin()
  if (!email?.trim()) throw new Error("Email is required")
  if (!ROLE_VALUES.includes(role)) throw new Error("Invalid role")

  const normalised = email.trim().toLowerCase()
  let passwordHash: string | undefined = undefined
  if (password && password.trim().length > 0) {
    if (password.length < 6) throw new Error("Password must be at least 6 characters")
    passwordHash = await bcrypt.hash(password, 10)
  }

  const existing = await prisma.user.findUnique({ where: { email: normalised } })
  if (existing) {
    await prisma.user.update({
      where: { email: normalised },
      data: {
        role,
        ...(passwordHash ? { passwordHash } : {}),
      },
    })
  } else {
    if (!passwordHash) {
      throw new Error("Password is required for new team members")
    }
    await prisma.user.create({
      data: {
        email: normalised,
        role,
        passwordHash,
      },
    })
  }

  revalidatePath("/settings")
  return { success: true }
}

export async function updateUserPassword(userId: string, newPassword: string) {
  await requireAdmin()
  if (!newPassword || newPassword.length < 6) {
    throw new Error("Password must be at least 6 characters")
  }
  const passwordHash = await bcrypt.hash(newPassword, 10)
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
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
