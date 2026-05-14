import type { Block } from '@aws-sdk/client-textract'
import { describe, expect, it } from 'vitest'

import { collectCandidates } from '../../scripts/lib/textract-blocks-from-json'

describe('layout + cabecera de tabla', () => {
  it('omite fila de cabecera con COLUMN_HEADER', () => {
    const blocks: Block[] = [
      {
        BlockType: 'TABLE',
        Id: 't1',
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['h1', 'h2', 'd1', 'd2'] }],
      },
      {
        BlockType: 'CELL',
        Id: 'h1',
        RowIndex: 1,
        ColumnIndex: 1,
        Page: 1,
        EntityTypes: ['COLUMN_HEADER'],
        Relationships: [{ Type: 'CHILD', Ids: ['wh1'] }],
      },
      { BlockType: 'WORD', Id: 'wh1', Text: 'Actividad', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'h2',
        RowIndex: 1,
        ColumnIndex: 2,
        Page: 1,
        EntityTypes: ['COLUMN_HEADER'],
        Relationships: [{ Type: 'CHILD', Ids: ['wh2'] }],
      },
      { BlockType: 'WORD', Id: 'wh2', Text: 'Fecha inicio', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'd1',
        RowIndex: 2,
        ColumnIndex: 1,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['wd1'] }],
      },
      { BlockType: 'WORD', Id: 'wd1', Text: 'Carnaval', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'd2',
        RowIndex: 2,
        ColumnIndex: 2,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['wd2'] }],
      },
      { BlockType: 'WORD', Id: 'wd2', Text: '16/02/2026', Page: 1 },
    ]
    const cand = collectCandidates('h.json', 'doop/t.pdf', blocks)
    expect(cand.some((c) => c.rawText.includes('Actividad'))).toBe(false)
    expect(cand.some((c) => c.rawText.includes('Carnaval'))).toBe(true)
  })

  it('adjunta sectionPath desde LAYOUT_SECTION_HEADER arriba de la fila', () => {
    const blocks: Block[] = [
      {
        BlockType: 'LAYOUT_SECTION_HEADER',
        Id: 'lh',
        Page: 1,
        Geometry: { BoundingBox: { Top: 0.1, Left: 0.1, Width: 0.8, Height: 0.02 } },
        Relationships: [{ Type: 'CHILD', Ids: ['lw'] }],
      },
      { BlockType: 'WORD', Id: 'lw', Text: 'Tecnologías', Page: 1 },
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
        Geometry: { BoundingBox: { Top: 0.3, Left: 0.1, Width: 0.4, Height: 0.02 } },
        Relationships: [{ Type: 'CHILD', Ids: ['w1'] }],
      },
      { BlockType: 'WORD', Id: 'w1', Text: 'Evento X', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'c2',
        RowIndex: 1,
        ColumnIndex: 2,
        Page: 1,
        Geometry: { BoundingBox: { Top: 0.3, Left: 0.5, Width: 0.4, Height: 0.02 } },
        Relationships: [{ Type: 'CHILD', Ids: ['w2'] }],
      },
      { BlockType: 'WORD', Id: 'w2', Text: '10/03/2026', Page: 1 },
    ]
    const cand = collectCandidates('l.json', 'doop/l.pdf', blocks)
    const row = cand.find((c) => c.kind === 'table_row')
    expect(row?.sectionPath?.join('>')).toContain('Tecnologías')
  })
})
