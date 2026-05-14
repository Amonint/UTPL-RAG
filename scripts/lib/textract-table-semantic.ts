import type { Block } from '@aws-sdk/client-textract'

import { blockTop, buildBlockMap, getBlockText, getChildIds } from './textract-block-utils'
import { normalizeTitle } from './textract-calendar-parse'

export type ColumnRole = 'activity' | 'start' | 'end' | 'role' | 'unknown'

export type StructuredTableRow = {
  tableIndex: number
  rowIndex: number
  page?: number
  cells: string[]
  rowTop: number
  /** Alguna celda es encabezado de columna según Textract */
  hasColumnHeaderEntity: boolean
  /** Alguna celda es título de sección dentro de la tabla */
  isTableSectionTitle: boolean
  rawJoined: string
}

function cellHasEntity(cell: Block, entity: string): boolean {
  return (cell.EntityTypes ?? []).some((e) => e === entity)
}

export function inferRolesFromHeaders(headerCells: string[]): ColumnRole[] {
  return headerCells.map((h) => {
    const n = normalizeTitle(h).replace(/\s+/g, ' ')
    if (
      n.includes('fecha inicio') ||
      n.includes('dia inicio') ||
      n.includes('inicio') ||
      n.includes('desde') ||
      n === 'inicio'
    ) {
      if (n.includes('fin')) return 'unknown'
      return 'start'
    }
    if (n.includes('fecha fin') || n.includes('dia fin') || n.includes('fin') || n.includes('hasta')) return 'end'
    if (n.includes('responsable') || n.includes('rol') || n.includes('ejecutor')) return 'role'
    if (n.includes('actividad') || n.includes('servicio') || n.includes('tarea') || n.includes('nombre')) {
      return 'activity'
    }
    return 'unknown'
  })
}

/** Si hay una sola columna unknown y el resto cubierto, asignar unknown a activity. */
function refineRoles(roles: ColumnRole[]): ColumnRole[] {
  const out = [...roles]
  const unknownIdx = out.map((r, i) => (r === 'unknown' ? i : -1)).filter((i) => i >= 0)
  if (unknownIdx.length === 1 && out.length > 1) {
    const i = unknownIdx[0]
    const hasAct = out.some((r) => r === 'activity')
    if (!hasAct) out[i] = 'activity'
  }
  if (out.length >= 3 && out.every((r) => r === 'unknown')) {
    out[0] = 'activity'
    if (out.length >= 3) {
      out[out.length - 2] = 'start'
      out[out.length - 1] = 'end'
    }
  }
  return out
}

export function extractStructuredTableRows(blocks: Block[]): StructuredTableRow[] {
  const map = buildBlockMap(blocks)
  const tables = blocks.filter((b) => b.BlockType === 'TABLE')
  const rows: StructuredTableRow[] = []

  tables.forEach((table, tableIndex) => {
    const cellIds = getChildIds(table)
    const cells = cellIds
      .map((id) => map.get(id))
      .filter((b): b is Block => !!b && b.BlockType === 'CELL')

    const byRow = new Map<number, Block[]>()
    for (const cell of cells) {
      const ri = cell.RowIndex ?? 0
      if (!byRow.has(ri)) byRow.set(ri, [])
      byRow.get(ri)!.push(cell)
    }
    const sortedRows = [...byRow.keys()].sort((a, b) => a - b)

    for (const ri of sortedRows) {
      const rowCells = (byRow.get(ri) ?? []).sort((a, b) => (a.ColumnIndex ?? 0) - (b.ColumnIndex ?? 0))
      const texts = rowCells.map((c) => getBlockText(c, map))
      const nonEmpty = texts.map((t) => t.trim()).filter(Boolean)
      if (nonEmpty.length === 0) continue

      const rowTop = Math.min(...rowCells.map((c) => blockTop(c)))
      const page = table.Page ?? rowCells[0]?.Page
      const hasColumnHeaderEntity = rowCells.some((c) => cellHasEntity(c, 'COLUMN_HEADER'))
      const isTableSectionTitle = rowCells.some((c) => cellHasEntity(c, 'TABLE_SECTION_TITLE'))

      const rawJoined = texts
        .map((t) => t.trim())
        .filter(Boolean)
        .join(' | ')

      rows.push({
        tableIndex,
        rowIndex: ri,
        page,
        cells: texts.map((t) => t.trim()),
        rowTop,
        hasColumnHeaderEntity,
        isTableSectionTitle,
        rawJoined,
      })
    }
  })

  return rows
}

/**
 * Detecta fila de cabecera (primera fila con COLUMN_HEADER o keywords) y devuelve roles por columna.
 */
export function resolveColumnRoles(rows: StructuredTableRow[]): Map<string, ColumnRole[]> {
  const key = (tableIndex: number) => String(tableIndex)
  const byTable = new Map<number, StructuredTableRow[]>()
  for (const r of rows) {
    if (!byTable.has(r.tableIndex)) byTable.set(r.tableIndex, [])
    byTable.get(r.tableIndex)!.push(r)
  }

  const rolesMap = new Map<string, ColumnRole[]>()

  for (const [ti, trs] of byTable) {
    const sorted = [...trs].sort((a, b) => a.rowIndex - b.rowIndex)
    const nonSection = sorted.filter((r) => !r.isTableSectionTitle)
    const headerCandidate =
      nonSection.find((r) => r.hasColumnHeaderEntity) ??
      nonSection.find((r) => inferRolesFromHeaders(r.cells).some((x) => x !== 'unknown')) ??
      nonSection[0] ??
      sorted[0]
    if (!headerCandidate || headerCandidate.cells.length === 0) continue

    let roles = inferRolesFromHeaders(headerCandidate.cells)
    roles = refineRoles(roles)
    if (roles.length !== headerCandidate.cells.length) {
      roles = headerCandidate.cells.map(() => 'unknown' as ColumnRole)
      roles = refineRoles(roles)
    }
    rolesMap.set(key(ti), roles)
  }

  return rolesMap
}

export function joinCellsByRole(
  cells: string[],
  roles: ColumnRole[] | undefined,
  role: ColumnRole,
): string {
  if (!roles || roles.length !== cells.length) return ''
  const parts: string[] = []
  for (let i = 0; i < cells.length; i++) {
    if (roles[i] === role && cells[i]?.trim()) parts.push(cells[i].trim())
  }
  return parts.join(' ').trim()
}

const RESPUESTA_RE = /^\s*respuesta\s*[-–—:]\s*/i

export function isRespuestaRow(activityText: string): boolean {
  return RESPUESTA_RE.test(activityText)
}

export function stripRespuestaPrefix(activityText: string): string {
  return activityText.replace(RESPUESTA_RE, '').trim()
}
