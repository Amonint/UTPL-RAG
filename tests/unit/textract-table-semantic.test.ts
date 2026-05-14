import type { Block } from '@aws-sdk/client-textract'
import { describe, expect, it } from 'vitest'

import { collectCandidates } from '../../scripts/lib/textract-blocks-from-json'
import { isRespuestaRow, stripRespuestaPrefix } from '../../scripts/lib/textract-table-semantic'

describe('textract-table-semantic / respuesta', () => {
  it('detecta fila Respuesta', () => {
    expect(isRespuestaRow('Respuesta - tomar componentes')).toBe(true)
    expect(isRespuestaRow('respuesta – foo')).toBe(true)
    expect(stripRespuestaPrefix('Respuesta - tomar')).toBe('tomar')
  })

  it('enlaza Respuesta con actividad previa', () => {
    const blocks: Block[] = [
      {
        BlockType: 'TABLE',
        Id: 't1',
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['a1', 'a2', 'b1', 'b2'] }],
      },
      {
        BlockType: 'CELL',
        Id: 'a1',
        RowIndex: 1,
        ColumnIndex: 1,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w1'] }],
      },
      { BlockType: 'WORD', Id: 'w1', Text: 'Tomar componentes', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'a2',
        RowIndex: 1,
        ColumnIndex: 2,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w2'] }],
      },
      { BlockType: 'WORD', Id: 'w2', Text: '01/01/2026', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'b1',
        RowIndex: 2,
        ColumnIndex: 1,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w3'] }],
      },
      { BlockType: 'WORD', Id: 'w3', Text: 'Respuesta - tomar componentes', Page: 1 },
      {
        BlockType: 'CELL',
        Id: 'b2',
        RowIndex: 2,
        ColumnIndex: 2,
        Page: 1,
        Relationships: [{ Type: 'CHILD', Ids: ['w4'] }],
      },
      { BlockType: 'WORD', Id: 'w4', Text: '15/01/2026', Page: 1 },
    ]
    const cand = collectCandidates('z.json', 'doop/x.pdf', blocks)
    const r = cand.find((c) => c.kind === 'table_row' && c.rowIndex === 2)
    expect(r?.parentActivity).toBe('Tomar componentes')
    expect(r?.title).toContain('Tomar componentes')
    expect(r?.title).toContain('tomar componentes')
  })
})
