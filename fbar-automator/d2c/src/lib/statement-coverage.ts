export function computeMonthsCovered(
  statementPeriods: Array<{ start_date: string; end_date: string }>,
  calendarYear: number
): { monthsCovered: number[]; monthsMissing: number[] } {
  const covered = new Set<number>()

  for (const period of statementPeriods) {
    const start = new Date(period.start_date + "T00:00:00")
    const end = new Date(period.end_date + "T00:00:00")

    const cursor = new Date(start.getFullYear(), start.getMonth(), 1)
    const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)

    while (cursor <= endMonth) {
      if (cursor.getFullYear() === calendarYear) {
        covered.add(cursor.getMonth() + 1) // 1-indexed
      }
      cursor.setMonth(cursor.getMonth() + 1)
    }
  }

  const monthsCovered = Array.from(covered).sort((a, b) => a - b)
  const allMonths = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]
  const monthsMissing = allMonths.filter((m) => !covered.has(m))

  return { monthsCovered, monthsMissing }
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

export function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? ""
}
