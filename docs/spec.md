# Proyecto: plataforma web de carreras de mecanografía

> Nombre provisional: **Tecleo** (cámbialo libremente; no uses nombres, logos, textos ni assets de TypeRacer ni de ningún otro producto).

---

## 0. Cómo quiero que trabajes

Eres un ingeniero full-stack senior. Vas a construir este proyecto **desde cero**, en fases, con calidad de producción.

1. **Antes de escribir código**, lee todo este documento y entrega un plan: estructura de carpetas, decisiones técnicas, riesgos y el orden de las fases. Espera mi aprobación.
2. Crea un `CLAUDE.md` en la raíz con: comandos (instalar, dev, test, lint, build), convenciones del código, arquitectura resumida y estado de las fases. Mantenlo actualizado al cerrar cada fase.
3. Trabaja **fase por fase** (sección 16). Al terminar cada una:
   - ejecuta lint, typecheck y tests, y arregla lo que falle;
   - levanta la app y verifica a mano que los criterios de aceptación se cumplen;
   - haz commits pequeños con mensajes en formato Conventional Commits;
   - dame un resumen corto: qué quedó, qué falta, qué decisiones tomaste.
4. Si algo de este documento es ambiguo, toma la decisión más razonable, anótala en `docs/decisiones.md` y sigue. Pregúntame solo si la decisión es difícil de revertir.
5. Nada de código de relleno, `TODO` sin resolver ni funciones simuladas que finjan funcionar. Si algo queda pendiente, que quede explícito en `CLAUDE.md`.
6. TypeScript en modo `strict` en todo el monorepo. Sin `any` salvo justificación escrita.
7. **Costo cero**: solo dependencias y servicios gratuitos. Verifica los planes gratuitos vigentes antes de recomendarlos.

---

## 1. Visión

Una web para practicar mecanografía compitiendo en carreras en tiempo real contra **otras personas** o contra **bots**. Aparece un texto aleatorio, el usuario lo escribe y se resalta en vivo lo que va escribiendo (correcto, incorrecto, pendiente) mientras su avatar/carro avanza en una pista junto a los demás corredores.

La inspiración es TypeRacer, pero el objetivo es superarlo en:
- **Sensación al escribir**: cursor fluido, respuesta instantánea, cero lag.
- **Profundidad**: estadísticas detalladas, teclas débiles, repeticiones, fantasmas, práctica dirigida.
- **Diseño**: moderno, limpio, con temas, animaciones cuidadas y accesible.
- **Variedad**: varios modos de juego, idiomas (español e inglés) y tipos de texto.

Debe funcionar bien en español: tildes, ñ, ¿ ¡ y teclas muertas.

---

## 2. Stack y arquitectura

Monorepo con **pnpm workspaces + Turborepo**:

```
/apps
  /web        → Next.js (App Router) + React + TypeScript
  /server     → NestJS + Socket.IO (tiempo real) + REST
/packages
  /engine     → motor de mecanografía y bots en TS puro (sin dependencias de UI ni de Node)
  /shared     → tipos, esquemas Zod, contratos de eventos y DTOs compartidos
  /content    → corpus de textos, listas de palabras y scripts de seed
  /ui         → (opcional) componentes compartidos
/docs
docker-compose.yml   → PostgreSQL (y Redis si se usa) para desarrollo local
```

**Frontend**: Next.js, Tailwind CSS, shadcn/ui (Radix), Motion (Framer Motion) para animaciones, Zustand para estado del juego, TanStack Query para datos del servidor, Recharts (o similar) para gráficas, next-intl para i18n.

**Backend**: NestJS, Socket.IO, Prisma + PostgreSQL, Zod (o class-validator) para validar entradas, autenticación JWT (access token corto + refresh token en cookie httpOnly), contraseñas con argon2, rate limiting.

**Clave de arquitectura**: `packages/engine` es la **única fuente de verdad** de la lógica de escritura y cálculo de métricas. Lo usan el cliente (para renderizar y calcular en vivo) y el servidor (para validar resultados y simular bots). Debe ser determinista y 100 % testeable.

Estado de salas en memoria del servidor detrás de una interfaz (`RoomStore`) para poder cambiar a Redis más adelante sin tocar la lógica.

