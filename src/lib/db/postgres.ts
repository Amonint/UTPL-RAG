import type { QueryResultRow } from 'pg'

import { getPool } from './postgres-internal'

export { getPool } from './postgres-internal'

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values: ReadonlyArray<unknown> = [],
) {
  const pool = getPool()
  return pool.query<T>(text, [...values])
}
