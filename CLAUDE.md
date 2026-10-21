# Tecleo

Plataforma web de carreras de mecanografía en tiempo real contra personas y bots.
La especificación vive en `docs/spec.md`; el plan aprobado, en `docs/plan.md`; las decisiones tomadas por ambigüedad, en `docs/decisiones.md`.

## Comandos

Requisitos: Node 24 (`.nvmrc`), pnpm 10.30 (fijado en `packageManager`), Docker.

| Qué                                           | Comando                                                                                           |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| Instalar                                      | `pnpm install`                                                                                    |
| Base de datos local                           | `pnpm db:up` / `pnpm db:down` (Postgres 17 en `localhost:5440`, bases `tecleo` y `tecleo_test`)   |
| Desarrollo (web + server + paquetes en watch) | `pnpm dev` → web en http://localhost:3100, server en http://localhost:4100 (Swagger en `/docs`)   |
| Todo lo de CI                                 | `pnpm check` (format:check + lint + typecheck + test) y `pnpm build`                              |
| Solo un workspace                             | `pnpm --filter @tecleo/engine test` (o `lint`, `typecheck`, `build`, `dev`)                       |
| Formatear                                     | `pnpm format`                                                                                     |
| E2E (Playwright)                              | `pnpm e2e` (reutiliza `pnpm dev` si está corriendo; con `CI=1` levanta el build con `next start`) |
| Regenerar corpus y listas de palabras         | `pnpm --filter @tecleo/content build:corpus` (descarga a `packages/content/.cache/`)              |

Los puertos 3100/4100/5440 evitan choques con otros proyectos locales (3000 y 5432 suelen estar ocupados).

## Arquitectura

```
apps/web               Next.js 16 (App Router, Cache Components) + Tailwind 4 + TanStack Query
apps/server            NestJS 12 (ESM) + Swagger; Socket.IO y Prisma llegan en las fases 4-5
packages/engine        @tecleo/engine — motor de escritura, métricas, bots. TS puro: sin DOM ni Node
packages/shared        @tecleo/shared — esquemas Zod, contratos de eventos y DTOs
packages/content       @tecleo/content — corpus de dominio público, listas de palabras, código, generadores
packages/eslint-config @tecleo/eslint-config — flat config compartida (typescript-eslint strict type-checked)
e2e                    @tecleo/e2e — Playwright
```

### Motor (`packages/engine`)

- `typing/state.ts`: máquina de estados pura (`idle → countdown → running → finished`). `applyInput(state, action, timestamp)` devuelve un estado nuevo; solo se reemplaza el objeto de la palabra activa (la web memoiza por palabra).
- El texto se separa en palabras; el separador (`' '`, o `'\n'` + sangría en código) va pegado a la palabra anterior. Solo se teclea el primer carácter del separador.
- Registro de pulsaciones `{ t, input, expected, correct }`; los borrados usan `'\b'` (backspace) y `'\u0017'` (borrar palabra). Con `t` e `input` basta para reproducir (`replayKeystrokes`).
- `metrics/metrics.ts`: `liveMetrics` para la UI y `analyze` para el resultado final (reproduce el registro para la línea de tiempo por segundo, teclas y bigramas).
- `typing/input-events.ts`: traduce `beforeinput`/`compositionend` a acciones. La web solo conecta eventos (`apps/web/src/features/typing/use-typing-input.ts`).

### Web

- `features/typing`: área de escritura (textarea oculto + render propio, ventana de 3 líneas, cursor por `transform` medido en `useLayoutEffect`).
- `features/practice`: store Zustand (`practice-store.ts`) y generación de textos (`practice-config.ts`). `?seed=N` reproduce un texto; la semilla se conserva al cambiar opciones.
- `features/results`: panel y gráfica (Recharts).

- `engine` es la **única fuente de verdad** de la lógica de escritura y métricas; lo usan web y server. Debe ser determinista (RNG con semilla en `engine/src/rng`).
- `shared` define los contratos: el server responde tipos de `shared` y la web valida con los mismos esquemas (`apps/web/src/lib/api.ts`). Swagger se genera desde Zod (`apps/server/src/common/zod-openapi.ts`).
- Los paquetes se compilan con tsdown a ESM (`dist/index.mjs` + `.d.mts`). Turbo compila las dependencias antes de `dev`, `lint`, `typecheck` y `test`.
- La web llama a la API por el proxy `/api/*` de Next (rewrite a `SERVER_URL`) para que las cookies sean de primera parte.
- El estado de las salas irá detrás de la interfaz `RoomStore` (en memoria; Redis más adelante).

## Convenciones

- TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` en todo el monorepo (`tsconfig.base.json`). Sin `any`; si un cast es inevitable, comentario que lo justifique.
- TypeScript 6.0, no 7: typescript-eslint 8.72 solo admite `<6.1`.
- ESM en todas partes. En `server` y `packages`, los imports relativos llevan extensión `.js`.
- Identificadores en inglés; comentarios, docs y textos de UI en español (la UI pasará por next-intl en la Fase 2).
- Tests con Vitest junto al código (`*.test.ts` en paquetes y web, `*.spec.ts` en server, `test/*.e2e-spec.ts` para integración HTTP). El motor exige cobertura ≥ 95 % de líneas.
- E2E en `e2e/tests`: localizar por rol y texto accesible; `#typing-target` (solo lectores de pantalla) contiene el texto completo a escribir.
- Validación de entradas siempre con esquemas Zod de `shared`.
- Prettier: comillas simples, `;`, ancho 100. ESLint con reglas type-checked estrictas.
- Commits: Conventional Commits en español, `tipo(scope): descripción`, un solo `-m`.
- Nada de código simulado ni `TODO` sueltos: lo pendiente se anota en la sección de estado.

## Estado de las fases

| Fase                      | Estado       | Notas                                                                                                                      |
| ------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 0 – Base                  | ✅ completa  | Monorepo, tooling, CI, docker-compose, `/health` + indicador "conectando al servidor…"                                     |
| 1 – Motor y práctica solo | ✅ completa  | Motor + 68 tests (97 % cobertura), corpus 160 textos/idioma, práctica tiempo/palabras/texto, resultados con gráfica, 8 E2E |
| 2 – Diseño                | ⏳ siguiente |                                                                                                                            |
| 3 – Bots locales          | pendiente    |                                                                                                                            |
| 4 – Backend y cuentas     | pendiente    |                                                                                                                            |
| 5 – Multijugador          | pendiente    |                                                                                                                            |
| 6 – Contenido extra       | pendiente    |                                                                                                                            |
| 7 – Pulido y despliegue   | pendiente    |                                                                                                                            |

### Pendiente explícito

- Teclas muertas con teclado físico: el camino de composición está cubierto con eventos sintéticos (unit + E2E), falta confirmarlo a mano en macOS/Windows con distribución española y latinoamericana.
- Fase 2: configuración persistente (tema, fuente, estilo de cursor, mostrar/ocultar WPM, sonidos, modo concentración), i18n es/en, aviso en móvil, navegación entre pantallas. Hoy la práctica usa valores por defecto en memoria.
- Fase 4: guardar resultados del invitado en `localStorage` para migrarlos al registrarse; seed del corpus en la base de datos.
- La base de datos no se usa todavía (Prisma entra en la Fase 4); el job de CI con servicio Postgres se agrega entonces.