---

## 3. Motor de escritura (`packages/engine`)

### 3.1 Captura de entrada
- Un `<input>`/`<textarea>` oculto que mantiene el foco; el texto visible es un render propio.
- Usar eventos `beforeinput`/`input` y `compositionstart/end` (no solo `keydown`) para soportar **teclas muertas y tildes** (´ + a = á) y teclados en español, inglés y latinoamericano.
- Bloquear pegar, soltar (drop), autocompletar y autocorrección (`autocomplete="off"`, `autocorrect="off"`, `spellcheck="false"`).
- Si el usuario pierde el foco, mostrar un overlay "Haz clic o presiona una tecla para continuar".
- Normalizar caracteres tipográficos del texto fuente (“ ” ‘ ’ — … ) a sus equivalentes de teclado, o aceptar ambos.

### 3.2 Reglas de escritura (configurables)
- **Modo estricto** (por defecto en carreras): no se puede avanzar a la siguiente palabra si la actual tiene errores; los caracteres erróneos se muestran y hay que borrarlos. Límite de caracteres extra (p. ej. 10) para no desbordar.
- **Modo libre** (práctica): se puede avanzar con errores; el espacio salta a la siguiente palabra y lo no escrito cuenta como error.
- Backspace borra un carácter; `Ctrl+Backspace` / `Alt+Backspace` borra la palabra actual. No se puede retroceder a palabras ya confirmadas como correctas.
- Opción "ignorar tildes" para principiantes (marcada en los resultados, no cuenta para rankings).

### 3.3 Estado y eventos
- El motor expone una máquina de estados (`idle → countdown → running → finished`) y funciones puras: `applyInput(state, input, timestamp) → newState`.
- Cada carácter tiene estado: `pending | correct | incorrect | extra | corrected` (corrected = falló y luego se corrigió, útil para estadísticas).
- Registro completo de pulsaciones: `[{ t: msDesdeInicio, input, expected, correct }]`. Sirve para: repeticiones, carreras fantasma, gráficas y validación antitrampa.

### 3.4 Métricas (fórmulas estándar)
- **WPM neto** = (caracteres correctos / 5) / minutos.
- **WPM bruto** = (todos los caracteres escritos / 5) / minutos.
- **Precisión** = pulsaciones correctas / pulsaciones totales × 100.
- **Consistencia** = 100 − coeficiente de variación del WPM por segundo (acotado a 0–100).
- WPM por segundo para la gráfica, errores por segundo, pico de WPM.
- Errores por tecla y por bigrama (par de letras) para el mapa de teclas débiles.
- En solo, el tiempo arranca con la primera pulsación; en carreras, con la señal de salida del servidor.

### 3.5 Tests
Cobertura alta con Vitest: tildes y teclas muertas, backspace, modo estricto vs libre, cálculo de métricas con registros de pulsaciones conocidos, normalización de caracteres, final de texto.

---

## 4. Contenido y textos (`packages/content`)

- **Tipos de texto**:
  - Citas/fragmentos con autor y fuente: **solo dominio público** (literatura clásica en español e inglés) o textos originales escritos para el proyecto. Nada de letras de canciones, libros con derechos ni textos copiados de otras plataformas de mecanografía.
  - Palabras aleatorias de las N más comunes (200, 1 000, 5 000) por idioma.
  - Opciones: con/sin puntuación, con/sin números, mayúsculas.
  - Fragmentos de código (JS/TS, Python, SQL) escritos para el proyecto, con indentación.
- Cada texto con: idioma, longitud, dificultad calculada (longitud media de palabra, símbolos, mayúsculas, bigramas raros), categoría.
- Seed inicial: al menos 150 textos por idioma de longitudes variadas (corto ~100 caracteres, medio ~250, largo ~500).
- Calificar textos: tras cada carrera el usuario puede dar 👍/👎; se guarda el récord por texto.
- Panel simple para que un administrador agregue/desactive textos.

---

## 5. Modos de juego

