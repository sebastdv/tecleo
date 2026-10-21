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
- `bots/`: modelo de bots (`simulateBot`) que precalcula el registro de pulsaciones con la semilla de la carrera. El ritmo tiene ruido log-normal, pausas tras puntuación, ráfagas en palabras cortas, errores que se corrigen y fatiga o sprint. Al final se escala para que el ppm neto sea el objetivo del nivel. `rankRunners` ordena la llegada (también para el servidor).
- `typing/input-events.ts`: traduce `beforeinput`/`compositionend` a acciones. La web solo conecta eventos (`apps/web/src/features/typing/use-typing-input.ts`).

### Web

- Rutas en `src/app/[locale]/…` (`/es`, `/en`); el layout raíz es `app/[locale]/layout.tsx` y lee el idioma con `next/root-params`. `src/proxy.ts` (antes "middleware") redirige las rutas sin idioma. Mensajes en `messages/{es,en}.json` (mismas claves, lo verifica un test).
- Temas: `src/theme/themes.ts` es la única fuente de los tokens; genera las variables CSS (inyectadas en `<head>`) y un test verifica contraste WCAG AA. El tema activo es `data-theme` en `<html>`; un script en `<head>` lo aplica antes del primer pintado.
- Preferencias: `src/settings/settings-store.ts` (Zustand + `localStorage`, esquema `userSettingsSchema` de `@tecleo/shared`). Los stores persistidos usan `skipHydration`, se rehidratan tras montar y guardan con `readFirstStorage()` (`lib/persist-storage.ts`), que no escribe hasta haber leído.
- Componentes base: shadcn/ui (Radix) en `src/components/ui` — generados con la CLI, se pueden editar. Layout en `src/components/layout`.
- `features/typing`: área de escritura (textarea oculto + render propio, cursor por `transform` medido en el DOM, re-medido con `ResizeObserver`).
- `features/practice`: store (`practice-store.ts`, opciones persistidas) y generación de textos. `?seed=N` reproduce un texto. Idioma del texto y reglas viven en las preferencias.
- `features/race`: carrera local contra 1–5 bots (`race-store.ts`). La carrera tiene cuenta regresiva de 3 s, es siempre estricta y tiene un límite de tiempo equivalente a 12 ppm. La pista (`track.tsx`) mueve a los bots con `requestAnimationFrame` interpolando su progreso; además hay podio y confeti si ganas. `?seed=N` fija texto y bots.
- `features/results`: panel y gráfica (Recharts con colores de los tokens del tema activo).
- Pantallas que dependen de fases futuras (salas, rankings, perfil) usan `components/upcoming.tsx`: explican qué harán y llevan a la práctica, sin datos simulados. Entrar/registrarse muestran el formulario con el envío deshabilitado y un aviso.
- Atajos: en práctica, Esc reinicia el intento; en carrera, Esc sale. Tab lleva a "Nuevo texto" y Enter lo activa.

## Convenciones

- TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` en todo el monorepo (`tsconfig.base.json`). Sin `any`; si un cast es inevitable, comentario que lo justifique.
- TypeScript 6.0, no 7: typescript-eslint 8.72 solo admite `<6.1`.
- ESM en todas partes. En `server` y `packages`, los imports relativos llevan extensión `.js`.
- Identificadores en inglés; comentarios y docs en español. Todo texto de interfaz va en `messages/*.json` (nunca literal en el JSX).
- Colores solo con tokens (`bg-background`, `text-primary`, `text-pending`, `text-error`…), nunca con la paleta de Tailwind.
- Tests con Vitest junto al código (`*.test.ts` en paquetes y web, `*.spec.ts` en server, `test/*.e2e-spec.ts` para integración HTTP). El motor exige cobertura ≥ 95 % de líneas.
- E2E en `e2e/tests`: localizar por rol y texto accesible; `[data-typing-target]` (solo lectores de pantalla) contiene el texto completo a escribir. `site.spec.ts` pasa axe (WCAG 2.1 AA) por todas las pantallas.
- Validación de entradas siempre con esquemas Zod de `shared`.
- Prettier: comillas simples, `;`, ancho 100. ESLint con reglas type-checked estrictas.
- Commits: Conventional Commits en español, `tipo(scope): descripción`, un solo `-m`.
- Nada de código simulado ni `TODO` sueltos: lo pendiente se anota en la sección de estado.

## Estado de las fases

| Fase                      | Estado       | Notas                                                                                                                                |
| ------------------------- | ------------ | ------------------------------------------------------------------------------------------------------------------------------------ |
| 0 – Base                  | ✅ completa  | Monorepo, tooling, CI, docker-compose, `/health` + indicador "conectando al servidor…"                                               |
| 1 – Motor y práctica solo | ✅ completa  | Motor + 69 tests (97 % cobertura), corpus 160 textos/idioma, práctica tiempo/palabras/texto, resultados con gráfica                  |
| 2 – Diseño                | ✅ completa  | 6 temas con contraste AA verificado, tipografías configurables, i18n es/en, configuración local, todas las pantallas, 34 E2E con axe |
| 3 – Bots locales          | ✅ completa  | Bots en el motor (93 tests del motor; rango de ppm por nivel verificado), pista, cuenta regresiva, podio, 39 E2E                     |
| 4 – Backend y cuentas     | ⏳ siguiente |                                                                                                                                      |
| 5 – Multijugador          | pendiente    |                                                                                                                                      |
| 6 – Contenido extra       | pendiente    |                                                                                                                                      |
| 7 – Pulido y despliegue   | pendiente    |                                                                                                                                      |

### Pendiente explícito

- Teclas muertas con teclado físico: el camino de composición está cubierto con eventos sintéticos (unit + E2E), falta confirmarlo a mano en macOS/Windows con distribución española y latinoamericana.
- "Jugar ahora" lleva a la carrera contra bots hasta que exista el matchmaking (Fase 5).
- Fase 4: cuentas reales (los formularios de entrar/registrarse tienen el envío deshabilitado), sincronizar preferencias con `/me/settings`, guardar resultados del invitado en `localStorage` para migrarlos al registrarse, seed del corpus en la base de datos, job de CI con Postgres.
- La preferencia "distribución del teclado" se guarda pero se usa recién con el mapa de calor (Fase 4).
- Los resultados de las carreras contra bots no se guardan todavía (Fase 4).
