import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const embedContent = vi.fn()

vi.mock('@google/genai', () => ({
  GoogleGenAI: vi.fn(() => ({
    models: { embedContent },
  })),
}))

describe('embedSearchText', () => {
  const originalKey = process.env.GEMINI_API_KEY

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-key'
    embedContent.mockReset()
  })

  afterEach(() => {
    if (originalKey === undefined) delete process.env.GEMINI_API_KEY
    else process.env.GEMINI_API_KEY = originalKey
    vi.resetModules()
  })

  it('returns null when embedContent fails with API error', async () => {
    embedContent.mockRejectedValue(
      new Error('models/text-embedding-004 is not found for API version v1beta'),
    )

    const { embedSearchText } = await import('@/lib/search/embeddings/gemini-embeddings')
    const result = await embedSearchText('matrícula UTPL')

    expect(result).toBeNull()
    expect(embedContent).toHaveBeenCalledTimes(1)
  })

  it('returns embedding vector on success', async () => {
    const vector = Array.from({ length: 768 }, (_, i) => i / 768)
    embedContent.mockResolvedValue({ embeddings: [{ values: vector }] })

    const { embedSearchText } = await import('@/lib/search/embeddings/gemini-embeddings')
    const result = await embedSearchText('certificados')

    expect(result).toHaveLength(768)
  })
})
