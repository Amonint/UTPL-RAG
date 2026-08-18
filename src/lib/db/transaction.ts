import type { PoolClient, QueryResultRow } from 'pg'

import { getPool } from './postgres-internal'

export async function withDbTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect()
  let transactionStarted = false
  try {
    await client.query('BEGIN')
    transactionStarted = true
    const result = await fn(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    if (transactionStarted) {
      try {
        await client.query('ROLLBACK')
      } catch {
        // Dead client: do not mask the original error with "not queryable".
      }
    }
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
