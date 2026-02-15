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
