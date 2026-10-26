# Tecleo

Plataforma web de carreras de mecanografía en tiempo real contra personas y bots.
La especificación vive en `docs/spec.md`; el plan aprobado, en `docs/plan.md`; las decisiones tomadas por ambigüedad, en `docs/decisiones.md`.

## Comandos

Requisitos: Node 24 (`.nvmrc`), pnpm 10.30 (fijado en `packageManager`), Docker.

| Qué                                           | Comando                                                                                            |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| Instalar                                      | `pnpm install`                                                                                     |
| Base de datos local                           | `pnpm db:up` / `pnpm db:down` (Postgres 17 en `localhost:5440`, bases `tecleo` y `tecleo_test`)    |
| Desarrollo (web + server + paquetes en watch) | `pnpm dev` → web en http://localhost:3100, server en http://localhost:4100 (Swagger en `/docs`)    |
| Todo lo de CI                                 | `pnpm check` (format:check + lint + typecheck + test) y `pnpm build`                               |
| Solo un workspace                             | `pnpm --filter @tecleo/engine test` (o `lint`, `typecheck`, `build`, `dev`)                        |
| Formatear                                     | `pnpm format`                                                                                      |
| E2E (Playwright)                              | `pnpm e2e` (reutiliza `pnpm dev` si está corriendo; con `CI=1` levanta el build con `next start`)  |
| E2E contra un despliegue                      | `E2E_BASE_URL=https://tecleo-nine.vercel.app pnpm e2e <specs de invitado>` (no levanta nada local) |
| Regenerar corpus y listas de palabras         | `pnpm --filter @tecleo/content build:corpus` (descarga a `packages/content/.cache/`)               |
| Dar o quitar el rol de administrador          | `pnpm --filter @tecleo/server admin:grant <correo> [--revoke]`                                     |
| Todo desde cero en local (un comando)         | `pnpm local` (instala, crea los `.env`, Postgres, migra, carga textos y `pnpm dev`)                |
| Lighthouse del inicio                         | `pnpm lighthouse [url]` con la web en marcha (mediana de 3 corridas, objetivo ≥ 90)                |
| Capturas del README                           | `pnpm --filter @tecleo/e2e screenshots` con web y server en marcha (`docs/images`)                 |

Los puertos 3100/4100/5440 evitan choques con otros proyectos locales (3000 y 5432 suelen estar ocupados).

## Arquitectura

