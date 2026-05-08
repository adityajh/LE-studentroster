import NextAuth from "next-auth"
import { PrismaAdapter } from "@auth/prisma-adapter"
import Nodemailer from "next-auth/providers/nodemailer"
import { prisma } from "@/lib/prisma"

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(prisma),
  providers: [
    Nodemailer({
      server: {
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        auth: {
          user: process.env.GMAIL_USER,
          pass: process.env.GMAIL_APP_PASSWORD,
        },
      },
      from: process.env.GMAIL_USER ?? "noreply@letsent.com",
    }),
  ],
  pages: {
    signIn: "/login",
    verifyRequest: "/login/verify",
    error: "/login",
  },
  callbacks: {
    // Reject any sign-in whose email isn't already in the User table.
    // Without this, the PrismaAdapter auto-creates a new User row (with default
    // role STAFF) for any email that submits the magic-link form — i.e. anyone
    // who knows the production URL could self-register as STAFF.
    //
    // Only emails added via Settings → Team are allowed to log in. Students
    // and other token-authenticated flows do not log in at all.
    async signIn({ user }) {
      if (!user.email) return false
      const existing = await prisma.user.findUnique({
        where: { email: user.email },
        select: { id: true },
      })
      return existing !== null
    },
    async session({ session, user }) {
      if (session.user) {
        session.user.id = user.id
        // Attach role from our User table
        const dbUser = await prisma.user.findUnique({
          where: { id: user.id },
          select: { role: true },
        })
        ;(session.user as typeof session.user & { role: string }).role =
          dbUser?.role ?? "STAFF"
      }
      return session
    },
  },
})
