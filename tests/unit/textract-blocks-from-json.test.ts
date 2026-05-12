import type { Block } from '@aws-sdk/client-textract'
import { describe, expect, it } from 'vitest'

import { collectCandidates, extractTableRows } from '../../scripts/lib/textract-blocks-from-json'

describe('textract-blocks-from-json', () => {
  it('reconstruye una fila de tabla con fecha', () => {
    const blocks: Block[] = [
      {
        BlockType: 'TABLE',
        Id: 't1',
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['c1', 'c2'] }],
      },
      {
        BlockType: 'CELL',
        Id: 'c1',
        RowIndex: 1,
        ColumnIndex: 1,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w1'] }],
      },
      { BlockType: 'WORD', Id: 'w1', Text: '09/03/2026', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'c2',
        RowIndex: 1,
        ColumnIndex: 2,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w2'] }],
      },
      { BlockType: 'WORD', Id: 'w2', Text: 'Inscripción validación', Page: 1 },
    ]
    const rows = extractTableRows(blocks)
    expect(rows).toHaveLength(1)
    expect(rows[0].text).toContain('09/03/2026')
    expect(rows[0].text).toContain('Inscripción')

    const cand = collectCandidates('x.json', 'doop/foo.pdf', blocks)
    expect(cand.some((c) => c.kind === 'table_row' && c.inferredStart === '2026-03-09')).toBe(true)
  })

  it('extrae líneas con fechas', () => {
    const blocks: Block[] = [
      { BlockType: 'LINE', Id: 'l1', Text: 'Período del 01/04/2026 al 30/04/2026', Page: 2 },
    ]
    const cand = collectCandidates('y.json', 'doop/bar.pdf', blocks)
    expect(cand.some((c) => c.kind === 'line' && c.datesIso.includes('2026-04-30'))).toBe(true)
  })
})
