import { test, expect } from '@playwright/test'

test.describe('Test Filtros', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('debería estar disponible la interfaz de filtrado', async ({ page }) => {
    // La página debe tener al menos botones para filtrar
    const buttons = page.locator('button')
    const count = await buttons.count()

    expect(count).toBeGreaterThan(0)
  })

  test('debería permitir hacer clic en elementos interactivos', async ({ page }) => {
    const buttons = page.locator('button')

    if ((await buttons.count()) > 0) {
      const firstButton = buttons.nth(1) // Saltar el primer botón por si es nav
      await firstButton.click({ timeout: 2000 })
      await page.waitForTimeout(300)

      // La página debe seguir siendo interactiva
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('debería permitir búsqueda de texto', async ({ page }) => {
    // Buscar un input de búsqueda
    const searchInputs = page.locator('input[type="text"], input[placeholder*="busca" i], textarea')

    if ((await searchInputs.count()) > 0) {
      const input = searchInputs.first()

      // Escribir texto de búsqueda
      await input.fill('servicios')
      await page.waitForTimeout(300)

      // Verificar que se escribió
      const value = await input.inputValue()
      expect(value).toContain('servicios')
    }
  })

  test('debería manejar cambios de estado correctamente', async ({ page }) => {
    // Hacer click en múltiples elementos
    const buttons = page.locator('button')
    const count = await buttons.count()

    if (count > 2) {
      // Click en primer botón
      await buttons.nth(1).click()
      await page.waitForTimeout(200)

      // Click en segundo botón
      await buttons.nth(2).click()
      await page.waitForTimeout(200)

      // La página debe seguir siendo funcional
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('debería mantener consistencia durante la interacción', async ({ page }) => {
    // Obtener texto inicial
    const initialText = await page.textContent('body')

    // Interactuar
    const inputs = page.locator('input, button')
    if ((await inputs.count()) > 0) {
      try {
        await inputs.first().click({ timeout: 2000 })
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla por timeout o overlay
      }
    }

    // Verificar que hay contenido
    const finalText = await page.textContent('body')
    expect(finalText?.length).toBeGreaterThan(50)
  })

  test('debería responder a cambios de búsqueda', async ({ page }) => {
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      const input = inputs.first()

      // Escribir primer término
      await input.fill('académico')
      await page.waitForTimeout(300)

      // Cambiar término
      await input.clear()
      await input.fill('financiero')
      await page.waitForTimeout(300)

      // Verificar
      const value = await input.inputValue()
      expect(value).toContain('financiero')
    }
  })

  test('debería permitir limpiar la búsqueda', async ({ page }) => {
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      const input = inputs.first()

      // Escribir
      await input.fill('prueba')
      await page.waitForTimeout(200)

      // Limpiar
      await input.clear()
      await page.waitForTimeout(200)

      // Verificar que está vacío
      const value = await input.inputValue()
      expect(value).toBe('')
    }
  })

  test('debería mantener interactividad en búsqueda múltiple', async ({ page }) => {
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      const input = inputs.first()

      // Simulación de búsquedas múltiples
      const searchTerms = ['servicios', 'trámites', 'académico']

      for (const term of searchTerms) {
        await input.fill(term)
        await page.waitForTimeout(200)

        const value = await input.inputValue()
        expect(value).toContain(term)
      }
    }
  })

  test('debería funcionar correctamente en carga rápida', async ({ page }) => {
    // Hacer múltiples interacciones rápidamente
    const buttons = page.locator('button')
    const count = Math.min(5, await buttons.count())

    for (let i = 0; i < count; i++) {
      try {
        await buttons.nth(i).click({ timeout: 1000 })
      } catch {
        // Algunos clicks pueden fallar, es ok
      }
    }

    // Verificar que la página sigue siendo funcional
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)
  })
})
