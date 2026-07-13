# Tests End-to-End (E2E) de UTPL RAG

Este directorio contiene los tests end-to-end de la aplicación usando Playwright.

## Tests Disponibles

### 1. `test-agregar-secciones.spec.ts`
Tests para validar la navegación de secciones y selección de elementos en el conocimiento base.

**Flujos probados:**
- Carga correcta de la página principal
- Visualización de secciones disponibles
- Cambio entre secciones (pestañas)
- Expansión/contracción de categorías
- Selección de elementos en la taxonomía
- Visualización de detalles en el panel derecho
- Persistencia de sección seleccionada

### 2. `test-filtros.spec.ts`
Tests para validar el sistema de filtros de la base de conocimientos.

**Flujos probados:**
- Visualización de controles de filtro
- Selección de categorías como filtros
- Filtrado de resultados por categoría
- Selección de subcategorías
- Reset/limpieza de filtros
- Indicadores visuales de filtros activos
- Aplicación de múltiples filtros
- Actualización de resultados según filtros

### 3. `test-calendario-evento.spec.ts`
Tests para validar la funcionalidad del calendario académico y eventos.

**Flujos probados:**
- Carga del componente de calendario
- Vista del mes actual
- Navegación entre meses (anterior/siguiente)
- Visualización de eventos en el calendario
- Click en eventos para ver detalles
- Información detallada de eventos
- Cierre de modales de eventos
- Resaltado de fecha actual
- Cambio de vista (día, semana, mes)
- Información de eventos académicos

### 4. `test-flujo-completo.spec.ts`
Tests de flujo completo end-to-end que integran múltiples funcionalidades.

**Flujos probados:**
- Navegación, filtrado, búsqueda y visualización de detalles
- Interacción con calendario durante búsqueda
- Aplicación de múltiples filtros simultáneamente
- Búsqueda con texto y filtros juntos
- Navegación responsive en dispositivos móviles
- Validación de ausencia de errores en consola
- Rendimiento de carga inicial
- Persistencia de estado al navegar

## Cómo Ejecutar los Tests

### Requisitos Previos
1. Tener Node.js instalado (v18+)
2. Tener las dependencias instaladas: `npm install`

### Ejecutar Todos los Tests
```bash
npm run test:e2e
```

### Ejecutar Tests en Modo Watch
```bash
npm run test:e2e:watch
```

### Ejecutar Tests en Modo UI Interactivo
```bash
npm run test:e2e:ui
```

### Ejecutar Tests en Modo Debug
```bash
npm run test:e2e:debug
```

### Ver el Reporte de Tests
```bash
npm run test:e2e:report
```

### Ejecutar un Test Específico
```bash
npx playwright test test-agregar-secciones.spec.ts
```

### Ejecutar un Test Específico en Firefox
```bash
npx playwright test test-filtros.spec.ts --project=firefox
```

### Ejecutar con Headless Mode (sin navegador visible)
```bash
npm run test:e2e
```

### Ejecutar con Navegador Visible
```bash
npx playwright test --headed
```

### Ejecutar con Más Información de Depuración
```bash
npx playwright test --trace on
```

## Estructura de los Tests

Cada archivo de test sigue esta estructura:

```typescript
test.describe('Suite de Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Setup antes de cada test
    await page.goto('/')
    await page.waitForLoadState('networkidle')
  })

  test('descripción del test', async ({ page }) => {
    // Acciones
    // Aserciones
  })
})
```

## Selectors Utilizados

Los tests utilizan selectors accesibles:

- `[role="main"]` - Contenedor principal
- `[role="tab"]` - Pestañas de sección
- `[role="treeitem"]` - Elementos en árbol de taxonomía
- `[role="article"]` - Elementos de artículos/resultados
- `[role="dialog"]` - Modales y diálogos
- `[role="gridcell"]` - Celdas del calendario
- Selectores de clases CSS como fallback

## Manejo de Esperas

Los tests utilizan diferentes estrategias de espera:

- `page.waitForLoadState('networkidle')` - Esperar a que terminen las peticiones de red
- `page.waitForTimeout(300-500)` - Espera fija para animaciones
- `expect(...).toBeVisible()` - Espera implícita con timeout
- `expect(...).toHaveAttribute()` - Espera por atributos

## Validaciones Tipicas

### Elemento Visible
```typescript
await expect(element).toBeVisible()
```

### Elemento Clickeable
```typescript
await expect(element).toBeEnabled()
```

### Atributo Presente
```typescript
await expect(element).toHaveAttribute('aria-selected', 'true')
```

### Clase CSS Presente
```typescript
await expect(element).toHaveClass(/active|selected/)
```

### Contador de Elementos
```typescript
expect(await elements.count()).toBeGreaterThan(0)
```

## Captura de Pantallas y Videos

Los tests automáticamente capturan:

- **Screenshots**: Solo cuando hay fallos (`screenshot: 'only-on-failure'`)
- **Videos**: Solo cuando hay fallos (`video: 'retain-on-failure'`)
- **Traces**: Para depuración avanzada (`trace: 'on-first-retry'`)

Estos archivos se guardan en `test-results/`

## Reporte HTML

Después de ejecutar los tests, genera un reporte interactivo:

```bash
npm run test:e2e:report
```

El reporte abre en el navegador y muestra:
- Resumen de tests pasados/fallidos
- Tiempo de ejecución
- Screenshots de fallos
- Videos de fallos
- Traces para depuración

## CI/CD Integration

Para ejecutar en CI/CD (GitHub Actions, etc.):

```bash
npm run test:e2e
```

En CI:
- Se ejecuta con 1 worker (no paralelo)
- Se reintentan tests fallidos 2 veces
- Se capturan screenshots y videos de fallos
- Se genera reporte HTML

## Troubleshooting

### Test Timeout
Si un test se congela, aumenta el timeout:
```bash
npx playwright test --timeout=60000
```

### Elemento No Encontrado
- Verificar que el selector es correcto
- Verificar que el elemento es visible en el navegador
- Usar `--headed` para ver el navegador en vivo
- Usar `--debug` para pausar en breakpoints

### Test Flaky (Intermitente)
- Aumentar las esperas (timeouts)
- Usar selectors más robustos (data-testid)
- Evitar hardcoded delays, usar esperas implícitas

### Modo Debug Interactivo
```bash
npm run test:e2e:debug
```

Esto abre Playwright Inspector donde puedes:
- Pausar en breakpoints
- Ejecutar acciones paso a paso
- Inspeccionar el DOM
- Ejecutar JavaScript en la consola

## Próximos Pasos

Para mejorar los tests:

1. **Agregar data-testid**: Marcar elementos con `data-testid` en componentes
2. **Page Object Model**: Crear classes para encapsular selectores comunes
3. **Fixtures Compartidos**: Crear datos de prueba reutilizables
4. **Tests Visuales**: Agregar visual regression tests
5. **Performance**: Agregar validaciones de rendimiento y Web Vitals
6. **Mobile**: Mejorar tests para diferentes dispositivos
7. **Accesibilidad**: Agregar tests de accesibilidad (a11y)

## Documentación Oficial

- [Playwright Docs](https://playwright.dev)
- [Playwright Test API](https://playwright.dev/docs/api/class-test)
- [Locators](https://playwright.dev/docs/locators)
- [Assertions](https://playwright.dev/docs/test-assertions)
- [Configuration](https://playwright.dev/docs/test-configuration)
