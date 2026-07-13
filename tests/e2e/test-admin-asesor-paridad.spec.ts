import { test, expect } from '@playwright/test'

test.describe('Paridad admin → asesor', () => {
  test('ítem publicado vía API aparece en búsqueda del asesor', async ({ request, page }) => {
    test.skip(!process.env.DATABASE_URL, 'Requiere DATABASE_URL')

    const taxonomyRes = await request.get('/api/admin/taxonomy')
    expect(taxonomyRes.ok()).toBeTruthy()
    const taxonomy = (await taxonomyRes.json()) as {
      tree?: Array<{
        id: string
        categories: Array<{
          subcategories: Array<{ elements: Array<{ id: string }> }>
        }>
      }>
    }

    const domain = taxonomy.tree?.find((d) => d.categories.length > 0)
    const element = domain?.categories[0]?.subcategories[0]?.elements[0]
    if (!domain || !element) {
      test.skip(true, 'Sin taxonomía disponible')
      return
    }

    const token = `E2E_PARIDAD_${Date.now()}`
    const createRes = await request.post('/api/admin/items', {
      data: {
        kbElementId: element.id,
        domainId: domain.id,
        sectionCode: 'faq',
        contentType: 'faq',
        title: `E2E paridad ${token}`,
        questionText: `¿Pregunta ${token}?`,
        answerText: `TOKEN_E2E_${token} respuesta de prueba con texto suficiente.`,
        editorialStatus: 'published',
      },
    })
    expect(createRes.status()).toBe(201)
    const created = (await createRes.json()) as { id: string }

    try {
      await page.goto('/')
      await page.waitForLoadState('networkidle')

      const searchInput = page.getByPlaceholder(/trámite|servicio/i).first()
      await searchInput.fill(`TOKEN_E2E_${token}`)
      await searchInput.press('Enter')
      await page.waitForTimeout(1500)

      await expect(page.getByText(new RegExp(token, 'i')).first()).toBeVisible({ timeout: 10000 })
    } finally {
      await request.delete(`/api/admin/items/${created.id}`)
    }
  })
})
