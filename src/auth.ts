import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import bcrypt from "bcryptjs"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET || "le-student-roster-secret-key-2026",
  trustHost: true,
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null
        }
        const email = (credentials.email as string).trim().toLowerCase()
        const password = credentials.password as string

        try {
          const dbUser = await prisma.user.findUnique({
            where: { email },
          })

          if (!dbUser) {
            console.error(`[NextAuth Authorize] User NOT found in database for email: "${email}"`)
            return null
          }

          if (!dbUser.passwordHash) {
            console.warn(`[NextAuth Authorize] User found (${dbUser.email}), but passwordHash is NULL in database. Checking default initial password...`)
            const DEFAULT_TEMP_PASSWORD = "ChangeMe123!"
            if (password === DEFAULT_TEMP_PASSWORD) {
              const hash = await bcrypt.hash(DEFAULT_TEMP_PASSWORD, 10)
              await prisma.user.update({
                where: { id: dbUser.id },
                data: { passwordHash: hash },
              })
              console.log(`[NextAuth Authorize] Auto-initialized passwordHash for ${dbUser.email}`)
              return {
                id: dbUser.id,
                name: dbUser.name,
                email: dbUser.email,
                role: dbUser.role,
              }
            }
            return null
          }

          const isValid = await bcrypt.compare(password, dbUser.passwordHash)
          if (!isValid) {
            console.error(`[NextAuth Authorize] Password mismatch for email: "${email}"`)
            return null
          }

          return {
            id: dbUser.id,
            name: dbUser.name,
            email: dbUser.email,
            role: dbUser.role,
          }
        } catch (error) {
          console.error("[NextAuth Authorize] Exception caught:", error)
          return null
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id
        token.role = (user as { role?: string }).role ?? "STAFF"
      }
      return token
    },
    async session({ session, token }) {
      if (session.user && token) {
        session.user.id = token.id as string
        ;(session.user as typeof session.user & { role: string }).role =
          (token.role as string) ?? "STAFF"
      }
      return session
    },
  },
})


