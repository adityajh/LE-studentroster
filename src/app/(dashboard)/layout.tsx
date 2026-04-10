import { auth } from "@/auth"
import { redirect } from "next/navigation"
import { AppSidebar } from "@/components/layout/app-sidebar"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { prisma } from "@/lib/prisma"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  if (!session?.user) {
    redirect("/login")
  }

  // Get user role from DB
  const dbUser = await prisma.user.findUnique({
    where: { email: session.user.email! },
    select: { role: true },
  })

  const user = {
    name: session.user.name,
    email: session.user.email,
    role: dbUser?.role ?? "STAFF",
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        {/* Top bar */}
        <header className="flex h-14 items-center gap-2 border-b border-slate-200 px-4 bg-white sticky top-0 z-10">
          <SidebarTrigger className="-ml-1 text-slate-500 hover:text-slate-800" />
          <Separator orientation="vertical" className="h-4 bg-slate-200" />
          <div className="flex-1" />
        </header>

        {/* Page content */}
        <main className="flex-1 p-4 md:p-6 bg-slate-50 min-h-screen overflow-x-auto">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