1. **Práctica libre**: por tiempo (15/30/60/120 s), por cantidad de palabras (10/25/50/100) o texto completo. Funciona sin cuenta y **sin servidor** (todo en el cliente).
2. **Carrera contra bots**: local en el cliente, 1–5 bots de dificultad elegible. Funciona sin conexión.
3. **Carrera pública (matchmaking)**: se une a una sala abierta por idioma; si no llegan humanos en ~10 s, se completa con bots hasta 5 corredores.
4. **Sala privada**: código de 6 caracteres + enlace para compartir. El anfitrión configura idioma, tipo de texto, longitud, cantidad de bots y máximo de jugadores (2–10). Botón "revancha" que mantiene la sala.
5. **Carrera fantasma**: competir contra la repetición de tu mejor resultado en ese texto o la de otro jugador (desde su perfil o el ranking del texto).
6. **Desafío diario**: un mismo texto para todos cada día, con ranking propio.
7. **Práctica dirigida**: genera ejercicios a partir de las teclas y bigramas con más errores del usuario (algoritmo, sin IA paga).

---

## 6. Bots

- Implementados en `packages/engine` para correr igual en el cliente (modo local) y en el servidor (salas en línea, como jugadores virtuales).
- Modelo realista, no lineal:
  - WPM objetivo muestreado de una distribución normal alrededor del nivel.
  - Retardo entre caracteres con ruido (log-normal), pausas más largas tras puntuación y entre palabras, ráfagas en palabras comunes.
  - Errores ocasionales con tiempo de corrección (borrar y reescribir).
  - Ligera fatiga o aceleración al final.
- Niveles: Principiante (25–35 WPM), Intermedio (45–60), Avanzado (70–90), Experto (100–120), Leyenda (130–160).
- Nombres y avatares propios, marcados claramente como bot (ícono).
- Semilla aleatoria por carrera para poder reproducir resultados en tests.

---

## 7. Multijugador en tiempo real

### 7.1 Ciclo de una sala
`waiting → countdown (5 s, se reinicia si entra alguien) → racing → finished → (revancha | cierre)`

### 7.2 Contrato de eventos (tipado en `packages/shared` con Zod)
- Cliente → servidor: `room:join`, `room:leave`, `room:ready`, `room:config` (anfitrión), `race:progress { charIndex, errors, wpm, clientTime }`, `race:finish { keystrokes }`, `room:rematch`, `time:ping`.
- Servidor → cliente: `room:state`, `race:countdown { startAt }`, `race:start { textId, text, startAt }`, `race:progress` (posiciones de todos), `race:player-finished`, `race:results`, `time:pong`, `error`.
- Validar todas las entradas; rechazar eventos malformados.

### 7.3 Reglas técnicas
- **Servidor autoritativo**: el servidor decide el inicio, el orden de llegada y los resultados oficiales.
- Sincronización de reloj por ping (calcular desfase y latencia) para que la cuenta regresiva arranque al mismo tiempo en todos.
- Enviar progreso con throttling (~100–150 ms) e interpolar posiciones de rivales en el cliente para que la animación sea suave.
- Reconexión: si un jugador se cae, tiene ~30 s para volver a la misma carrera con su progreso.
- Límite de tiempo por carrera (según longitud); quien no termine queda como DNF con su progreso.

### 7.4 Antitrampa
- Progreso monótono y coherente con el tiempo transcurrido.
- Al terminar, el servidor **reproduce el registro de pulsaciones con el motor** y verifica que produce el texto y el WPM reportados.
- WPM implausible (p. ej. > 250 sostenido) o intervalos entre teclas sospechosamente uniformes → resultado marcado y excluido de rankings.
- El texto se renderiza no seleccionable; pegar está bloqueado.
- Rate limiting en eventos de socket y en endpoints de autenticación.

---

## 8. Cuentas, perfil y progresión

