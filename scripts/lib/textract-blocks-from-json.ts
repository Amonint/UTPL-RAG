import type { Block } from '@aws-sdk/client-textract'

import { extractIsoDatesFromText, inferRangeFromText } from './textract-calendar-parse'

export type CalendarCandidateRow = {
  sourceRelative: string
  sourceJson: string
  kind: 'table_row' | 'line'
  tableIndex?: number
  rowIndex?: number
  page?: number
  rawText: string
  datesIso: string[]
  inferredStart: string | null
  inferredEnd: string | null
}

function buildMap(blocks: Block[]): Map<string, Block> {
  const m = new Map<string, Block>()
  for (const b of blocks) {
    if (b.Id) m.set(b.Id, b)
  }
  return m
}

function childIds(b: Block): string[] {
  const rels = b.Relationships ?? []
  const out: string[] = []
  for (const r of rels) {
    if (r.Type === 'CHILD' && r.Ids) out.push(...r.Ids)
  }
  return out
}

function blockText(block: Block, map: Map<string, Block>): string {
  if (block.Text) return block.Text
  const parts: string[] = []
  for (const id of childIds(block)) {
    const c = map.get(id)
    if (!c) continue
    if (c.BlockType === 'WORD' || c.BlockType === 'LINE') {
      if (c.Text) parts.push(c.Text)
    } else {
      const t = blockText(c, map)
      if (t) parts.push(t)
    }
  }
  return parts.join(' ').trim()
}

export function extractTableRows(
  blocks: Block[],
): { tableIndex: number; rowIndex: number; page?: number; text: string }[] {
  const map = buildMap(blocks)
  const tables = blocks.filter((b) => b.BlockType === 'TABLE')
  const rows: { tableIndex: number; rowIndex: number; page?: number; text: string }[] = []

  tables.forEach((table, tableIndex) => {
    const cellIds = childIds(table)
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
      const texts = rowCells.map((c) => blockText(c, map)).filter(Boolean)
      const text = texts.join(' | ')
      if (!text.trim()) continue
      const page = table.Page ?? rowCells[0]?.Page
      rows.push({ tableIndex, rowIndex: ri, page, text })
    }
  })

  return rows
}

export function extractLineBlocks(blocks: Block[]): { page?: number; text: string }[] {
  return blocks
    .filter((b) => b.BlockType === 'LINE' && b.Text?.trim())
    .map((b) => ({ page: b.Page, text: b.Text!.trim() }))
}

export function collectCandidates(
  relativeJson: string,
  relativePath: string | undefined,
  blocks: Block[],
): CalendarCandidateRow[] {
  const sourceRelative = relativePath ?? relativeJson
  const out: CalendarCandidateRow[] = []

  for (const { tableIndex, rowIndex, page, text } of extractTableRows(blocks)) {
    const datesIso = extractIsoDatesFromText(text)
    const range = inferRangeFromText(text)
    if (datesIso.length === 0 && !range) continue
    out.push({
      sourceRelative,
      sourceJson: relativeJson,
      kind: 'table_row',
      tableIndex,
      rowIndex,
      page,
      rawText: text,
      datesIso,
      inferredStart: range?.start ?? null,
      inferredEnd: range?.end ?? null,
    })
  }

  for (const { page, text } of extractLineBlocks(blocks)) {
    const datesIso = extractIsoDatesFromText(text)
    const range = inferRangeFromText(text)
    if (datesIso.length === 0) continue
    out.push({
      sourceRelative,
      sourceJson: relativeJson,
      kind: 'line',
      page,
      rawText: text,
      datesIso,
      inferredStart: range?.start ?? null,
      inferredEnd: range?.end ?? null,
    })
  }

  return out
}
