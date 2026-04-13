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
        <header className="flex h-14 items-center gap-2 border-b border-slate-100 px-4 bg-white/80 backdrop-blur-md sticky top-0 z-10">
          <SidebarTrigger className="-ml-1 text-slate-400 hover:text-slate-800 transition-colors" />
          <Separator orientation="vertical" className="h-4 bg-slate-200" />
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase tracking-widest font-bold text-slate-300">
              {user.role}
            </span>
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#3663AD] to-[#25BCBD] flex items-center justify-center">
              <span className="text-[10px] font-black text-white">
                {user.name?.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2) ?? "?"}
              </span>
            </div>
          </div>
        </header>

        {/* Page content — dot-grid background */}
        <main className="relative flex-1 p-4 md:p-6 min-h-screen overflow-x-auto bg-slate-50">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage: "radial-gradient(#cbd5e1 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
          <div className="relative">{children}</div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}
