import { afterEach } from 'vitest'

afterEach(() => {
  delete process.env.GEMINI_API_KEY
})