```
apps/web               Next.js 16 (App Router, Cache Components) + Tailwind 4 + TanStack Query
apps/server            NestJS 12 (ESM) + Prisma 7 (Postgres) + Swagger + Socket.IO
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
- `progressTimeline` (en `metrics.ts`): evolución de una prueba grabada con el mismo formato que un bot; mueve fantasmas y repeticiones.
- `bots/`: modelo de bots (`simulateBot`) que precalcula el registro de pulsaciones con la semilla de la carrera. El ritmo tiene ruido log-normal, pausas tras puntuación, ráfagas en palabras cortas, errores que se corrigen y fatiga o sprint. Al final se escala para que el ppm neto sea el objetivo del nivel. `rankRunners` ordena la llegada (también para el servidor).
- `typing/input-events.ts`: traduce `beforeinput`/`compositionend` a acciones. La web solo conecta eventos (`apps/web/src/features/typing/use-typing-input.ts`).

### Server

- Prisma 7: esquema en `apps/server/prisma/schema.prisma`; el cliente se genera en `src/generated/prisma` (ignorado por git; `build`, `lint`, `typecheck` y `test` corren `prisma generate`). Conexión con `@prisma/adapter-pg`. `prisma.config.ts` carga `.env`.
- Auth (`src/auth`): argon2id, access token JWT HS256 de 15 min (en memoria del cliente), refresh token opaco en cookie httpOnly `tecleo_refresh` (Path `/api/auth`, SameSite Lax). Sesiones rotativas por familia: reusar un token rotado revoca la familia.
- Resultados (`src/results`): el cliente envía pulsaciones codificadas; el servidor las juega con `playKeystrokes` del motor, verifica el texto del corpus, regenera los bots desde la semilla, aplica `inspectRun` (antitrampa) y guarda Race + RaceResult (+ bots) + KeyStat en una transacción.
- Errores: siempre `{ statusCode, code, message, fields? }` (`apiErrorSchema`); validación con `ZodValidationPipe` y esquemas de `@tecleo/shared`.
- Rate limiting: global `RATE_LIMIT`/min por IP; registro y login `AUTH_RATE_LIMIT`/min (refresh, el triple). La IP sale de `common/client-ip.ts`: la que reenvía el proxy de la web si trae `PROXY_SECRET`, o la de la conexión.
- Producción: `start:prod` migra, carga el corpus si la base está vacía y arranca. Despliegue en `render.yaml` + `docs/despliegue.md`.
- Progresión (`src/progression`): `previousMarks` (promedio, récord y récord del texto antes de guardar) y `applyProgress` (suma XP, recalcula el nivel y entrega logros nuevos) corren en la transacción de cada resultado, también en las salas en línea. Fórmulas y catálogo en `@tecleo/shared` (`progression.ts`).
- Rankings y desafío diario (`src/leaderboards`, `src/daily`): mejor marca por persona con `DISTINCT ON`. `/leaderboards`, `/texts/:id/leaderboard`, `/daily`. Calificaciones en `/texts/:id/rating`. Panel de textos en `/admin/texts` (`AdminGuard` lee el rol de la base).
- Tiempo real (`src/realtime`): `RoomsService` es autoritativo (salas, matchmaking, cuenta regresiva, progreso, llegada, límite, reconexión). Recibe el reloj, los tiempos, el store y el guardado por inyección; sus tests usan reloj falso. `RealtimeGateway` solo identifica (middleware de handshake), valida con los esquemas de `shared`, limita (token bucket por socket) y emite. `tick()` corre cada 100 ms. Tiempos por entorno: `MATCHMAKING_WAIT_MS`, `COUNTDOWN_MS`, `RECONNECT_GRACE_MS`.
- Tests de integración en `test/*.e2e-spec.ts` contra `tecleo_test` (las migraciones se aplican solas en `globalSetup`). `test/realtime.e2e-spec.ts` usa sockets reales.

### Web

- Rutas en `src/app/[locale]/…` (`/es`, `/en`); el layout raíz es `app/[locale]/layout.tsx` y lee el idioma con `next/root-params`. `src/proxy.ts` (antes "middleware") redirige las rutas sin idioma. `app/api/[...path]/route.ts` reenvía `/api/*` al server (`SERVER_URL`) con la IP del cliente firmada (`PROXY_SECRET`). Mensajes en `messages/{es,en}.json` (mismas claves, lo verifica un test).
- Temas: `src/theme/themes.ts` es la única fuente de los tokens; genera las variables CSS (inyectadas en `<head>`) y un test verifica contraste WCAG AA. El tema activo es `data-theme` en `<html>`; un script en `<head>` lo aplica antes del primer pintado.
- Preferencias: `src/settings/settings-store.ts` (Zustand + `localStorage`, esquema `userSettingsSchema` de `@tecleo/shared`). Los stores persistidos usan `skipHydration`, se rehidratan tras montar y guardan con `readFirstStorage()` (`lib/persist-storage.ts`), que no escribe hasta haber leído.
- Componentes base: shadcn/ui (Radix) en `src/components/ui` — generados con la CLI, se pueden editar. Layout en `src/components/layout`.
- `features/typing`: área de escritura (textarea oculto + render propio, cursor por `transform` medido en el DOM, re-medido con `ResizeObserver`).
- `features/practice`: store (`practice-store.ts`, opciones persistidas) y generación de textos. `?seed=N` reproduce un texto. Idioma del texto y reglas viven en las preferencias.
- `features/race`: carrera local contra 1–5 bots (`race-store.ts`). La carrera tiene cuenta regresiva de 3 s, es siempre estricta y tiene un límite de tiempo equivalente a 12 ppm. La pista (`track.tsx`) mueve a los bots con `requestAnimationFrame` interpolando su progreso; además hay podio y confeti si ganas. `?seed=N` fija texto y bots.
- `features/results`: panel y gráfica (Recharts con colores de los tokens del tema activo).
- Sesión (`src/auth`, `lib/api.ts`): `fetchApi` adjunta el access token y, ante un 401, renueva una vez (refresh compartido entre peticiones) y reintenta. Solo un 401 del refresh cierra la sesión.
- Preferencias con sesión: `settings/settings-sync.tsx` (las de la cuenta mandan al entrar; cada cambio se guarda).
- Resultados: `results/save-result.ts` los envía al servidor con sesión o los guarda como invitado en `localStorage` (máx. 50) para migrarlos al registrarse.
- Perfil (`features/profile`): cifras, evolución, mejores marcas, mapa de calor sobre el teclado (`keyboard-layouts.ts`, es-ES/es-LA/en-US), pares problemáticos e historial paginado.
- Multijugador (`features/room`, `lib/realtime.ts`): un socket compartido que va directo al server (`NEXT_PUBLIC_SOCKET_URL`, por defecto `http://localhost:4100`). Al conectar, sincroniza el reloj (`estimateClock`); `serverToLocal` lleva horas del servidor a `performance.now()`. `room-store.ts` refleja `room:state`, arma la carrera local (estricta) y regenera los bots con la semilla. Envía el progreso con throttling, guarda lo escrito en `sessionStorage` para reconectar y manda la llegada. La pista (`features/race/track.tsx`) es genérica: la usan la carrera local (`local-track.tsx`) y la en línea. Los rivales se interpolan 250 ms por detrás (`snapshots.ts`).
- Rutas de carrera: `/race` (bots, local), `/play` (pública, "Jugar ahora"), `/room` (crear o entrar con código) y `/room/[code]` (lobby, carrera, resultados y revancha). Salir de la pantalla saca de la sala (con 300 ms de gracia por el doble montaje de desarrollo); recargar no.
- Progresión en la web: `features/results/result-insights.tsx` muestra XP, nivel, logros nuevos, comparación con promedio y récords, repetición, ranking del texto y 👍/👎 (`text-rating.tsx`) bajo los resultados de todos los modos. `useSaveResult` devuelve el resumen del servidor.
- `features/solo/solo-run.tsx`: prueba en solitario sobre un texto dado (desafío diario, práctica dirigida y fantasma, con cuenta regresiva y pista). Para otro texto se le cambia la `key`.
- Rutas de la Fase 6: `/leaderboards`, `/texts/[id]` (ranking del texto), `/replay/[resultId]` (`ReplayCursor`), `/ghost/[resultId]`, `/daily`, `/targeted` (puntos débiles de la cuenta o, sin cuenta, de las pruebas locales; `weakSpots`/`targetedWords` en `@tecleo/content`) y `/admin` (solo administradores).
- Atajos: en práctica, Esc reinicia el intento; en carrera, Esc sale. Tab lleva a "Nuevo texto" y Enter lo activa.

## Convenciones

- TypeScript `strict` + `noUncheckedIndexedAccess` + `exactOptionalPropertyTypes` en todo el monorepo (`tsconfig.base.json`). Sin `any`; si un cast es inevitable, comentario que lo justifique.
- TypeScript 6.0, no 7: typescript-eslint 8.72 solo admite `<6.1`.
- ESM en todas partes. En `server` y `packages`, los imports relativos llevan extensión `.js`.
- Identificadores en inglés; comentarios y docs en español. Todo texto de interfaz va en `messages/*.json` (nunca literal en el JSX).
- Colores solo con tokens (`bg-background`, `text-primary`, `text-pending`, `text-error`…), nunca con la paleta de Tailwind.
- Tests con Vitest junto al código (`*.test.ts` en paquetes y web, `*.spec.ts` en server, `test/*.e2e-spec.ts` para integración HTTP). El motor exige cobertura ≥ 95 % de líneas.
- E2E en `e2e/tests`: localizar por rol y texto accesible; `[data-typing-target]` (solo lectores de pantalla) contiene el texto completo a escribir. `site.spec.ts` pasa axe (WCAG 2.1 AA) por todas las pantallas. Necesitan server y Postgres (Playwright levanta ambos; en local reutiliza `pnpm dev`). Con Cache Components, Next conserva ocultas las páginas visitadas: usar `getByRole` o filtrar `visible: true`.
- Validación de entradas siempre con esquemas Zod de `shared`.
- Prettier: comillas simples, `;`, ancho 100. ESLint con reglas type-checked estrictas.
- Commits: Conventional Commits en español, `tipo(scope): descripción`, un solo `-m`.
- Nada de código simulado ni `TODO` sueltos: lo pendiente se anota en la sección de estado.

## Estado de las fases

| Fase                      | Estado      | Notas                                                                                                                                                                     |
| ------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0 – Base                  | ✅ completa | Monorepo, tooling, CI, docker-compose, `/health` + indicador "conectando al servidor…"                                                                                    |
| 1 – Motor y práctica solo | ✅ completa | Motor + 69 tests (97 % cobertura), corpus 160 textos/idioma, práctica tiempo/palabras/texto, resultados con gráfica                                                       |
| 2 – Diseño                | ✅ completa | 6 temas con contraste AA verificado, tipografías configurables, i18n es/en, configuración local, todas las pantallas, 34 E2E con axe                                      |
| 3 – Bots locales          | ✅ completa | Bots en el motor (93 tests del motor; rango de ppm por nivel verificado), pista, cuenta regresiva, podio, 39 E2E                                                          |
| 4 – Backend y cuentas     | ✅ completa | Prisma + auth con refresh rotativo, resultados validados por el motor, perfil con gráficas y mapa de calor, migración de invitado; 26 tests de integración, 46 E2E        |
| 5 – Multijugador          | ✅ completa | Socket.IO autoritativo, salas privadas con revancha, matchmaking con bots, reloj sincronizado, reconexión, antitrampa en vivo; 49 tests del server, 52 E2E                |
| 6 – Contenido extra       | ✅ completa | XP/niveles, 17 logros, avatares desbloqueables, rankings, desafío diario, repeticiones, fantasma, práctica dirigida, 👍/👎 y panel de textos; 56 tests del server, 62 E2E |
| 7 – Pulido y despliegue   | ✅ completa | Demo en https://tecleo-nine.vercel.app (Vercel + Render + Neon); Lighthouse en la demo: 99 rendimiento, 100 accesibilidad; 63 E2E de invitado pasan contra la demo        |

### Pendiente explícito

- Teclas muertas con teclado físico: el camino de composición está cubierto con eventos sintéticos (unit + E2E), falta confirmarlo a mano en macOS/Windows con distribución española y latinoamericana.
- OAuth con Google (opcional en la spec): no implementado; requiere credenciales para probarlo.
- La práctica y las carreras contra bots usan el corpus empaquetado: los textos agregados o desactivados en el panel solo afectan a los modos en línea (salas, desafío diario).
- Despliegue: la web se publica con `vercel deploy --prod` desde la raíz (el proyecto de Vercel no está conectado al repo); el server de Render sí se despliega solo con cada push a `main`.
- Render Free duerme el server a los 15 min sin tráfico: la primera visita después tarda ~1 min en tener salas, cuentas y rankings (práctica y bots funcionan mientras tanto).
- Salas en memoria de un solo proceso: escalar a varias instancias requiere un `RoomStore` compartido (Redis) y el adaptador de Redis de Socket.IO (ver `docs/decisiones.md`).
- Los resultados en línea de invitados no se guardan (ni local ni en el servidor).
