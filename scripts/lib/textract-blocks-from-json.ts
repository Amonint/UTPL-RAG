import type { Block } from '@aws-sdk/client-textract'

import { buildBlockMap, blockTop, getBlockText, getChildIds } from './textract-block-utils'
import { extractIsoDatesFromText, inferRangeFromText } from './textract-calendar-parse'
import { extractLayoutListTexts, sectionPathForRow } from './textract-layout'
import {
  extractStructuredTableRows,
  inferRolesFromHeaders,
  isRespuestaRow,
  joinCellsByRole,
  resolveColumnRoles,
  stripRespuestaPrefix,
  type ColumnRole,
} from './textract-table-semantic'

export type { CanonicalEvent } from './textract-canonical'

export type CalendarCandidateRow = {
  sourceRelative: string
  sourceJson: string
  kind: 'table_row' | 'line' | 'layout_list'
  tableIndex?: number
  rowIndex?: number
  page?: number
  rawText: string
  datesIso: string[]
  inferredStart: string | null
  inferredEnd: string | null
  /** Jerarquía: título de documento + secciones LAYOUT + subsección de tabla si aplica */
  sectionPath?: string[]
  /** Título preferido para mostrar / matching (puede incluir padre en filas "Respuesta -") */
  title?: string
  parentActivity?: string
}

function groupStructuredByTable(
  rows: ReturnType<typeof extractStructuredTableRows>,
): Map<number, ReturnType<typeof extractStructuredTableRows>> {
  const m = new Map<number, ReturnType<typeof extractStructuredTableRows>>()
  for (const r of rows) {
    if (!m.has(r.tableIndex)) m.set(r.tableIndex, [])
    m.get(r.tableIndex)!.push(r)
  }
  return m
}

function inferHeaderRowIndex(
  rows: ReturnType<typeof extractStructuredTableRows>,
): number | null {
  const nonSection = rows.filter((r) => !r.isTableSectionTitle)
  const withEntity = nonSection.find((r) => r.hasColumnHeaderEntity)
  if (withEntity) return withEntity.rowIndex
  const withKeywordRoles = nonSection.find((r) =>
    inferRolesFromHeaders(r.cells).some((x) => x !== 'unknown'),
  )
  if (withKeywordRoles) return withKeywordRoles.rowIndex
  return null
}

function fallbackActivityFromCells(cells: string[], roles: ColumnRole[] | undefined): string {
  if (!roles || roles.length !== cells.length) return cells.filter(Boolean).join(' | ')
  const parts: string[] = []
  for (let i = 0; i < cells.length; i++) {
    const r = roles[i]
    if (r === 'start' || r === 'end' || r === 'role') continue
    if (cells[i]?.trim()) parts.push(cells[i].trim())
  }
  return parts.length > 0 ? parts.join(' | ') : cells.filter(Boolean).join(' | ')
}

function refineInferredRangeFromColumns(
  startCol: string,
  endCol: string,
  fallback: { start: string; end: string } | null,
): { start: string; end: string } | null {
  const ds = extractIsoDatesFromText(startCol)
  const de = extractIsoDatesFromText(endCol)
  if (ds.length > 0 && de.length > 0) {
    return { start: ds[0], end: de[de.length - 1] }
  }
  if (ds.length > 0 && de.length === 0) {
    const r = inferRangeFromText(endCol)
    if (r) return { start: ds[0], end: r.end }
  }
  if (de.length > 0 && ds.length === 0) {
    const r = inferRangeFromText(startCol)
    if (r) return { start: r.start, end: de[de.length - 1] }
  }
  return fallback
}

export function extractTableRows(
  blocks: Block[],
): { tableIndex: number; rowIndex: number; page?: number; text: string }[] {
  const map = buildBlockMap(blocks)
  const tables = blocks.filter((b) => b.BlockType === 'TABLE')
  const rows: { tableIndex: number; rowIndex: number; page?: number; text: string }[] = []

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
      const texts = rowCells.map((c) => getBlockText(c, map)).filter(Boolean)
      const text = texts.join(' | ')
      if (!text.trim()) continue
      const page = table.Page ?? rowCells[0]?.Page
      rows.push({ tableIndex, rowIndex: ri, page, text })
    }
  })

  return rows
}

export function extractLineBlocks(blocks: Block[]): { page?: number; text: string; top: number }[] {
  return blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text?.trim())
    .map((b) => ({ page: b.Page, text: b.Text!.trim(), top: blockTop(b) }))
}

