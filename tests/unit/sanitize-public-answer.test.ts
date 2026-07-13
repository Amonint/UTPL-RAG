import { describe, expect, it } from 'vitest'

import { sanitizePublicAnswerText } from '@/lib/kb/sanitize-public-answer'

describe('sanitizePublicAnswerText', () => {
  it('removes leaked backend metadata blocks', () => {
    const raw = [
      'Puedes pagar por banca en linea, tarjeta de credito o ventanilla bancaria aliada.',
      '',
      'Section Code',
      '',
      'general_info',
      '',
      'Domain Code',
      '',
      'financial',
      '',
      'Domain Name',
      '',
      'Financiero',
      '',
      'Service Category Code',
      '',
      'servicios-financieros',
      '',
      'Modality',
      '',
      'en_linea',
      '',
      'Applies To All',
      '',
      'false',
    ].join('\n')

    expect(sanitizePublicAnswerText(raw)).toBe(
      'Puedes pagar por banca en linea, tarjeta de credito o ventanilla bancaria aliada.',
    )
  })

  it('keeps regular text untouched', () => {
    const raw = 'Debes pagar en linea y conservar tu comprobante.'
    expect(sanitizePublicAnswerText(raw)).toBe(raw)
  })
})
