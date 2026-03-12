import Link from "next/link"

interface NextStepBannerProps {
  message: string
  subtext?: string
  href?: string
  buttonLabel?: string
  variant?: "green" | "blue"
  children?: React.ReactNode
}

export function NextStepBanner({
  message,
  subtext,
  href,
  buttonLabel,
  variant = "green",
  children,
}: NextStepBannerProps) {
  const colors =
    variant === "green"
      ? "bg-green-50 border-green-200 text-green-800"
      : "bg-blue-50 border-blue-200 text-blue-800"

  const subtextColor =
    variant === "green" ? "text-green-600" : "text-blue-600"

  const buttonColors =
    variant === "green"
      ? "bg-green-700 text-white hover:bg-green-800"
      : "bg-blue-700 text-white hover:bg-blue-800"

  return (
    <div className={`rounded-lg border p-4 ${colors}`}>
      <p className="text-sm font-medium">{message}</p>
      {subtext && (
        <p className={`text-xs mt-0.5 ${subtextColor}`}>{subtext}</p>
      )}
      {href && buttonLabel && (
        <div className="mt-3">
          <Link
            href={href}
            className={`inline-flex items-center rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${buttonColors}`}
          >
            {buttonLabel}
          </Link>
        </div>
      )}
      {children && <div className="mt-3">{children}</div>}
    </div>
  )
}
