import IORedis from "ioredis"
import { createLogger } from "@/lib/logger"

const logger = createLogger({ module: "redis" })

let _sharedConnection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!_sharedConnection) {
    _sharedConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
    })

    _sharedConnection.on("connect", () => {
      logger.info("Redis connection established")
    })

    _sharedConnection.on("ready", () => {
      logger.info("Redis connection ready")
    })

    _sharedConnection.on("error", (err: Error) => {
      logger.error("Redis connection error", { error: err.message })
    })

    _sharedConnection.on("close", () => {
      logger.warn("Redis connection closed")
    })

    _sharedConnection.on("reconnecting", (delay: number) => {
      logger.warn("Redis reconnecting", { delayMs: delay })
    })
  }
  return _sharedConnection
}

export async function closeRedisConnection(): Promise<void> {
  if (_sharedConnection) {
    await _sharedConnection.quit()
    _sharedConnection = null
  }
}
