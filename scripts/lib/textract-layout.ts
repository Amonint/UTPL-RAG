import type { Block } from '@aws-sdk/client-textract'

import { blockTop, buildBlockMap, getBlockText } from './textract-block-utils'

const SECTION_LAYOUT_TYPES = new Set([
  'LAYOUT_TITLE',
  'LAYOUT_SECTION_HEADER',
])

/**
 * Bloques de maquetación relevantes para jerarquía, en el **mismo orden** que devuelve Textract.
 *
 * Según AWS (Layout response): los elementos se devuelven en «implied reading order»
 * (izquierda–derecha, arriba–abajo; en multicolumna, columna a columna). Ese orden ya viene
 * en el array `Blocks`; reordenar solo por BoundingBox puede invertir secciones en páginas
 * de varias columnas.
 *
 * @see https://docs.aws.amazon.com/textract/latest/dg/layoutresponse.html
 */
export function layoutHierarchyBlocks(blocks: Block[]): Block[] {
  const out: Block[] = []
  for (const b of blocks) {
    if (b.BlockType && SECTION_LAYOUT_TYPES.has(b.BlockType)) out.push(b)
  }
  return out
}

/**
 * Para una fila en `page` con borde superior `rowTop` (0–1), devuelve textos de
 * título de documento y encabezados de sección que aparecen **arriba** de la fila
 * (orden de lectura: título reinicia secciones; cada encabezado se apila).
 */
export function sectionPathForRow(page: number | undefined, rowTop: number, blocks: Block[]): string[] {
  if (page === undefined) return []
  const map = buildBlockMap(blocks)
  let docTitle: string | null = null
  const sections: string[] = []
  for (const b of layoutHierarchyBlocks(blocks)) {
    if ((b.Page ?? 0) !== page) continue
    if (blockTop(b) >= rowTop) continue
    const t = getBlockText(b, map).trim()
    if (!t) continue
    if (b.BlockType === 'LAYOUT_TITLE') {
      docTitle = t
      sections.length = 0
      continue
    }
    if (b.BlockType === 'LAYOUT_SECTION_HEADER') sections.push(t)
  }
  const out: string[] = []
  if (docTitle) out.push(docTitle)
  out.push(...sections)
  return out
}

/**
 * Texto de bloques LAYOUT_LIST en el orden del array `Blocks` (orden de lectura de la API).
 * Nota AWS: los hijos de LAYOUT_LIST suelen ser LAYOUT_TEXT, que a su vez enlazan LINE.
 */
export function extractLayoutListTexts(blocks: Block[]): { page?: number; text: string; top: number }[] {
  const map = buildBlockMap(blocks)
  const out: { page?: number; text: string; top: number }[] = []
  for (const b of blocks) {
    if (b.BlockType !== 'LAYOUT_LIST') continue
    const text = getBlockText(b, map).trim()
    if (!text) continue
    out.push({ page: b.Page, text, top: blockTop(b) })
  }
  return out
}
