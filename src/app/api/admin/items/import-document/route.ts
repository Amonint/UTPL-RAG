import { extractPdfContent } from '@/lib/ocr/gemini-pdf-ocr'
import { dbQuery } from '@/lib/db/postgres'

interface CreatedItem {
  id: string
  sectionCode: 'faq' | 'general_info'
  title: string
}

interface ImportResult {
  processedBlocks: number
  createdCount: number
  skippedCount: number
  created: CreatedItem[]
  warnings: Array<{ index: number; reason: string }>
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sectionType = (formData.get('sectionType') as string) || 'information'

    console.log('[import-document] Received', { hasFile: !!file, sectionType })

    if (!file) {
      return Response.json({ error: 'No file provided', success: false }, { status: 400 })
    }

    const extractionResult = await extractPdfContent(file, {
      maxPages: 5,
      sectionType: sectionType as any
    })

    console.log('[import-document] Extraction', {
      success: extractionResult.success,
      itemCount: extractionResult.itemCount,
      error: extractionResult.error,
    })

    if (!extractionResult.success || extractionResult.items.length === 0) {
      return Response.json(
        { error: extractionResult.error || 'Extraction failed', success: false },
        { status: 400 },
      )
    }

    // Get domain
    const domainRes = await dbQuery<{ id: string }>(
      'SELECT id FROM domains WHERE code = $1 AND is_active = true LIMIT 1',
      ['academic'],
    )

    if (domainRes.rows.length === 0) {
      return Response.json({ error: 'No default domain found', success: false }, { status: 500 })
    }

    const domainId = domainRes.rows[0].id

    // Get category
    const categoryRes = await dbQuery<{ id: string }>(
      'SELECT id FROM kb_categories WHERE domain_id = $1 AND is_active = true LIMIT 1',
      [domainId],
    )

    if (categoryRes.rows.length === 0) {
      return Response.json(
        { error: 'No default category found', success: false },
        { status: 500 },
      )
    }

    const categoryId = categoryRes.rows[0].id

    // Get subcategory
    const subcategoryRes = await dbQuery<{ id: string }>(
      'SELECT id FROM kb_subcategories WHERE kb_category_id = $1 AND is_active = true LIMIT 1',
      [categoryId],
    )

    if (subcategoryRes.rows.length === 0) {
      return Response.json(
        { error: 'No default subcategory found', success: false },
        { status: 500 },
      )
    }

    const subcategoryId = subcategoryRes.rows[0].id

    // Get or create element
    const elementRes = await dbQuery<{ id: string }>(
      `SELECT id FROM kb_elements
       WHERE kb_subcategory_id = $1
       AND (slug = 'general' OR name = 'General')
       AND is_active = true
       LIMIT 1`,
      [subcategoryId],
    )

    let elementId: string
    if (elementRes.rows.length > 0) {
      elementId = elementRes.rows[0].id
    } else {
      const createRes = await dbQuery<{ id: string }>(
        `INSERT INTO kb_elements (kb_subcategory_id, name, slug, is_active)
         VALUES ($1, 'General', 'general', true)
         RETURNING id`,
        [subcategoryId],
      )
      elementId = createRes.rows[0].id
    }

    // Create items (multiple from extraction)
    const created: CreatedItem[] = []
    const warnings: Array<{ index: number; reason: string }> = []

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i]

      try {
        // Determine section code
        const sectionCode: 'faq' | 'general_info' = item.question ? 'faq' : 'general_info'

        const title = item.title || `Item ${i + 1}`

        // Create knowledge item
        const itemRes = await dbQuery<{ id: string }>(
          `INSERT INTO knowledge_items
           (kb_element_id, domain_id, section_code, canonical_slug, title, editorial_status, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, true)
           RETURNING id`,
          [
            elementId,
            domainId,
            sectionCode,
            `imported-${Date.now()}-${Math.random().toString(36).substring(7)}`,
            title,
            'editorial_draft',
          ],
        )

        const itemId = itemRes.rows[0].id

        // Create version with extracted content
        await dbQuery<{ version_number: number }>(
          `INSERT INTO knowledge_item_versions
           (knowledge_item_id, version_number, question_text, answer_text, change_summary)
           VALUES ($1, $2, $3, $4, $5)
           RETURNING version_number`,
          [
            itemId,
            1,
            sectionCode === 'faq' ? (item.question || '') : (item.answer || ''),
            item.answer || '',
            `Imported from PDF (topic: ${item.topic || 'general'})`,
          ],
        )

        created.push({
          id: itemId,
          sectionCode,
          title,
        })

        console.log(`[import-document] Created item ${i + 1}/${extractionResult.itemCount}: ${title}`)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        warnings.push({ index: i, reason })
        console.warn(`[import-document] Failed to create item ${i + 1}: ${reason}`)
      }
    }

    const result: ImportResult = {
      processedBlocks: extractionResult.itemCount,
      createdCount: created.length,
      skippedCount: extractionResult.itemCount - created.length,
      created,
      warnings,
    }

    console.log('[import-document] Success', result)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[import-document] Error', { message })
    return Response.json({ error: message, success: false }, { status: 500 })
  }
}
