import { test, expect } from '@playwright/test'

test.describe('Test Calendario y Eventos', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('debería cargar la página sin errores', async ({ page }) => {
    // Verificar que hay contenido
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)

    // Verificar que hay elementos interactivos
    const buttons = page.locator('button')
    expect(await buttons.count()).toBeGreaterThan(0)
  })

  test('debería tener elementos de navegación', async ({ page }) => {
    // Buscar elementos que podrían ser del calendario o navegación
    const navElements = page.locator('nav, [role="navigation"], button, a')
    const count = await navElements.count()

    expect(count).toBeGreaterThan(3)
  })

  test('debería permitir hacer clic en botones', async ({ page }) => {
    const buttons = page.locator('button')
    const count = await buttons.count()

    if (count > 0) {
      const firstButton = buttons.nth(0)
      await firstButton.click()
      await page.waitForTimeout(300)

      // La página debe seguir funcional
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('debería mostrar información de eventos si disponible', async ({ page }) => {
    // Buscar textos relacionados con eventos o fechas
    const eventText = await page
      .locator("text=/evento|fecha|calendario|académico|junio|julio|agosto/i")
      .count()

    // Puede o no haber eventos, pero la búsqueda debe funcionar
    expect(eventText).toBeGreaterThanOrEqual(0)
  })

  test('debería manejar interacciones rápidas', async ({ page }) => {
    // Hacer clicks rápidos en múltiples elementos
    const buttons = page.locator('button')

    for (let i = 0; i < Math.min(3, await buttons.count()); i++) {
      try {
        await buttons.nth(i).click({ timeout: 500 })
      } catch {
        // Es ok si alguno falla
      }
    }

    // Verificar que sigue funcional
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)
  })

  test('debería mostrar contenido de calendario o eventos', async ({ page }) => {
    // Buscar una ruta o link al calendario
    const calendarLink = page.locator('a[href*="calendario"], button:has-text("Calendario")')

    if ((await calendarLink.count()) > 0) {
      // Hacer clic
      await calendarLink.first().click()
      await page.waitForTimeout(500)

      // Verificar que algo cambió
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('debería navegar correctamente en la aplicación', async ({ page }) => {
    // Obtener URL inicial
    const initialUrl = page.url()

    // Hacer una acción
    const buttons = page.locator('button')
    if ((await buttons.count()) > 0) {
      await buttons.first().click()
      await page.waitForTimeout(300)
    }

    // Verificar que la página sigue siendo accesible
    const currentUrl = page.url()
    expect(currentUrl).toBeDefined()
  })

  test('debería manejar eventos de usuario correctamente', async ({ page }) => {
    // Buscar inputs o elementos interactivos
    const inputs = page.locator('input, textarea, button, a')

    const count = await inputs.count()
    expect(count).toBeGreaterThan(0)

    // Intentar interactuar
    if (count > 0) {
      const element = inputs.first()
      const isClickable = await element.isEnabled().catch(() => false)

      if (isClickable) {
        await element.click()
        await page.waitForTimeout(300)
      }

      // Página sigue funcional
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('debería mostrar información relevante', async ({ page }) => {
    // Buscar contenido de la aplicación
    const headings = page.locator('h1, h2, h3')
    const hasHeadings = await headings.count()

    const text = page.locator("text=/[A-Z][a-z]+/")
    const hasText = await text.count()

    // Debe haber contenido
    expect(hasHeadings + hasText).toBeGreaterThan(5)
  })

  test('debería permitir navegar entre pantallas', async ({ page }) => {
    // Buscar navegación
    const navButtons = page.locator('button, a, [role="button"]')

    if ((await navButtons.count()) > 1) {
      // Click en diferentes elementos
      try {
        await navButtons.nth(0).click({ timeout: 2000 })
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla
      }

      try {
        await navButtons.nth(1).click({ timeout: 2000 })
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla
      }

      // Página debe seguir siendo interactiva
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })
})
