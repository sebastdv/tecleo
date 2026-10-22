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

## Fase 2

### Dirección visual: "tipos móviles"

Los textos son literatura de imprenta, así que la identidad sale de la imprenta y la máquina de escribir:

- **Colores:** fondo de tinta azul (`#161a2b`), texto de papel (`#ece6d8`) y acento de latón (`#d9a441`), como los tipos metálicos. El rojo, como la cinta bicolor de la máquina de escribir, se reserva para los errores.
- **Inicio:** el logo se compone letra a letra como tipos en una línea. Es la única animación automática.
- **Carreras (Fase 3):** cada corredor será un tipo con su inicial.

Se evitó a propósito el combo genérico de fondo casi negro con un acento chillón y cifras en monoespaciada. Las cifras van en la sans con números tabulares; la monoespaciada queda solo para el texto de juego.

### Tipografías

- **Interfaz:** Schibsted Grotesk.
- **Texto de juego:** JetBrains Mono por defecto, con IBM Plex Mono, Fira Code o Geist Mono a elección. Solo la tipografía por defecto se precarga.
- **Tamaños:** cuatro (20, 26, 32 y 40 px).

### Seis temas con contraste verificado

Los temas son Tinta (por defecto), Día, Grafito, Bosque, Ciruela y Alto contraste. `themes.test.ts` exige:

- 7:1 para el texto principal;
- 4.5:1 para el texto secundario, el pendiente, los errores y el acento como texto;
- 4.5:1 para el texto sobre los botones.

Además, axe revisa el contraste real de la práctica en los seis temas.

### Rutas con prefijo de idioma siempre

Las rutas son `/es/...` y `/en/...`, con `localePrefix: 'always'`. Cada idioma se prerenderiza estático y la URL indica el idioma. La raíz redirige según la cookie o `Accept-Language`. El idioma de la interfaz es el de la URL, y la preferencia guardada lo sigue.

### Cambio de idioma con navegación completa

Navegar con el router a otro idioma re-renderiza el layout raíz en el cliente, y React avisa por el `<script>` del tema en `<head>`. Ese script es necesario para que no haya destello: `next/script` con `beforeInteractive` lo ejecuta después de leer el HTML. Como cambiar de idioma es poco frecuente, se hace con una navegación completa.

### Preferencias del invitado

Todas las preferencias de la spec (sección 10) están en `userSettingsSchema` (`@tecleo/shared`), con un valor por defecto por campo y `.catch()`. Un JSON viejo, parcial o manipulado se corrige campo por campo en lugar de fallar. Se guardan en `localStorage`; en la Fase 4 se sincronizarán con el servidor usando el mismo esquema.

El idioma del texto, las reglas e "ignorar tildes" son preferencias generales. La barra de la práctica las edita directamente, así no hay dos fuentes de verdad.

### Pantallas de fases futuras

La spec pide que todas las pantallas existan en esta fase, pero también prohíbe funciones simuladas. Carreras, salas, rankings y perfil explican qué harán y llevan a la práctica. Entrar y registrarse muestran el formulario real con el envío deshabilitado y un aviso explícito. Nada finge datos ni respuestas.

### "Jugar ahora"

Lleva a la práctica hasta que existan las carreras.

### Modo concentración y atajos

- **Modo concentración:** mientras se escribe, todo lo marcado con `data-chrome` (cabecera, pie, opciones y estadísticas) se desvanece.
- **Esc:** abandona el intento y reinicia el mismo texto.
- **Tab + Enter:** usa el orden de foco nativo.
- **Pantallas táctiles:** las pistas de teclado se ocultan.

### Sonidos sintetizados

Hay tres estilos (clic, suave y máquina de escribir), generados con Web Audio sin archivos de audio. Distinguen acierto, espacio y error. Vienen desactivados por defecto.

### Último segundo corto en las métricas

Encontrado al revisar la gráfica: si la prueba dura, por ejemplo, 2,05 s, el tramo final de 50 ms daba un WPM bruto de miles. Ahora un último tramo de menos de 500 ms se une al segundo anterior, y la línea de tiempo, la consistencia y el pico salen de los mismos tramos.

