type NodeEnv = 'development' | 'test' | 'production'

export interface RuntimeConfig {
  nodeEnv: NodeEnv
  port: number
  corsOrigins: string[]
  shutdownTimeoutMs: number
}

const DEFAULT_PORT = 4000
const DEFAULT_CORS = 'http://localhost:3000'
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10_000

function parseNumber(value: string | undefined, fallback: number): number {
  if (!value) return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) return fallback
  return parsed
}

function parseNodeEnv(value: string | undefined): NodeEnv {
  if (value === 'production' || value === 'test' || value === 'development') {
    return value
  }
  return 'development'
}

function parseCorsOrigins(value: string | undefined): string[] {
  const raw = value ?? DEFAULT_CORS
  const origins = raw
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0)

  if (origins.length === 0) {
    return [DEFAULT_CORS]
  }

  return origins
}

export function loadRuntimeConfig(env: NodeJS.ProcessEnv = process.env): RuntimeConfig {
  const port = parseNumber(env.PORT ?? env.API_PORT, DEFAULT_PORT)
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT 또는 API_PORT는 1~65535 범위의 정수여야 합니다.')
  }

  const shutdownTimeoutMs = parseNumber(env.SHUTDOWN_TIMEOUT_MS, DEFAULT_SHUTDOWN_TIMEOUT_MS)
  if (!Number.isInteger(shutdownTimeoutMs) || shutdownTimeoutMs < 1000) {
    throw new Error('SHUTDOWN_TIMEOUT_MS는 1000 이상의 정수여야 합니다.')
  }

  return {
    nodeEnv: parseNodeEnv(env.NODE_ENV),
    port,
    corsOrigins: parseCorsOrigins(env.CORS_ORIGINS),
    shutdownTimeoutMs,
  }
}