"use server"

import { signIn } from "@/auth"
import { AuthError } from "next-auth"

export async function loginAction(prevState: any, formData: FormData) {
  const email = (formData.get("email") as string)?.trim().toLowerCase()
  const password = formData.get("password") as string
  const callbackUrl = (formData.get("callbackUrl") as string) || "/students"

  if (!email || !password) {
    return { error: "Please enter both email and password." }
  }

  try {
    await signIn("credentials", {
      email,
      password,
      redirectTo: callbackUrl,
    })
    return { error: null }
  } catch (error: any) {
    if (error instanceof AuthError) {
      const msg = (error as any).cause?.err?.message
      return { error: msg || "Invalid email or password. Please try again." }
    }
    // Re-throw Next.js redirect exceptions so navigation proceeds
    throw error
  }
}
