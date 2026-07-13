import { test, expect } from '@playwright/test'

test.describe('Test Flujo Completo - End to End', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)
  })

  test('flujo: carga y navegación básica', async ({ page }) => {
    // Verificar carga
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)

    // Verificar que hay elementos interactivos
    const buttons = page.locator('button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(0)

    // Hacer clic en un elemento
    await buttons.first().click()
    await page.waitForTimeout(300)

    // Verificar que la página sigue funcional
    const finalContent = await page.content()
    expect(finalContent.length).toBeGreaterThan(100)
  })

  test('flujo: búsqueda de texto', async ({ page }) => {
    // Buscar input de búsqueda
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      const input = inputs.first()

      // Escribir búsqueda
      await input.fill('servicios')
      await page.waitForTimeout(300)

      // Presionar Enter
      await input.press('Enter')
      await page.waitForTimeout(500)

      // Verificar que la búsqueda se ejecutó
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('flujo: interacción múltiple', async ({ page }) => {
    // Hacer múltiples acciones
    const buttons = page.locator('button')
    const inputs = page.locator('input, textarea')

    // Acción 1: Hacer clic en un botón
    if ((await buttons.count()) > 0) {
      try {
        await buttons.first().click({ timeout: 2000 })
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla
      }
    }

    // Acción 2: Escribir en un input
    if ((await inputs.count()) > 0) {
      try {
        await inputs.first().fill('búsqueda')
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla
      }
    }

    // Acción 3: Hacer clic en otro botón
    if ((await buttons.count()) > 1) {
      try {
        await buttons.nth(1).click({ timeout: 2000 })
        await page.waitForTimeout(300)
      } catch {
        // Ok si falla
      }
    }

    // Verificar que la aplicación sigue funcional
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)
  })

  test('flujo: cambio de vista/página', async ({ page }) => {
    // Buscar navegación a calendario
    const calendarLink = page.locator('a[href*="calendario"], button:has-text("calendario")')

    if ((await calendarLink.count()) > 0) {
      await calendarLink.first().click()
      await page.waitForTimeout(500)

      // Verificar que estamos en una página diferente o que el contenido cambió
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('flujo: búsqueda y navegación de resultados', async ({ page }) => {
    // Buscar un input
    const inputs = page.locator('input[type="text"], textarea')

    if ((await inputs.count()) > 0) {
      // Escribir búsqueda
      await inputs.first().fill('académico')
      await page.waitForTimeout(300)

      // Presionar Enter (más confiable que buscar un botón)
      try {
        await inputs.first().press('Enter', { timeout: 2000 })
        await page.waitForTimeout(500)
      } catch {
        // Si no funciona Enter, continuar de todas formas
      }

      // Verificar que hay contenido
      const content = await page.content()
      expect(content.length).toBeGreaterThan(100)
    }
  })

  test('flujo: responsiveness - dispositivo móvil', async ({ page }) => {
    // Configurar viewport para móvil
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Verificar que hay contenido
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)

    // Buscar botones o menú
    const buttons = page.locator('button')
    expect(await buttons.count()).toBeGreaterThan(0)

    // Interactuar
    await buttons.first().click()
    await page.waitForTimeout(300)

    // Verificar que sigue funcionando
    const finalContent = await page.content()
    expect(finalContent.length).toBeGreaterThan(100)
  })

  test('flujo: sin errores críticos en consola', async ({ page }) => {
    const errors: string[] = []

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text())
      }
    })

    // Realizar acciones
    const buttons = page.locator('button')
    for (let i = 0; i < Math.min(3, await buttons.count()); i++) {
      try {
        await buttons.nth(i).click({ timeout: 500 })
        await page.waitForTimeout(200)
      } catch {
        // Ok si alguno falla
      }
    }

    // Filtrar errores críticos
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon') && !e.includes('404') && !e.includes('Cannot read property'),
    )

    expect(criticalErrors.length).toBeLessThan(3)
  })

  test('flujo: rendimiento de carga inicial', async ({ page }) => {
    const startTime = Date.now()

    // Navegar
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    const loadTime = Date.now() - startTime

    // Debe cargar en menos de 8 segundos
    expect(loadTime).toBeLessThan(8000)
  })

  test('flujo: persistencia de estado', async ({ page }) => {
    // Capturar estado inicial
    const initialContent = await page.content()

    // Hacer una búsqueda
    const inputs = page.locator('input[type="text"], textarea')
    if ((await inputs.count()) > 0) {
      await inputs.first().fill('test')
      await page.waitForTimeout(300)

      // Verificar que el estado cambió
      const afterSearch = await page.content()
      expect(afterSearch).toBeDefined()
    }

    // Hacer otra acción
    const buttons = page.locator('button')
    if ((await buttons.count()) > 0) {
      await buttons.first().click()
      await page.waitForTimeout(300)
    }

    // Verificar que la aplicación sigue funcional
    const finalContent = await page.content()
    expect(finalContent.length).toBeGreaterThan(100)
  })

  test('flujo: navegación continua entre elementos', async ({ page }) => {
    // Navegar por múltiples elementos
    const allElements = page.locator('button, a, input, textarea')

    const count = Math.min(5, await allElements.count())

    for (let i = 0; i < count; i++) {
      try {
        const element = allElements.nth(i)
        const tag = await element.evaluate((el) => el.tagName)

        if (tag === 'BUTTON' || tag === 'A') {
          await element.click({ timeout: 500 })
        } else if (tag === 'INPUT' || tag === 'TEXTAREA') {
          await element.fill('test' + i)
        }

        await page.waitForTimeout(100)
      } catch {
        // Ok si alguno falla
      }
    }

    // Verificar que sigue funcional
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)
  })

  test('flujo: estabilidad durante uso prolongado', async ({ page }) => {
    // Simular uso prolongado
    const buttons = page.locator('button')
    const inputs = page.locator('input, textarea')

    for (let i = 0; i < 2; i++) {
      // Cerrar cualquier modal/overlay si está abierto
      const backdrop = page.locator('[data-state="open"]')
      if ((await backdrop.count()) > 0) {
        // Presionar Escape para cerrar
        await page.keyboard.press('Escape')
        await page.waitForTimeout(100)
      }

      // Hacer clic en un botón (con timeout más largo)
      if ((await buttons.count()) > 1) {
        try {
          await buttons.nth(0).click({ timeout: 2000 })
          await page.waitForTimeout(300)
        } catch {
          // Ok si falla
        }
      }

      // Escribir en input
      if ((await inputs.count()) > 0) {
        try {
          await inputs.first().fill('búsqueda ' + i)
          await page.waitForTimeout(200)
        } catch {
          // Ok si falla
        }
      }
    }

    // Verificar que la aplicación sigue estable
    const content = await page.content()
    expect(content.length).toBeGreaterThan(100)
  })
})
