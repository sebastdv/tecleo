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

## Fase 1

### Registro de pulsaciones y borrados

El formato de la spec (`{ t, input, expected, correct }`) se mantiene. Los borrados se registran con `input` igual a `'\b'` (backspace) o `'\u0017'` (borrar palabra), `expected: ''` y `correct: false`, y no cuentan para la precisión. Una composición que produce dos caracteres (´ + n → "´n") genera dos pulsaciones con el mismo `t`.

### Qué es un "carácter correcto"

Es un carácter que coincide con el objetivo en su posición, más 1 por cada separador que sigue a una palabra confirmada sin errores. La sangría del código es automática y no cuenta; un salto de línea cuenta como un carácter.

### Precisión en modo libre

La spec dice que lo no escrito cuenta como error. Por eso los caracteres que faltaban en las palabras confirmadas con espacio se suman a las pulsaciones totales: `correctas / (pulsaciones + no escritos)`.

### Consistencia y pico

- **Consistencia:** se calcula sobre el WPM bruto de cada segundo. El último segundo se descarta si duró menos de 500 ms, porque un fragmento tan corto distorsiona el coeficiente de variación.
- **Pico:** es el mejor WPM neto en una ventana de 5 s; si la prueba duró menos, es el WPM final.
- **WPM en vivo:** muestra 0 durante el primer segundo para evitar picos absurdos.

### Reglas de escritura

- **Estricto:**
  - un espacio con la palabra mal escrita es un carácter erróneo más;
  - el límite de caracteres extra (10) se cuenta desde el primer error.
- **Libre:**
  - un espacio al inicio de una palabra se ignora;
  - backspace o borrar palabra al inicio de una palabra vuelve a la anterior solo si quedó con errores.
- **Ignorar tildes:** también iguala ñ con n, porque en español se llama "tilde" a ambas marcas.
- **Modo por defecto:** la práctica arranca en modo libre; las carreras usarán estricto, como pide la spec.

### Normalización

- Las comillas tipográficas y las « » pasan a `"`.
- Las rayas (— –) pasan a `-` y los puntos suspensivos (…) a `...`.
- Los espacios duros pasan a espacio normal.
- Lo que escribe el usuario pasa por el mismo mapa, así que se aceptan ambas formas.

### Corpus completo desde la Fase 1

El plan preveía un mini-corpus en esta fase. Como la extracción es automática, se generó el corpus completo: 160 fragmentos por idioma, por encima de los 150 de la spec. En la Fase 4 solo falta cargarlo en la base de datos. Los fragmentos se eligen por turnos entre 14 obras por idioma, y se descartan los que tienen:

- diálogos;
- ortografía anterior a 1911;
- inglés dialectal;
- abreviaturas.

### Listas de palabras

Las listas de FrequencyWords (CC BY-SA 4.0) se filtran así:

1. Se conservan solo las palabras que también aparecen en minúsculas en las obras de dominio público. Eso quita nombres propios y jerga de subtítulos.
2. Se quitan los restos de contracciones inglesas.
3. Se quitan las palabras de una lista de bloqueo con insultos y vocabulario violento o sexual.

La atribución está en `packages/content/README.md`.

### Captura de entrada

- **Backspace:** se maneja en `keydown`, porque con el textarea vacío (el contenido se cancela en cada `beforeinput`) algunos navegadores no emiten `beforeinput` al borrar. Ctrl, Alt o Cmd + Backspace borran la palabra.
- **Foco:** el estado se lee del DOM (`document.hasFocus()` y `activeElement`), porque un `focus()` hecho con la ventana sin foco no emite eventos.
- **Tab + Enter:** Tab lleva el foco al botón "Nuevo texto" y Enter lo activa, así el atajo funciona con la navegación nativa del teclado.

### Semilla del texto

`?seed=N` hace reproducible el texto, lo que sirve para compartirlo y para los E2E. Cambiar una opción conserva la semilla; "Nuevo texto" la renueva.

### Cobertura del motor

Umbrales: 95 % de líneas, funciones y sentencias, y 85 % de ramas. Las ramas sin cubrir son los `?? valor` que exige `noUncheckedIndexedAccess`.
