import { extractPdfContent } from '@/lib/ocr/gemini-pdf-ocr'
import { dbQuery } from '@/lib/db/postgres'

export const maxDuration = 60

interface CreatedEvent {
  id: string
  title: string
  startsOn: string | null
  endsOn: string | null
}

interface ImportResult {
  processedBlocks?: number
  createdCount?: number
  skippedCount?: number
  created?: CreatedEvent[]
  warnings?: Array<{ index: number; reason: string }>
  error?: string
  success?: boolean
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null

    console.log('[calendar-import-document] Received', { hasFile: !!file })

    if (!file) {
      return Response.json({ error: 'No file provided', success: false }, { status: 400 })
    }

    const extractionResult = await extractPdfContent(file, {
      sectionType: 'calendar'
    })

    console.log('[calendar-import-document] Extraction', {
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

    // Get default calendar (first active calendar)
    const calendarRes = await dbQuery<{ id: string }>(
      'SELECT id FROM calendars WHERE is_active = true LIMIT 1',
    )

    if (calendarRes.rows.length === 0) {
      return Response.json(
        { error: 'No default calendar found. Create a calendar first.', success: false },
        { status: 500 },
      )
    }

    const calendarId = calendarRes.rows[0].id

    // Create calendar events
    const created: CreatedEvent[] = []
    const warnings: Array<{ index: number; reason: string }> = []

    for (let i = 0; i < extractionResult.items.length; i++) {
      const item = extractionResult.items[i]

      try {
        const title = item.title || `Event ${i + 1}`
        const startsOn = item.startDate || new Date().toISOString().split('T')[0]
        const endsOn = item.endDate || startsOn

        // ponytail: generate canonical slug from title + timestamp
        const canonicalSlug = `${title.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}-${i}`

        // Create calendar event
        const eventRes = await dbQuery<{ id: string }>(
          `INSERT INTO calendar_events
           (calendar_id, title, starts_on, ends_on, event_type, canonical_slug, details_text, is_active)
           VALUES ($1, $2, $3, $4, $5, $6, $7, true)
           RETURNING id`,
          [
            calendarId,
            title,
            startsOn,
            endsOn,
            item.eventType || item.topic || 'academic',
            canonicalSlug,
            item.description || '',
          ],
        )

        const eventId = eventRes.rows[0].id

        created.push({
          id: eventId,
          title,
          startsOn,
          endsOn,
        })

        console.log(`[calendar-import-document] Created event ${i + 1}/${extractionResult.itemCount}: ${title}`)
      } catch (err) {
        const reason = err instanceof Error ? err.message : String(err)
        warnings.push({ index: i, reason })
        console.warn(`[calendar-import-document] Failed to create event ${i + 1}: ${reason}`)
      }
    }

    const result: ImportResult = {
      processedBlocks: extractionResult.itemCount,
      createdCount: created.length,
      skippedCount: extractionResult.itemCount - created.length,
      created,
      warnings,
      success: true,
    }

    console.log('[calendar-import-document] Success', result)
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[calendar-import-document] Error', { message })
    return Response.json({ error: message, success: false }, { status: 500 })
  }
}
