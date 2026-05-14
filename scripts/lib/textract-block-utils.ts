import type { Block } from '@aws-sdk/client-textract'

export function buildBlockMap(blocks: Block[]): Map<string, Block> {
  const m = new Map<string, Block>()
  for (const b of blocks) {
    if (b.Id) m.set(b.Id, b)
  }
  return m
}

export function getChildIds(b: Block): string[] {
  const rels = b.Relationships ?? []
  const out: string[] = []
  for (const r of rels) {
    if (r.Type === 'CHILD' && r.Ids) out.push(...r.Ids)
  }
  return out
}

export function getBlockText(block: Block, map: Map<string, Block>): string {
  if (block.Text) return block.Text
  const parts: string[] = []
  for (const id of getChildIds(block)) {
    const c = map.get(id)
    if (!c) continue
    if (c.BlockType === 'WORD' || c.BlockType === 'LINE') {
      if (c.Text) parts.push(c.Text)
    } else {
      const t = getBlockText(c, map)
      if (t) parts.push(t)
    }
  }
  return parts.join(' ').trim()
}

/** Top del BoundingBox normalizado [0,1] o 1e9 si falta. */
export function blockTop(b: Block): number {
  return b.Geometry?.BoundingBox?.Top ?? 1e9
}

export function blockLeft(b: Block): number {
  return b.Geometry?.BoundingBox?.Left ?? 0
}
