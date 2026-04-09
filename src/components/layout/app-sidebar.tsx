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
      collapsible="icon"
      className="bg-slate-950 border-slate-800 [&_[data-slot=sidebar]]:bg-slate-950"
    >
      {/* Header */}
      <SidebarHeader className="border-b border-slate-800 px-4 py-4">
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
      <SidebarContent className="bg-slate-950">
        <SidebarGroup>
          <SidebarGroupLabel className="text-[10px] uppercase tracking-widest font-bold text-slate-400 px-3 font-headline">
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
                        "text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                        isActive && "bg-slate-800 text-white shadow-sm"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
              
              {/* Conditional nav items */}
              {user?.role === "ADMIN" && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    render={<Link href="/reminders" />}
                    isActive={pathname.startsWith("/reminders")}
                    tooltip="Reminders"
                    className={cn(
                      "text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                      pathname.startsWith("/reminders") && "bg-slate-800 text-white shadow-sm"
                    )}
                  >
                    <Bell className="h-4 w-4" />
                    <span className="font-medium">Reminders</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="bg-slate-800" />

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
                        "text-slate-400 hover:text-white hover:bg-slate-800 transition-colors",
                        isActive && "bg-slate-800 text-white shadow-sm"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      <span className="font-medium">{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer — user info + logout */}
      <SidebarFooter className="border-t border-slate-800 bg-slate-950 p-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8 shrink-0">
            <AvatarFallback className="bg-slate-800 text-slate-300 text-xs font-bold">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="text-sm font-semibold text-slate-200 truncate">
              {user?.name ?? user?.email}
            </p>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded",
                user?.role === "ADMIN"
                  ? "bg-indigo-500/20 text-indigo-400"
                  : "bg-slate-800 text-slate-400"
              )}
            >
              {user?.role ?? "STAFF"}
            </span>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: "/login" })}
            className="text-slate-600 hover:text-slate-300 transition-colors group-data-[collapsible=icon]:hidden"
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
