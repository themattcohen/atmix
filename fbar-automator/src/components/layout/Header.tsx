import { Bell } from "lucide-react"

interface HeaderProps {
  title: string
  userName?: string
}

export function Header({ title, userName }: HeaderProps) {
  const initials = userName
    ? userName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?"

  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-200 bg-white px-8">
      <h1 className="text-xl font-semibold text-gray-900">{title}</h1>

      <div className="flex items-center gap-4">
        {/* Notification bell placeholder */}
        <button
          type="button"
          className="relative rounded-md p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          aria-label="View notifications"
        >
          <Bell className="h-5 w-5" />
        </button>

        {/* User avatar placeholder */}
        <div
          className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-900 text-xs font-medium text-white"
          aria-label={`Logged in as ${userName || "User"}`}
        >
          {initials}
        </div>
      </div>
    </header>
  )
}