## Fase 3

### Bots que se calibran solos

El bot planifica sus pulsaciones en unidades relativas, con todos los rasgos de la spec:

- retardo log-normal con una dispersión por nivel;
- pausas ×2,5 después de la puntuación;
- ráfagas (×0,8) en palabras de hasta 4 letras;
- más tiempo en mayúsculas, tildes y símbolos;
- errores en teclas vecinas u olvidos de la tilde, que corrige: sigue unas letras sin notarlos, reacciona, borra y reescribe;
- fatiga (hasta +15 %) o sprint final (−15 % en el último 20 %).

Al final se escala todo para que el ppm neto coincida con el objetivo, muestreado de una normal dentro del rango del nivel. Así el criterio de la Fase 3 (el ppm final cae en el rango) se cumple siempre, y el ritmo sigue siendo irregular: la variación entre teclas supera el 25 %.

### Bots como registros de pulsaciones

Cada bot se ejecuta con `applyInput` del motor. Su resultado es un registro idéntico al de una persona: se reproduce, se analiza y se valida igual. La semilla de la carrera deriva una semilla por bot, así que cliente y servidor generan exactamente los mismos bots.

### Nombres de bots

Los bots llevan nombres de tipógrafos e impresores históricos (Garamond, Bodoni, Didot, Ibarra…), en línea con la identidad de "tipos móviles". Siempre llevan el ícono y el texto "(bot)" para lectores de pantalla.

### Carrera local

- **Cuenta regresiva:** de 3 s. La de las salas en línea será de 5 s, como pide la spec. Durante la cuenta se ve el texto, pero la entrada se ignora.
- **Reglas:** siempre estrictas; "ignorar tildes" se respeta y queda marcado.
- **Límite de tiempo:** el texto completo a 12 ppm, con un mínimo de un minuto. Quien no llega queda como "No terminó".
- **Posiciones:** se conocen al terminar el jugador, porque las llegadas de los bots están precalculadas. En la pista, un bot que llegó antes que el jugador muestra su puesto definitivo en ese momento.
- **Revancha:** repite el texto y los mismos bots.

### Pista

Los bots se mueven con `requestAnimationFrame` y escriben la variable CSS `--p` sin pasar por React. Su progreso se interpola entre pulsaciones para que se deslicen en lugar de saltar. El jugador avanza con cada pulsación, con una transición de 100 ms.

### Stores persistidos que no pisan lo guardado

Encontrado en los E2E. En desarrollo, React monta, desmonta y vuelve a montar los efectos. La limpieza de la carrera hacía `set()` antes de la rehidratación, y `persist` escribía la configuración por defecto encima de la guardada. `readFirstStorage()` descarta las escrituras hasta la primera lectura, y lo usan los tres stores persistidos.

### La semilla se fija al empezar a cargar

Encontrado por el CI, que es más lento que la máquina local. Si se cambiaba una opción mientras el primer texto todavía cargaba, `configure()` usaba la semilla anterior (0) y el texto de `?seed=` se perdía. Ahora `next()` guarda la semilla en cuanto empieza. `practice-store.test.ts` reproduce la secuencia: falla sin el arreglo y pasa con él.

## Fase 4

### Prisma 7 con el cliente generado en el repo

Prisma 7 genera el cliente TypeScript en `src/generated/prisma` y exige un adaptador (`@prisma/adapter-pg`). Se usa `importFileExtension = "js"` para que funcione con `module: nodenext`. El cliente generado no se versiona: `build`, `lint`, `typecheck` y `test` corren `prisma generate`, que no necesita conexión.

### Refresh tokens opacos y rotativos

- **Access token:** JWT de 15 minutos que vive solo en memoria del cliente, nunca en `localStorage`.
- **Refresh token:** 256 bits aleatorios en una cookie httpOnly. En la base solo se guarda su SHA-256.
- **Rotación:** cada refresh rota el token. Si llega un token ya rotado, alguien lo copió, y se revoca toda la familia.
- **Carreras entre pestañas:** se resuelven con una actualización condicional, de modo que solo una petición rota el token.
- **Login:** compara siempre contra un hash argon2, también si el correo no existe. Así el tiempo de respuesta no delata qué cuentas existen.

