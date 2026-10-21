# Plan aprobado (2026-10-21)

Plan entregado según la sección 0 de `spec.md` y aprobado antes de empezar la Fase 0.

## Stack (versiones verificadas en npm el 2026-10-21)

| Área              | Elección                                                                                                              | Motivo                                                                        |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Runtime           | Node 24 LTS, pnpm 10.30, Turborepo 2.11                                                                               |                                                                               |
| TypeScript        | 6.0.x (no 7.0)                                                                                                        | typescript-eslint 8.72 solo admite TS `<6.1`                                  |
| Web               | Next 16.4 (App Router), React 19, Tailwind 4, shadcn/ui, Motion, Zustand 5, TanStack Query 5, Recharts 3, next-intl 4 |                                                                               |
| Server            | NestJS 12 (ESM) + Socket.IO, Prisma 7.10 (estable; 8 está en RC), PostgreSQL 17, argon2, @nestjs/throttler            |                                                                               |
| Validación        | Zod 4 en `packages/shared`                                                                                            | `nestjs-zod` no soporta Nest 12 → pipe propio + `z.toJSONSchema` para Swagger |
| Tests             | Vitest 5, Playwright 1.64                                                                                             |                                                                               |
| Paquetes internos | tsdown → ESM + `.d.mts`                                                                                               | Nest no consume TS sin compilar                                               |
| Salas             | `RoomStore` en memoria                                                                                                | Sin Redis en v1                                                               |

## Decisiones de arquitectura

1. **Cookies de primera parte**: la web hace de proxy de `/api/*` hacia el server; el socket va directo con el access token en el handshake.
2. **Bots = registros de pulsaciones precalculados** a partir de la semilla de la carrera; cliente y server solo los reproducen. Mismo formato que repeticiones y fantasmas.
3. **Captura de entrada**: la traducción `beforeinput`/composición → acciones del motor es una función pura del motor, testeada; React solo conecta eventos. Normalización NFC y de tipografía.
4. **Render**: componente memoizado por palabra, selector de Zustand por palabra, cursor por `transform`.
5. **Repeticiones**: pulsaciones delta-encoded + gzip en `bytea` (~2 KB por resultado); no se guardan las de bots.
6. **Antitrampa**: re-simulación con el motor + umbrales (WPM > 250 sostenido, varianza mínima de intervalos, progreso monótono). Marcados se guardan pero no rankean.
7. **Reloj**: ping NTP de 5 muestras, el de menor RTT.
8. **Desafío diario**: texto por hash de la fecha, persistido al primer acceso.

## Contenido

- Citas extraídas de obras de dominio público de Project Gutenberg (sin cabeceras ni marca Gutenberg), cortadas en límites de oración en tres longitudes; autor, obra e ID de Gutenberg en cada fragmento; JSON versionado.
- Listas de palabras: FrequencyWords (CC BY-SA 4.0) con atribución y filtro de groserías.
- Fragmentos de código escritos para el proyecto.
- El cliente empaqueta el corpus; las listas se cargan con `import()`.

## Despliegue sin costo (a re-verificar en la Fase 7)

- Web: Vercel Hobby.
- Server: Render free (750 h/mes, 512 MB, WebSockets; se duerme a los 15 min y tarda ~1 min en despertar; 5 GB/mes de ancho de banda).
- DB: Neon Free (0,5 GB, 100 CU-h por proyecto, scale-to-zero a los 5 min).

## Riesgos

1. Versiones muy recientes (Next 16, Nest 12, Tailwind 4, shadcn).
2. Teclas muertas/composición entre navegadores; Playwright no simula composición real.
3. Render free duerme y pierde las salas en memoria.
4. Volumen y licencias del contenido.
5. Falsos positivos del antitrampa con mecanógrafos muy rápidos.
6. E2E multijugador inestable.
7. Docker Desktop con 4 GB en el Mac de desarrollo.

## Orden

Fases 0 → 7 de la spec. Ajuste: la Fase 1 trae un mini-corpus (~20 textos por idioma + listas de palabras); el seed completo va en la Fase 4.
