import { z } from 'zod'

const configSchema = z.object({
  EBAY_CLIENT_ID: z.string().default(''),
  EBAY_CLIENT_SECRET: z.string().default(''),
  EBAY_DEV_ID: z.string().default(''),
  EBAY_REDIRECT_URI: z.string().default(''),
  EBAY_REFRESH_TOKEN: z.string().default(''),
  EBAY_ENVIRONMENT: z.enum(['production', 'sandbox']).default('production'),
  SYNC_INTERVAL_MINUTES: z.coerce.number().int().positive().default(10),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_PATH: z.string().default('./db/watchlist.db'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type AppConfig = z.infer<typeof configSchema>

export function validateConfig(): AppConfig {
  const result = configSchema.safeParse(process.env)
  if (!result.success) {
    const missing = result.error.issues.map(i => i.path.join('.')).join(', ')
    throw new Error(`Invalid configuration: ${missing}. Check your .env file.`)
  }

  const config = result.data
  if (!config.EBAY_CLIENT_ID || config.EBAY_CLIENT_ID.startsWith('placeholder')) {
    console.warn('eBay credentials not configured — sync will be disabled. Set real credentials in .env to enable.')
  }

  return config
}

export function hasEbayCredentials(config: AppConfig): boolean {
  return !!(
    config.EBAY_CLIENT_ID &&
    !config.EBAY_CLIENT_ID.startsWith('placeholder') &&
    config.EBAY_REFRESH_TOKEN &&
    !config.EBAY_REFRESH_TOKEN.startsWith('placeholder')
  )
}