### Cookie de primera parte vía `/api`

La cookie usa `Path=/api/auth` y `SameSite=Lax`, y es `Secure` en producción. La web llama a la API por su propio dominio (rewrite de Next), así que la cookie nunca es de terceros.

### El servidor recalcula todo

El cliente envía pulsaciones compactas: diferencias de tiempo y caracteres. El servidor:

1. Verifica que el texto coincida con el del corpus cuando hay `textId`.
2. Juega el registro con el motor respetando reglas y límite de tiempo.
3. Exige que la prueba termine.
4. Calcula las métricas.
5. Aplica el antitrampa.
6. En carreras contra bots, regenera los bots con la semilla y decide las posiciones.

Las pulsaciones se guardan comprimidas con gzip, unos 1–3 KB por resultado. Los bots no las guardan: se regeneran.

### Antitrampa inicial

Un resultado se marca si:

- pasa de 250 ppm netos;
- su mejor ventana de 5 s pasa de 320 ppm;
- la variación entre teclas está por debajo de 0,12 con al menos 30 intervalos.

Un resultado marcado se guarda, no cuenta para rankings y no alimenta las teclas débiles. Los bots, con variación de más de 0,25, nunca se marcan (hay un test que lo verifica).

### Migración del invitado

Los resultados del invitado (los últimos 50) se guardan en `localStorage` con el mismo formato que se envía al servidor. Al registrarse, una casilla marcada por defecto los manda a `/results/import`. El servidor valida cada uno igual que uno nuevo, descarta los inválidos y acota la fecha a los últimos 30 días.

### Preferencias con sesión

Al entrar, las preferencias de la cuenta reemplazan a las locales. Si la cuenta no tiene preferencias, se suben las locales. Después, cada cambio se guarda en el servidor 0,8 s después del último.

### Rate limiting configurable

Los valores por defecto son los de producción: 120 peticiones por minuto en general, 10 en registro y login, y 30 en refresh. En desarrollo y E2E todo sale de localhost y se suben por entorno.

Esto se encontró al repetir los E2E con 5 workers: un 429 en el refresh cerraba la sesión en pantalla. Ahora el cliente solo considera la sesión inválida ante un 401, y reintenta ante límites, caídas o falta de red.

### Mapa de calor por tecla física

Las estadísticas se guardan por carácter esperado. La web las agrupa por tecla según la distribución elegida:

- mayúsculas y tildes van a su tecla base;
- los signos con Shift van a la tecla que los produce en cada distribución.

El tinte se limita al 45 % para que la letra siga leyéndose en todos los temas.

### Formularios que no filtran credenciales

El formulario de acceso usa `method="post"` y deja el botón deshabilitado hasta hidratar. Así un envío nativo, antes de que cargue el JavaScript, nunca pone el correo y la contraseña en la URL.

### Variables de entorno a través de Turbo

Turbo 2 corre las tareas en modo estricto: solo les llegan las variables declaradas. `DATABASE_URL_TEST` no llegaba a los tests del server en CI, que intentaban la base local por defecto y fallaban. En local pasaban, porque esa base existe. Ahora está en `passThroughEnv` de la tarea `test`.

Se comprobó en un clon limpio con una URL inalcanzable: sin el cambio, los tests la ignoraban; con el cambio, fallan como corresponde. Toda variable nueva que necesite una tarea de Turbo tiene que declararse en `turbo.json`.

## Fase 5

### Salas en memoria detrás de una interfaz

Las salas viven en memoria del proceso (`InMemoryRoomStore`), detrás de la clase abstracta `RoomStore`. Con un solo servidor alcanza y no cuesta nada. Para escalar a varias instancias habría que cambiar el store por uno compartido (Redis) y usar el adaptador de Redis de Socket.IO; la lógica de `RoomsService` no cambia.

