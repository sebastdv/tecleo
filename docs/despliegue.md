# Despliegue sin costo

| Pieza            | Servicio (plan gratuito)    | Por qué                                                                            |
| ---------------- | --------------------------- | ---------------------------------------------------------------------------------- |
| Web (`apps/web`) | Vercel Hobby                | Next.js sin configuración; CDN y HTTPS.                                            |
| Server           | Render Free (`render.yaml`) | Node con WebSockets persistentes, 512 MB, 750 h/mes.                               |
| Base de datos    | Neon Free                   | Postgres gestionado: 0,5 GB y 100 CU-h por proyecto; se apaga a los 5 min sin uso. |

Límites verificados en octubre de 2026:

- **Render Free:** el servicio se duerme tras 15 minutos sin peticiones HTTP ni mensajes de WebSocket, y tarda alrededor de un minuto en despertar.
- **Neon Free:** 100 CU-h y 5 GB de transferencia por mes.

Mientras el server despierta, la web muestra «Conectando al servidor…» y deja practicar y correr contra bots, que funcionan sin él.

## Pasos

### 1. Base de datos (Neon)

1. Crea un proyecto en la región **AWS us-east-1**, cerca de Render Virginia.
2. Copia la cadena de conexión **directa**, la que no lleva `-pooler`, con `sslmode=require`. Las migraciones de Prisma necesitan una conexión directa.

### 2. Server (Render)

En Render, entra a **New → Blueprint** y elige este repositorio: Render lee `render.yaml`. Solo hay que pegar `DATABASE_URL`, la cadena directa de Neon.

El Blueprint ya trae el resto:

- `WEB_ORIGIN`: la URL de la web, https://tecleo-nine.vercel.app.
- `JWT_SECRET` y `PROXY_SECRET`: los genera Render.

Cada arranque corre `start:prod`:

- aplica las migraciones pendientes;
- carga el corpus si la base está vacía;
- empieza a escuchar.

`/health` sirve de chequeo.

### 3. Secreto compartido

Copia el `PROXY_SECRET` que generó Render (pestaña **Environment** del servicio) y cárgalo en Vercel con el mismo nombre, en el entorno de producción.

Con él, el server confía en la IP del cliente que le reenvía la web. Sin él, todo el tráfico llegaría con la IP de Vercel y todas las personas compartirían el límite de intentos de login.

### 4. Web (Vercel)

El proyecto `tecleo` ya existe y está publicado en https://tecleo-nine.vercel.app. Se despliega con `vercel deploy --prod` desde la raíz del repo.

1. **Root Directory** en `apps/web`. `apps/web/vercel.json` trae la instalación y el build del monorepo, y `.vercelignore` evita subir builds locales y archivos `.env`.
2. Variables de entorno de producción:

   | Variable                 | Valor                                                               |
   | ------------------------ | ------------------------------------------------------------------- |
   | `SERVER_URL`             | La URL de Render, por ejemplo `https://tecleo-server.onrender.com`. |
   | `NEXT_PUBLIC_SOCKET_URL` | La misma URL de Render.                                             |
   | `PROXY_SECRET`           | El secreto del paso 2.                                              |

`NEXT_PUBLIC_SOCKET_URL` se fija al compilar: si cambia, hay que volver a desplegar la web.

### 5. Cerrar el círculo

1. Después de cargar `PROXY_SECRET` en Vercel, vuelve a desplegar la web (`vercel deploy --prod`) para que la tome.
2. Comprueba que `https://<web>/api/health` responde `{"status":"ok"}`. Eso confirma que el proxy de la web llega al server.
3. Para dar el rol de administrador, corre desde tu máquina, contra la base de Neon:

   ```bash
   DATABASE_URL='<cadena de Neon>' pnpm --filter @tecleo/server admin:grant tu@correo
   ```

## Medir la página de inicio

Con la web desplegada (o con `pnpm build` y `next start` en local):

```bash
pnpm lighthouse https://<web>/es
```

Hace 3 corridas con la configuración móvil de Lighthouse y falla si la mediana de rendimiento o de accesibilidad baja de 90.
