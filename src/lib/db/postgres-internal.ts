import { Pool as NeonPool, neonConfig } from '@neondatabase/serverless'
import { Pool as PgPool } from 'pg'
import type { Pool } from 'pg'
import ws from 'ws'

declare global {
  var __utplPgPool: Pool | undefined
}

export type DbPoolDriver = 'pg' | 'neon-serverless'

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

/**
 * Neon WebSocket Pool.connect() fails on Vercel Node with
 * "Client has encountered a connection error and is not queryable"
 * (used by withDbTransaction for /cargar writes). Prefer TCP `pg` + pooler
 * on Node; keep neon-serverless only for Edge.
 */
export function resolveDbPoolDriver(opts: {
  connectionString: string
  nextRuntime?: string
  vercel?: boolean
}): DbPoolDriver {
  if (!isNeonDatabaseUrl(opts.connectionString)) return 'pg'
  if (opts.nextRuntime === 'edge') return 'neon-serverless'
  return 'pg'
}

function createPool(): Pool {
  const raw = process.env.DATABASE_URL?.trim()
  if (!raw) {
    throw new Error('DATABASE_URL is required to query canonical database.')
  }

  const driver = resolveDbPoolDriver({
    connectionString: raw,
    nextRuntime: process.env.NEXT_RUNTIME,
    vercel: Boolean(process.env.VERCEL),
  })
  const connectionString = isNeonDatabaseUrl(raw)
    ? normalizeNeonConnectionString(raw)
    : raw

  if (driver === 'neon-serverless') {
    neonConfig.webSocketConstructor = ws
    return new NeonPool({
      connectionString,
      max: 1,
    }) as unknown as Pool
  }

  return new PgPool({
    connectionString,
    // Keep small on Vercel, but >1 so accidental nested pool.query during a
    // checkout cannot deadlock the whole request (see knowledge-search-index).
    max: process.env.VERCEL ? 3 : 8,
    idleTimeoutMillis: 20_000,
    connectionTimeoutMillis: 10_000,
    allowExitOnIdle: Boolean(process.env.VERCEL),
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
