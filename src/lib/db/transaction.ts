import type { PoolClient, QueryResultRow } from 'pg'

import { getPool } from './postgres-internal'

export async function withDbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function dbQueryClient<T extends QueryResultRow = QueryResultRow>(
  client: PoolClient,
  text: string,
  values: ReadonlyArray<unknown> = [],
) {
  return client.query<T>(text, [...values])
}
