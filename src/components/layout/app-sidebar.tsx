"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import Image from "next/image"
import {
  LayoutDashboard,
  Users,
  FileText,
  Settings,
  LogOut,
  Bell,
  History,
} from "lucide-react"
import { signOut } from "next-auth/react"

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { cn } from "@/lib/utils"

const navItems = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Students", href: "/students", icon: Users },
  { label: "Fee Schedule", href: "/fee-schedule", icon: FileText },
]

const bottomNavItems = [
  { label: "Settings", href: "/settings", icon: Settings },
]

interface AppSidebarProps {
  user: {
    name?: string | null
    email?: string | null
    role?: string
  }
}

export function AppSidebar({ user }: AppSidebarProps) {
  const pathname = usePathname()

  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user?.email?.[0]?.toUpperCase() ?? "U"

  return (
    <Sidebar
      collapsible="offcanvas"
      className="bg-[#160E44] border-white/5 [&_[data-slot=sidebar]]:bg-[#160E44]"
    >
      {/* Header */}
      <SidebarHeader className="border-b border-white/5 px-4 py-4">
        <div className="flex items-center gap-2">
          <Image
            src="/Let's-Enterprise-Final-Logo_LightMode.png"
            alt="Let's Enterprise"
            width={130}
            height={44}
            className="object-contain group-data-[collapsible=icon]:hidden"
          />
          <span className="hidden group-data-[collapsible=icon]:flex font-black text-white text-lg tracking-tight">
            LE
          </span>
        </div>
        <p className="text-[10px] uppercase tracking-widest font-bold text-slate-500 group-data-[collapsible=icon]:hidden mt-0.5">
          Student Roster
        </p>
      </SidebarHeader>

      {/* Main nav */}
      <SidebarContent className="bg-[#160E44]">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-white/30 px-3 font-headline">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "relative text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-lg",
                        isActive && "bg-white/8 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-[#25BCBD] before:rounded-full"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", isActive && "text-[#25BCBD]")} />
                      <span className="font-semibold">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}

              {/* Conditional nav items */}
              {user?.role === "ADMIN" && (
                <>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/reminders" />}
                      isActive={pathname.startsWith("/reminders")}
                      tooltip="Reminders"
                      className={cn(
                        "relative text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-lg",
                        pathname.startsWith("/reminders") && "bg-white/8 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-[#25BCBD] before:rounded-full"
                      )}
                    >
                      <Bell className={cn("h-4 w-4", pathname.startsWith("/reminders") && "text-[#25BCBD]")} />
                      <span className="font-semibold">Reminders</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      render={<Link href="/audit-logs" />}
                      isActive={pathname.startsWith("/audit-logs")}
                      tooltip="Changelog"
                      className={cn(
                        "relative text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-lg",
                        pathname.startsWith("/audit-logs") && "bg-white/8 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-[#25BCBD] before:rounded-full"
                      )}
                    >
                      <History className={cn("h-4 w-4", pathname.startsWith("/audit-logs") && "text-[#25BCBD]")} />
                      <span className="font-semibold">Changelog</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-white/5" />

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {bottomNavItems.map((item) => {
                const isActive = pathname.startsWith(item.href)
                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      isActive={isActive}
                      tooltip={item.label}
                      className={cn(
                        "relative text-white/50 hover:text-white hover:bg-white/5 transition-all duration-200 rounded-lg",
                        isActive && "bg-white/8 text-white before:absolute before:left-0 before:top-1/2 before:-translate-y-1/2 before:h-5 before:w-0.5 before:bg-[#25BCBD] before:rounded-full"
                      )}
                    >
                      <item.icon className={cn("h-4 w-4", isActive && "text-[#25BCBD]")} />
                      <span className="font-semibold">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — user info + logout */}
      <SidebarFooter className="border-t border-white/5 bg-[#160E44] p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-gradient-to-br from-[#3663AD] to-[#25BCBD] text-white text-xs font-black">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-white truncate">
              {user?.name ?? user?.email}
            </p>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                user?.role === "ADMIN"
                  ? "bg-[#25BCBD]/20 text-[#25BCBD]"
                  : "bg-white/10 text-white/50"
              )}
            >
              {user?.role ?? "STAFF"}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-white/30 hover:text-white/70 transition-colors group-data-[collapsible=icon]:hidden"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
