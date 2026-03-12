type LogLevel = "debug" | "info" | "warn" | "error"

interface LogContext {
  [key: string]: unknown
}

interface Logger {
  debug: (msg: string, extra?: LogContext) => void
  info: (msg: string, extra?: LogContext) => void
  warn: (msg: string, extra?: LogContext) => void
  error: (msg: string, extra?: LogContext) => void
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
}

function getMinLevel(): number {
  try {
    const env = typeof process !== "undefined" ? process.env?.LOG_LEVEL : undefined
    if (env && env in LOG_LEVELS) return LOG_LEVELS[env as LogLevel]
  } catch {
    // Edge runtime may not have process
  }
  return LOG_LEVELS.info
}

function emit(level: LogLevel, msg: string, baseCtx: LogContext, extra?: LogContext) {
  if (LOG_LEVELS[level] < getMinLevel()) return

  const entry = { ts: new Date().toISOString(), level, msg, ...baseCtx, ...extra }
  const line = JSON.stringify(entry)

  if (level === "error") {
    console.error(line)
  } else if (level === "warn") {
    console.warn(line)
  } else {
    console.log(line)
  }
}

export function createLogger(baseCtx: LogContext = {}): Logger {
  return {
    debug: (msg, extra) => emit("debug", msg, baseCtx, extra),
    info: (msg, extra) => emit("info", msg, baseCtx, extra),
    warn: (msg, extra) => emit("warn", msg, baseCtx, extra),
    error: (msg, extra) => emit("error", msg, baseCtx, extra),
  }
}