Una caída del servidor pierde las carreras en curso. Los resultados ya guardados no se pierden: se escriben en Postgres al cerrar cada carrera.

### Identidad en el handshake

El socket se identifica una sola vez, en un middleware, antes de aceptar la conexión:

- con cuenta, con el access token;
- sin cuenta, con un `guestId` (UUID guardado en `localStorage`) y un nombre opcional.

Así, recargar o reconectar devuelve a la misma persona a su sala. Si el token está por vencer, el cliente lo renueva antes de reconectar: con uno vencido el servidor la tomaría por invitada y la sacaría de la carrera.

El socket va directo al server (`NEXT_PUBLIC_SOCKET_URL`), no por el proxy de Next. No necesita cookies.

### El servidor decide, el cliente anima

- La salida, el límite de tiempo, los bots (semilla y niveles) y el orden de llegada los decide el servidor.
- El cliente regenera los bots con el motor a partir de la semilla, igual que en la carrera local. Así no viaja su progreso por la red.
- El progreso propio se envía cada ~120 ms. El servidor reparte las posiciones de todos cada 150 ms.
- Los rivales se dibujan 250 ms por detrás de lo recibido, interpolando entre dos envíos. Nunca se extrapola: un rival no aparece más adelante de lo que dijo el servidor.

### Reloj sincronizado

Al conectar, el cliente hace 5 pings y se queda con el de menor ida y vuelta (estilo NTP) para estimar el desfase. Las horas del servidor (salida, fin de la espera) se convierten al reloj de `performance.now()` de la página. Así la cuenta regresiva termina a la vez en todos los navegadores.

### Validación de la llegada

Al terminar, el cliente manda las pulsaciones. El servidor las reproduce con `playKeystrokes` sobre el texto de la sala y exige que completen el texto. Además marca el resultado (no lo rechaza) si:

- `inspectRun` encuentra ppm implausible o intervalos uniformes;
- dice haber tardado menos de lo que lleva la carrera en el reloj del servidor (con 2 s de margen);
- el progreso en vivo fue imposible para el tiempo transcurrido (más de 300 ppm).

El progreso que retrocede más de 30 caracteres se ignora. Las carreras en línea son siempre estrictas y sin «ignorar tildes»: todos con las mismas reglas.

### Reconexión

El servidor guarda el lugar 30 s. Lo escrito se guarda en `sessionStorage` por carrera; al volver (recarga o corte), se reproduce sobre la salida original y se sigue escribiendo. Si la sala ya terminó, el servidor reenvía los resultados a quien vuelve.

Pedir matchmaking de nuevo (recargar `/play`) devuelve a la carrera pública en curso, en vez de buscar otra.

### Matchmaking público

- Entra a una sala pública abierta del mismo idioma (el de los textos en Configuración), o crea una.
- La espera dura 10 s. Al terminar, la carrera se completa con bots hasta 5 corredores (de principiante a experto).
- Si llega alguien durante la cuenta regresiva, ocupa el lugar de un bot y la cuenta se reinicia (spec 7.1).
- Con 5 personas arranca sin esperar.

### Sala privada

- El código usa 6 caracteres sin los que se confunden (0/O, 1/I/L).
- La sala arranca cuando todas las personas conectadas están listas, o cuando el anfitrión pulsa «Empezar ya». Esto permite correr solo contra bots en una sala.
- Si el anfitrión se va, el anfitrión pasa a otra persona.
- La revancha conserva sala y jugadores, cambia el texto y vuelve a pedir «listo».

### Resultados en línea de invitados

Con cuenta, el resultado se guarda en el perfil igual que el de una carrera local. Sin cuenta no se guarda: el historial local de invitado solo recibe pruebas que el servidor puede revalidar enteras al importarlas, y una carrera en línea depende de la sala. La pantalla lo dice y ofrece crear una cuenta.

### Nombre de invitado

Se elige en la pantalla de salas privadas y se recuerda en el navegador. En la carrera pública se usa el guardado, o uno al azar («Invitado XXXX»).