export function collectCandidates(
  relativeJson: string,
  relativePath: string | undefined,
  blocks: Block[],
): CalendarCandidateRow[] {
  const sourceRelative = relativePath ?? relativeJson
  const out: CalendarCandidateRow[] = []

  const structured = extractStructuredTableRows(blocks)
  const rolesMap = resolveColumnRoles(structured)
  const byTable = groupStructuredByTable(structured)
  const headerRowIndexByTable = new Map<number, number>()
  for (const [ti, trs] of byTable) {
    const idx = inferHeaderRowIndex(trs)
    if (idx != null) headerRowIndexByTable.set(ti, idx)
  }

  let activeTableSection: string | null = null
  let prevActivity = ''

  const sortedRows = [...structured].sort(
    (a, b) => a.tableIndex - b.tableIndex || a.rowIndex - b.rowIndex,
  )

  for (const row of sortedRows) {
    if (row.isTableSectionTitle) {
      activeTableSection = row.rawJoined.replace(/\s*\|\s*/g, ' ').trim() || null
      continue
    }

    const headerIdx = headerRowIndexByTable.get(row.tableIndex)
    if (headerIdx != null && row.rowIndex === headerIdx) continue

    const roles = rolesMap.get(String(row.tableIndex))
    let activity = joinCellsByRole(row.cells, roles, 'activity')
    const startCol = joinCellsByRole(row.cells, roles, 'start')
    const endCol = joinCellsByRole(row.cells, roles, 'end')

    if (!activity.trim()) activity = fallbackActivityFromCells(row.cells, roles)
    if (!activity.trim()) activity = row.rawJoined

    const dateText =
      startCol || endCol ? [startCol, endCol].filter(Boolean).join(' ') : row.rawJoined
    const datesIso = extractIsoDatesFromText(dateText)
    let range = inferRangeFromText(dateText)
    range = refineInferredRangeFromColumns(startCol, endCol, range)

    if (datesIso.length === 0 && !range) continue

    const layoutPath = sectionPathForRow(row.page, row.rowTop, blocks)
    const sectionPath = [...layoutPath, ...(activeTableSection ? [activeTableSection] : [])]

    let title = activity
    let parentActivity: string | undefined
    if (isRespuestaRow(activity)) {
      parentActivity = prevActivity || undefined
      const stripped = stripRespuestaPrefix(activity)
      title = parentActivity ? `${parentActivity} — ${stripped}` : stripped
    } else {
      prevActivity = row.cells[0]?.trim() || activity
    }

    const inferredStart = range?.start ?? null
    const inferredEnd = range?.end ?? null
    const datesOut = datesIso.length > 0 ? datesIso : range ? [range.start, range.end] : []

    out.push({
      sourceRelative,
      sourceJson: relativeJson,
      kind: 'table_row',
      tableIndex: row.tableIndex,
      rowIndex: row.rowIndex,
      page: row.page,
      rawText: row.rawJoined,
      datesIso: datesOut,
      inferredStart,
      inferredEnd,
      sectionPath,
      title,
      parentActivity,
    })
  }

  for (const { page, text, top } of extractLineBlocks(blocks)) {
    const datesIso = extractIsoDatesFromText(text)
    const range = inferRangeFromText(text)
    if (datesIso.length === 0) continue
    const sectionPath = sectionPathForRow(page, top, blocks)
    out.push({
      sourceRelative,
      sourceJson: relativeJson,
      kind: 'line',
      page,
      rawText: text,
      datesIso,
      inferredStart: range?.start ?? null,
      inferredEnd: range?.end ?? null,
      sectionPath,
      title: text,
    })
  }

  for (const { page, text, top } of extractLayoutListTexts(blocks)) {
    const datesIso = extractIsoDatesFromText(text)
    const range = inferRangeFromText(text)
    if (datesIso.length === 0 && !range) continue
    const sectionPath = sectionPathForRow(page, top, blocks)
    const inferredStart = range?.start ?? null
    const inferredEnd = range?.end ?? null
    const datesOut = datesIso.length > 0 ? datesIso : range ? [range.start, range.end] : []
    out.push({
      sourceRelative,
      sourceJson: relativeJson,
      kind: 'layout_list',
      page,
      rawText: text,
      datesIso: datesOut,
      inferredStart,
      inferredEnd,
      sectionPath,
      title: text.split('\n')[0]?.trim() || text.slice(0, 200),
    })
  }

  return out
}

/** Construye eventos canónicos a partir de candidatos (útil para export o tests). */
export function candidatesToCanonicalEvents(c: CalendarCandidateRow[]): import('./textract-canonical').CanonicalEvent[] {
  return c.map((row) => ({
    title: row.title ?? row.rawText,
    start: row.inferredStart,
    end: row.inferredEnd,
    sectionPath: row.sectionPath ?? [],
    sourceKind: row.kind,
    page: row.page,
    tableIndex: row.tableIndex,
    rowIndex: row.rowIndex,
    parentActivity: row.parentActivity,
    rawText: row.rawText,
    datesIso: row.datesIso,
  }))
}
