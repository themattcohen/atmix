"use client"

import { useState, useRef, useEffect } from "react"
import { signOut } from "next-auth/react"
import { LogOut, ChevronDown } from "lucide-react"

interface HeaderProps {
  title: string
  userName?: string
}

export function Header({ title, userName }: HeaderProps) {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false)
      }
    }

    if (isDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
      return () => {
        document.removeEventListener("mousedown", handleClickOutside)
      }
    }
  }, [isDropdownOpen])

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setIsDropdownOpen(!isDropdownOpen)}
          className="flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-gray-50 transition-colors"
          aria-label="User menu"
        >
          <div
            className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white"
            aria-label={`Logged in as ${userName || "User"}`}
          >
            {initials}
          </div>
          <ChevronDown className={`h-4 w-4 text-gray-600 transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {isDropdownOpen && (
          <div className="absolute right-0 mt-2 w-56 rounded-lg border border-gray-200 bg-white shadow-lg z-50">
            <div className="p-3 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-900">{userName || "User"}</p>
            </div>
            <div className="p-1">
              <button
                onClick={() => signOut({ callbackUrl: "/login" })}
                className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  )
}
