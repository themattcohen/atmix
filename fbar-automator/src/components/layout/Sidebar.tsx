"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { signOut } from "next-auth/react"
import {
  DollarSign,
  FileText,
  LayoutDashboard,
  Users,
  Settings,
  LogOut,
} from "lucide-react"

interface SidebarProps {
  user: {
    name: string
    email: string
    role: string
  }
}

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/clients", label: "Clients", icon: Users },
  { href: "/settings", label: "Settings", icon: Settings },
  { href: "/settings/exchange-rates", label: "Exchange Rates", icon: DollarSign },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()

  function isActive(href: string): boolean {
    if (href === "/") {
      return pathname === "/"
    }
    return pathname.startsWith(href)
  }

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-64 flex-col bg-gray-900 text-white">
      {/* Logo / Brand */}
      <div className="flex h-16 items-center gap-2 border-b border-gray-800 px-6">
        <FileText className="h-6 w-6 text-blue-400" />
        <span className="text-lg font-semibold tracking-tight">
          FBAR Automator
        </span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Main navigation">
        {navItems.map((item) => {
          const Icon = item.icon
          const active = isActive(item.href)

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-gray-800 text-white"
                  : "text-gray-400 hover:bg-gray-800 hover:text-white"
              }`}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5 flex-shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      {/* User Info + Sign Out */}
      <div className="border-t border-gray-800 p-4">
        <div className="mb-3 px-1">
          <p className="truncate text-sm font-medium text-white">
            {user.name}
          </p>
          <p className="truncate text-xs text-gray-400">
            {user.role.charAt(0).toUpperCase() + user.role.slice(1).toLowerCase()}
          </p>
        </div>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-gray-400 transition-colors hover:bg-gray-800 hover:text-white"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          Sign out
        </button>
      </div>
    </aside>
  )
}
