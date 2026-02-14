import IORedis from "ioredis"

let _sharedConnection: IORedis | null = null

export function getRedisConnection(): IORedis {
  if (!_sharedConnection) {
    _sharedConnection = new IORedis(process.env.REDIS_URL || "redis://localhost:6379", {
      maxRetriesPerRequest: null,
      lazyConnect: true,
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
