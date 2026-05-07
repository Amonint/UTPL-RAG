# UTPL Tailwind Chat Composer Design

## Goal

Migrar la capa visual del chat efímero actual a una base compatible con Tailwind y `shadcn/ui`, e integrar un composer inspirado en `PromptInputBox` con tema claro y entrada exclusiva de texto.

## Why This Direction

El componente de referencia está pensado para una estructura `shadcn` y clases Tailwind. Integrarlo de forma limpia en el proyecto actual requiere adoptar esa base en vez de intentar traducirlo a CSS global parcial. La meta no es copiar un bloque oscuro tal cual, sino absorber su jerarquía visual y su ergonomía en una implementación compatible con Next.js, SSR y el diseño claro del proyecto.

## Scope

- Añadir Tailwind CSS al proyecto existente.
- Añadir estructura compatible con `shadcn/ui`.
- Crear la carpeta `src/components/ui` para componentes visuales reutilizables.
- Integrar un composer claro inspirado en `PromptInputBox`.
- Mantener el chat efímero actual: sin auth, sin usuarios, sin persistencia, sin `localStorage`.
- Permitir únicamente consultas de texto.

## Non-Goals

- No aceptar imágenes, archivos ni adjuntos.
- No soportar drag/drop ni pegado de imágenes.
- No soportar audio, micrófono ni grabación.
- No activar modos `Search`, `Think` o `Canvas` si no tienen backend real.
- No introducir historial persistente.
- No reescribir la lógica del backend RAG.

## Project Structure Requirements

El proyecto debe quedar alineado con convenciones `shadcn/ui`:

- `src/components/ui/*` para primitivas y componentes de interfaz reutilizables.
- `src/lib/utils.ts` para utilidades como `cn`.
- `components.json` con aliases consistentes.

Es importante crear `src/components/ui` porque:

- la convención de `shadcn/ui` y sus imports locales asumen esa ubicación;
- simplifica la reutilización de componentes sin mezclar UI base con componentes de negocio;
- evita que el composer quede enterrado dentro de carpetas de feature y difícil de extraer o extender.

## Visual Design

- La página sigue siendo clara.
- El chat conserva el tono editorial actual.
- El composer inferior toma del componente de referencia:
  - forma redondeada,
  - proporción amplia,
  - textarea autosize,
  - botón circular de envío,
  - microanimaciones de foco, hover y envío.
- El componente se adapta a una paleta clara:
  - superficie clara,
  - borde fino,
  - contraste alto en el botón enviar,
  - sin secciones oscuras dominantes.

## Composer Behavior

- Solo permite texto.
- `Enter` envía.
- `Shift+Enter` inserta salto de línea.
- El textarea crece automáticamente hasta un alto razonable.
- Durante el envío:
  - el composer muestra estado de carga,
  - no duplica submits accidentales.
- Al completarse la consulta:
  - se agrega el turno del usuario,
  - se agrega un turno temporal del asistente,
  - luego se reemplaza por la respuesta final.

## Chat Behavior

- La conversación vive exclusivamente en estado React del cliente.
- Al refrescar o cerrar la pestaña, todo desaparece.
- Si la respuesta es ambigua, el asistente responde dentro del hilo con candidatos.
- Si hay error, el asistente responde dentro del hilo con un mensaje de fallo.
- Las fuentes recuperadas permanecen plegables dentro de cada respuesta del asistente.

## Technical Design

### Tailwind and shadcn Base

- Instalar Tailwind CSS en el proyecto actual.
- Inicializar configuración compatible con `shadcn/ui`.
- Mantener TypeScript y App Router.

### Component Integration

- Crear `src/components/ui/ai-prompt-box.tsx`.
- No copiar literalmente la versión original que:
  - inyecta estilos con `document.createElement(...)` al importar,
  - usa features fuera de alcance,
  - mezcla comportamiento no apto para SSR.
- Adaptar el componente para:
  - SSR seguro,
  - tema claro,
  - solo texto,
  - integración con el chat actual.

### State and Interfaces

- El chat seguirá orquestado desde `src/components/rag-workbench.tsx`.
- `ai-prompt-box` recibirá:
  - `value`,
  - `onValueChange`,
  - `onSubmit`,
  - `isLoading`,
  - `placeholder`.
- La construcción de turns del asistente seguirá en `src/lib/chat/create-assistant-turn.ts`.

## Dependency Plan

Dependencias de la referencia que sí aplican:

- `lucide-react`
- `framer-motion`
- `@radix-ui/react-tooltip`

Dependencias de la referencia que se pueden omitir si el componente final no las necesita:

- `@radix-ui/react-dialog`

La versión final debe instalar solo lo realmente usado.

## Risks and Mitigations

### Risk: Hydration mismatch

La referencia original usa patrones inseguros para SSR. Se mitiga evitando:

- acceso a `document` durante import,
- valores aleatorios en render,
- mutaciones de DOM fuera del ciclo React.

### Risk: Styling split-brain

Mezclar demasiado CSS global viejo con Tailwind nuevo puede dejar una base inconsistente. Se mitiga moviendo el nuevo composer y sus wrappers a clases Tailwind, y dejando el CSS global solo para tokens/base.

### Risk: Fake features

El componente original sugiere adjuntos, voz y modos extra. Se mitiga eliminando esos controles del diseño final.

## Testing

- Ajustar tests de shell para reflejar el chat con composer nuevo.
- Añadir pruebas mínimas de comportamiento del composer si cambia su contrato.
- Verificar:
  - `npm test`
  - `npm run lint`
  - `npm run build`

## Acceptance Criteria

- El proyecto usa Tailwind y estructura compatible con `shadcn/ui`.
- Existe `src/components/ui/ai-prompt-box.tsx`.
- El composer del chat usa esa pieza nueva.
- El usuario solo puede escribir texto.
- No aparecen controles de imagen, adjunto, voz ni modos falsos.
- El chat sigue siendo efímero y se pierde al refrescar.
- La app compila, pasa lint y pasa tests.
