import { extractPdfContent } from '@/lib/ocr/gemini-pdf-ocr'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const sectionType = (formData.get('sectionType') as string) || 'information'

    if (!file) {
      return Response.json({ error: 'No file' }, { status: 400 })
    }

    const result = await extractPdfContent(file, { sectionType: sectionType as any })

    if (!result.success) {
      return Response.json({
        error: result.error,
        success: false
      }, { status: 400 })
    }

    // Retorna extracción cruda (sin guardar en DB)
    return Response.json({
      success: true,
      itemCount: result.itemCount,
      modelUsed: result.modelUsed,
      items: result.items.map(item => ({
        title: item.title,
        topic: item.topic,
        question: item.question,
        answer: item.answer,
        startDate: item.startDate,
        endDate: item.endDate,
        eventType: item.eventType,
        description: item.description,
      }))
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return Response.json({ error: msg, success: false }, { status: 500 })
  }
}