- **Invitado**: puede jugar todo sin cuenta con un apodo temporal; al registrarse, ofrecer migrar sus resultados recientes guardados localmente.
- **Registro/login**: correo + contraseña. OAuth con Google opcional (detrás de una variable de entorno).
- **Perfil público**: apodo, avatar (generado o elegido de un set), país, nivel, fecha de registro, WPM promedio (últimas 10), mejor WPM, carreras jugadas, % de victorias, precisión media.
- **Estadísticas**: gráfica de evolución del WPM, historial de carreras con filtros, **mapa de calor sobre un teclado visual** con las teclas de más errores, bigramas problemáticos, mejores marcas por modo.
- **Repeticiones**: ver cualquier carrera propia reproducida pulsación por pulsación.
- **Progresión**: XP por carrera (según WPM, precisión y puesto), niveles, logros (p. ej. "100 carreras", "primera vez sobre 80 WPM", "carrera perfecta 100 %") y desbloqueos cosméticos (skins de carro/avatar, temas).
- **Rankings**: diario, semanal e histórico; por idioma y modo; ranking por texto. Solo resultados validados.

---

## 9. Diseño y experiencia

### 9.1 Dirección visual
- Moderno, minimalista y con personalidad propia (no copiar la estética de otras webs de mecanografía).
- Oscuro por defecto con tema claro, más 4–6 temas de color seleccionables. Todo con variables CSS (design tokens).
- Tipografía protagonista: una monoespaciada de calidad para el texto de juego (JetBrains Mono, Geist Mono o similar, configurable) y una sans moderna para la interfaz.
- Pista de carrera visual: cada corredor en su carril con avatar/carro, nombre, WPM en vivo y bandera de llegada.

### 9.2 Pantalla de escritura (lo más importante)
- Texto en un área de ~3 líneas que hace scroll suave a medida que avanzas.
- Cursor animado y fluido (estilos: línea, bloque, subrayado), con parpadeo solo cuando no escribes.
- Pendiente en tono atenuado, correcto en color principal, error en color de error **y** subrayado (no depender solo del color).
- Contador de WPM y precisión en vivo (ocultable), modo "concentración" que esconde todo menos el texto.
- Respuesta inmediata: el render de una pulsación debe tardar menos de un frame (evitar re-renders de todo el texto; memoizar por palabra).

### 9.3 Pantallas
Inicio (botón grande "Jugar ahora" + accesos a modos), Práctica, Lobby de sala, Carrera, Resultados, Perfil, Rankings, Configuración, Login/Registro, 404.

**Resultados**: podio animado, WPM/precisión/consistencia, gráfica WPM por segundo con marcas de error, comparación con tu promedio y tu récord, XP ganada, botones "otra carrera", "revancha", "ver repetición", calificar texto.

### 9.4 Animaciones y sonido
- Cuenta regresiva animada, entrada a la pista, celebración al llegar (confeti sutil si ganas o haces récord), transiciones entre pantallas.
- Sonidos de tecla opcionales (Web Audio, varios estilos), desactivados por defecto.
- Respetar `prefers-reduced-motion`.

### 9.5 Accesibilidad y responsive
- Contraste WCAG AA, foco visible, navegación completa por teclado, roles ARIA en la pista y resultados, atajos (`Tab + Enter` reinicia, `Esc` sale).
- Desktop primero. En móvil: aviso de que se recomienda teclado físico, pero perfil, rankings y repeticiones deben verse bien.
- Interfaz en español e inglés.

---

## 10. Configuración del usuario

Guardada en el servidor si hay sesión, en `localStorage` si es invitado: tema, fuente y tamaño, estilo de cursor, modo estricto/libre, ignorar tildes, sonidos, mostrar/ocultar WPM en vivo, idioma de la interfaz, idioma por defecto de los textos, distribución de teclado (para el mapa de calor), dificultad de bots por defecto.

---

## 11. Modelo de datos (orientativo, ajústalo)

- `User` (id, email, passwordHash, nickname único, avatar, country, xp, level, createdAt)
- `UserSettings` (userId, json de preferencias)
- `Text` (id, content, language, type, source, author, length, difficulty, active, likes, dislikes)
- `Race` (id, roomId, textId, mode, startedAt, finishedAt)
- `RaceResult` (id, raceId, userId nullable, botName nullable, position, wpm, rawWpm, accuracy, consistency, durationMs, keystrokes (json comprimido), validated, flagged)
- `KeyStat` (userId, key/bigram, attempts, errors) — agregados para el mapa de calor
- `Achievement`, `UserAchievement`
- `DailyChallenge` (date, textId)

Índices para rankings (wpm por idioma/modo/fecha) y para historial por usuario.

---

