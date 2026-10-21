# Decisiones

Decisiones tomadas donde la spec es ambigua o donde el ecosistema obligó a desviarse. Las más recientes van al final.

## Fase 0

### TypeScript 6.0 en lugar de 7.0

TypeScript 7.0 (el compilador nativo) ya es `latest` en npm, pero typescript-eslint 8.72 declara `typescript >=4.8.4 <6.1.0` y la plantilla oficial de Nest 12 usa `^6.0.2`. Con 7.0 el lint con tipos se rompe. Se fija `6.0.3` en todos los workspaces; revisar cuando typescript-eslint soporte 7.

### Prisma 7.10 en lugar de 8

La etiqueta `latest` de `prisma` apunta a `8.0.0-rc.24`. Se usará la última estable (7.10.x) en la Fase 4.

### ESLint 9 en lugar de 10

`eslint-config-next` 16.4 depende de plugins (`eslint-plugin-react` 7.37, `eslint-plugin-import` 2.32) que todavía no son estables con ESLint 10; `create-next-app` también genera `^9`. Se usa 9.39 en todo el monorepo.

### Validación Zod sin `nestjs-zod`

`nestjs-zod` 5.5 solo declara compatibilidad con Nest 10/11. Se valida con los esquemas de `@tecleo/shared` y un pipe propio cuando lleguen las primeras entradas (Fase 4); Swagger se alimenta con `z.toJSONSchema(schema, { target: 'openapi-3.0' })`.

### NestJS 12 en ESM, build con `nest build` y tests con Vitest

Nest 12 es solo ESM. Se sigue la plantilla oficial (`module: nodenext`, imports con `.js`, Vitest). Se comprobó que la inyección de dependencias por metadatos de decoradores funciona bajo Vitest 5 sin plugin SWC.

### Paquetes internos compilados con tsdown

Next podría consumir TypeScript directamente, pero Nest no. Para que ambos consuman lo mismo, `engine` y `shared` se compilan a `dist/` (ESM + `.d.mts`); Turbo construye las dependencias antes de `dev`, `lint`, `typecheck` y `test`.

### Puertos de desarrollo 3100 / 4100 / 5440

En la máquina de desarrollo el 3000 y varios Postgres (5432, 5435, 5436) ya están ocupados. Se usan puertos propios, configurables por entorno.

### Proxy `/api/*` desde Next

Web y server se despliegan en dominios distintos (Vercel y Render). Para que la cookie httpOnly del refresh token sea de primera parte, Next reescribe `/api/:path*` hacia `SERVER_URL`. Socket.IO se conecta directo al server.

### `/health` como señal de arranque en frío

La spec pide un estado "conectando al servidor…" mientras el server despierta. Se implementa desde la Fase 0: `GET /health` con contrato en `shared` y un indicador en la web que reintenta con backoff.

### Telemetría de swagger-ui desactivada

`@scarf/scarf` (dependencia de `swagger-ui-dist`) intenta ejecutar un script de telemetría al instalar. Queda en `ignoredBuiltDependencies`.

### Commits sin cuerpo

Conventional Commits en español con un solo `-m`, siguiendo la convención del desarrollador.
