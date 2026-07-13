import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless'
import { Pool as PgPool } from 'pg'
import type { Pool } from 'pg'
import ws from 'ws'

declare global {
  var __utplPgPool: Pool | undefined
}

function isNeonDatabaseUrl(connectionString: string): boolean {
  try {
    const host = new URL(connectionString).hostname
    return host.endsWith('.neon.tech')
  } catch {
    return connectionString.includes('neon.tech')
  }
}

/**
 * Neon + Vercel: prefer the pooler endpoint and drop channel_binding,
 * which often causes "Connection terminated unexpectedly" on serverless.
 */
export function normalizeNeonConnectionString(connectionString: string): string {
  let url: URL
  try {
    url = new URL(connectionString)
  } catch {
    return connectionString
  }

  if (!url.hostname.endsWith('.neon.tech')) {
    return connectionString
  }

  // ep-xxx.region → ep-xxx-pooler.region (idempotent)
  if (!url.hostname.includes('-pooler.')) {
    url.hostname = url.hostname.replace(
      /^(ep-[^.]+)\./,
      (_match, computeId: string) => `${computeId}-pooler.`,
    )
  }

  url.searchParams.delete('channel_binding')
  if (!url.searchParams.get('sslmode')) {
    url.searchParams.set('sslmode', 'require')
  }

  return url.toString()
}

function createPool(): Pool {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error('DATABASE_URL is required to query canonical database.')
  }

  if (isNeonDatabaseUrl(raw)) {
    const connectionString = normalizeNeonConnectionString(raw)
    neonConfig.webSocketConstructor = ws
    // HTTP fallback for Pool.query on Vercel (more stable than bare WebSockets).
    if (process.env.VERCEL) {
      neonConfig.poolQueryViaFetch = true
    }
    return new NeonPool({
      connectionString,
      max: process.env.VERCEL ? 1 : 10,
    }) as unknown as Pool
  }

  return new PgPool({
    connectionString: raw,
    max: 8,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 8_000,
  })
}

export function getPool(): Pool {
  if (!globalThis.__utplPgPool) {
    globalThis.__utplPgPool = createPool()
  }
  return globalThis.__utplPgPool
}

export function resetPoolForTests(): void {
  globalThis.__utplPgPool = undefined
}
