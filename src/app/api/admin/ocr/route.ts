import { extractPdfContent } from '@/lib/ocr/gemini-pdf-ocr'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sectionType = (formData.get('sectionType') as string) || 'faq'

    console.log('[OCR API] Received request', { hasFile: !!file, sectionType })

    if (!file) {
      console.error('[OCR API] No file in formData')
      return Response.json({ error: 'No file provided', success: false }, { status: 400 })
    }

    console.log('[OCR API] Processing file', { name: file.name, size: file.size, type: file.type })

    const result = await extractPdfContent(file, {
      sectionType: sectionType as 'faq' | 'information' | 'calendar',
      maxPages: 3,
    })

    console.log('[OCR API] Result', { success: result.success, error: result.error })
    return Response.json(result)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error'
    console.error('[OCR API] Error', { message })
    return Response.json({ error: message, success: false }, { status: 500 })
  }
}