## 12. API REST (además de los sockets)

`/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/me`, `/me/settings`, `/users/:nickname`, `/users/:nickname/stats`, `/users/:nickname/races`, `/races/:id` (incluye repetición), `/texts/random`, `/texts/:id/leaderboard`, `/leaderboards`, `/daily`, `/results` (guardar resultados de práctica solo con sesión, validados con el motor).

Documentar con Swagger/OpenAPI generado por NestJS.

---

## 13. Calidad

- ESLint + Prettier, typecheck en todo el monorepo.
- **Unit tests** (Vitest): motor, métricas, bots, validación antitrampa, servicios del backend.
- **Integración**: endpoints y gateway de sockets con base de datos de prueba.
- **E2E** (Playwright): flujo de práctica completo; carrera contra bots; **carrera multijugador con dos contextos de navegador** en la misma sala; registro/login; responsive básico.
- GitHub Actions: lint, typecheck, tests y build en cada push/PR.
- `.env.example` completo; ningún secreto en el repo.
- Rendimiento: Lighthouse ≥ 90 en Performance y Accessibility en la página de inicio; la pantalla de escritura sin jank a 60 fps.

---

## 14. Despliegue sin costo

- Frontend en Vercel (plan gratuito).
- Servidor NestJS en un servicio gratuito que soporte WebSockets persistentes (evalúa opciones vigentes y documenta la elegida).
- PostgreSQL gestionado gratuito (p. ej. Neon o Supabase).
- Si el servidor tiene "arranque en frío", el cliente debe mostrar un estado "conectando al servidor…" y mientras tanto permitir práctica y carreras contra bots locales.
- `README.md` con descripción, capturas/GIF, arquitectura (diagrama), cómo correr en local con un solo comando y enlace al demo.

---

## 15. Fuera de alcance / no hacer

- No copiar marca, textos, diseño ni assets de TypeRacer u otras plataformas.
- No usar servicios pagos ni APIs de IA de pago.
- No chat de texto entre jugadores en la v1 (evita moderación); a lo sumo reacciones predefinidas (emojis) en el lobby.
- No app móvil nativa.

---

## 16. Fases y criterios de aceptación

**Fase 0 – Base**
Monorepo, tooling, CI, docker-compose con Postgres, `CLAUDE.md`, `README` inicial.
✅ `pnpm dev` levanta web y server; CI en verde.

**Fase 1 – Motor y práctica solo**
`packages/engine` completo con tests; pantalla de práctica (tiempo/palabras/texto) sin backend; métricas en vivo y pantalla de resultados con gráfica.
✅ Se puede escribir en español con tildes y ñ sin fallos; métricas coinciden con los tests.

**Fase 2 – Diseño**
Design tokens, temas, tipografías, componentes base, layout, configuración local, i18n es/en, animaciones principales.
✅ Todas las pantallas existen con navegación; cambio de tema instantáneo; accesibilidad básica revisada.

**Fase 3 – Bots locales**
Modelo de bots, pista de carrera, carrera contra 1–5 bots en el cliente, podio.
✅ Los bots se ven humanos (ritmo irregular, errores) y su WPM final cae en el rango de su nivel.

**Fase 4 – Backend y cuentas**
Prisma, auth, perfiles, guardar resultados validados, historial, estadísticas, mapa de calor, seed de textos.
✅ Registro, login, persistencia de resultados y perfil con gráficas funcionando.

**Fase 5 – Multijugador**
Gateway de sockets, salas privadas, matchmaking público con relleno de bots, sincronización de reloj, reconexión, antitrampa.
✅ Test E2E con dos navegadores compitiendo en la misma sala pasa de forma estable.

**Fase 6 – Contenido extra**
Rankings, logros, XP/niveles, repeticiones, carrera fantasma, desafío diario, práctica dirigida.
✅ Todo accesible desde la interfaz y cubierto por tests.

**Fase 7 – Pulido y despliegue**
Rendimiento, accesibilidad, E2E completos, README final, despliegue gratuito.
✅ Demo pública funcionando y Lighthouse dentro de los objetivos.

---

Empieza leyendo todo y entrégame el plan de la sección 0. No escribas código hasta que lo apruebe.
