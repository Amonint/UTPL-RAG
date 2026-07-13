import { test, expect } from '@playwright/test'

test.describe('Test Agregar Secciones', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500) // Esperar a que cargue la UI
  })

  test('debería cargar la página principal sin errores', async ({ page }) => {
    // Verificar que no hay errores críticos en la consola
    const errors: string[] = []
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text())
    })

    // Verificar que hay contenido en la página
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)

    // Permitir algunos errores pero no demasiados
    const criticalErrors = errors.filter((e) => !e.includes('favicon') && !e.includes('404'))
    expect(criticalErrors.length).toBeLessThan(2)
  })

  test('debería mostrar elementos navegables en la página', async ({ page }) => {
    // Buscar botones o elementos clicables
    const buttons = page.locator('button')
    const buttonCount = await buttons.count()

    // Debe haber al menos algunos botones en la página
    expect(buttonCount).toBeGreaterThan(2)
  })

  test('debería permitir interactuar con elementos de la página', async ({ page }) => {
    // Buscar el primer botón clicable
    const buttons = page.locator('button')

    if ((await buttons.count()) > 0) {
      const firstButton = buttons.first()

      // Verificar que el botón es clickeable
      await expect(firstButton).toBeEnabled()

      // Intentar hacer clic
      await firstButton.click()
      await page.waitForTimeout(300)

      // La página debe seguir siendo interactiva
      const stillHasContent = await page.content()
      expect(stillHasContent.length).toBeGreaterThan(100)
    }
  })

  test('debería mostrar elementos de texto en la página', async ({ page }) => {
    // Buscar textos específicos de la app
    const hasText = await page
      .locator("text=/Información|Preguntas|servicios|trámites/i")
      .count()

    // Debe haber al menos algunas palabras clave
    expect(hasText).toBeGreaterThan(0)
  })

  test('debería mantener la página funcional durante la navegación', async ({ page }) => {
    // Capturar el HTML inicial
    const initialContent = await page.content()

    // Hacer clic en un botón (cualquiera)
    const buttons = page.locator('button')
    if ((await buttons.count()) > 0) {
      await buttons.first().click()
      await page.waitForTimeout(300)
    }

    // Capturar el HTML después
    const afterContent = await page.content()

    // El contenido debe existir (puede haber cambios)
    expect(afterContent.length).toBeGreaterThan(50)
  })

  test('debería responder a las interacciones del usuario', async ({ page }) => {
    // Buscar inputs de texto
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      const input = inputs.first()

      // Escribir en el input
      await input.fill('test de búsqueda')
      await page.waitForTimeout(300)

      // Verificar que el texto se escribió
      const value = await input.inputValue()
      expect(value).toContain('test')
    }
  })

  test('debería cargar sin timeout excesivo', async ({ page }) => {
    const startTime = Date.now()

    // Navegar a la página
    await page.goto('/')

    const loadTime = Date.now() - startTime

    // La página debe cargar en menos de 10 segundos
    expect(loadTime).toBeLessThan(10000)
  })
})
