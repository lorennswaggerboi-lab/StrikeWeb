# STRIKE WEB

Shooter táctico multijugador para el navegador inspirado en **Counter-Strike 2**.
El cliente es una página estática (**GitHub Pages**) y el servidor multijugador corre en **Render** (Node.js + WebSocket).

Administrador / contacto: **elalfredonico@gmail.com**

## Características

- **Modo desactivación de bomba**: plantar (T) y desactivar (CT, 10 s o 5 s con kit), bomba de 40 s.
- **Partida al mejor de 24 rondas**: gana quien llegue a 13; cambio de bandos en la ronda 12; calentamiento previo.
- **Economía completa**: $800 iniciales, recompensas por baja según el arma, bonus por derrotas consecutivas, bonus por plantar, máximo $16 000.
- **13 armas**: Glock-18, USP-S, P250, Desert Eagle, MAC-10, MP9, Nova, Galil AR, FAMAS, AK-47, M4A4, SSG 08 y AWP (con mira telescópica), además del cuchillo con ataque fuerte y puñalada por la espalda.
- **Granadas**: HE (daño de área), cegadora (ceguera según el ángulo de visión) y humo (bloquea la visión de jugadores y bots).
- **Equipo**: chaleco, chaleco con casco y kit de desactivación; el blindaje reduce el daño según la penetración de cada arma.
- **Disparos con autoridad del servidor**: hitboxes de cabeza, pecho, estómago y piernas, pérdida de daño con la distancia, **compensación de lag** (rebobinado de posiciones), patrones de retroceso y dispersión por movimiento, salto y agacharse.
- **Bots con IA**: navegación por waypoints, compra según su dinero, rutas por carriles, plantan, desactivan, lanzan granadas y reaccionan a disparos. Rellenan los equipos automáticamente.
- **Salas**: varias salas simultáneas, lista de salas activas, chat global y de equipo.
- **HUD tipo CS2**: radar giratorio con enemigos detectados, killfeed, marcador (Tab), menú de compra (B), indicadores de daño, marcador de impacto, temporizador de bomba y modo espectador.
- **Gráficos y sonido**: Three.js con sombras, texturas procedurales, trazadoras, impactos, sangre, explosiones; audio 3D sintetizado con WebAudio (no hace falta descargar archivos).
- Mapa original **de_dunas**: 3 carriles, túnel, A largo, A corto, medio, sitios A y B.

## Controles

| Acción | Tecla |
|---|---|
| Moverse / caminar / agacharse / saltar | WASD / Shift / Ctrl o C / Espacio |
| Disparar / mira o ataque fuerte | Clic izquierdo / clic derecho |
| Armas | 1-5, rueda del ratón, Q (arma anterior) |
| Recargar / soltar arma | R / G |
| Plantar, desactivar o recoger | E (mantener) |
| Comprar / marcador / equipo | B / Tab / M |
| Chat / chat de equipo | Y / U |

## Despliegue

### 1. Servidor en Render

1. Sube este repositorio a GitHub.
2. En [Render](https://render.com) inicia sesión (por ejemplo con `elalfredonico@gmail.com`) y elige **New + → Blueprint**.
3. Selecciona el repositorio. Render leerá `render.yaml` y creará el servicio web `strike-web`.
4. Cuando termine, copia la URL del servicio, por ejemplo `https://strike-web-xxxx.onrender.com`.
5. La contraseña de administrador (`ADMIN_PASSWORD`) se genera sola. La puedes ver en Render → servicio → **Environment**.

> Si prefieres hacerlo a mano: **New + → Web Service**, con *Build command* `npm install` y *Start command* `npm start`.

### 2. Cliente en GitHub Pages

1. Edita `js/config.js` y pon tu URL de Render en `DEFAULT_SERVER`:
   ```js
   export const DEFAULT_SERVER = 'wss://strike-web-xxxx.onrender.com/ws';
   ```
2. En GitHub, ve a **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Haz push a `main`. El workflow `.github/workflows/pages.yml` publica la web en `https://TU_USUARIO.github.io/NOMBRE_REPO/`.

Hay otras dos formas de indicar el servidor, sin editar el código:
- Desde el menú del juego, en **Servidor** (se guarda en el navegador).
- Con un parámetro en la URL: `https://TU_USUARIO.github.io/NOMBRE_REPO/?server=strike-web-xxxx.onrender.com`

También puedes compartir una sala concreta con `?sala=nombre`.

> El plan gratuito de Render apaga el servicio tras unos 15 minutos sin tráfico. La primera conexión puede tardar unos 50 segundos mientras se despierta; el juego lo avisa en pantalla.

El servidor de Render también sirve el cliente, así que `https://strike-web-xxxx.onrender.com` funciona directamente como página del juego.

## Desarrollo local

```bash
npm install
npm start
# abre http://localhost:3000
```

## Comandos de chat

| Comando | Descripción |
|---|---|
| `/help` | Lista de comandos |
| `/admin` | Muestra el correo del administrador |
| `/login <clave>` | Inicia sesión como administrador (usa `ADMIN_PASSWORD`) |
| `/bots <0-5>` | Bots por equipo |
| `/skill <0-1>` | Habilidad de los bots |
| `/kick <nombre>` | Expulsa a un jugador |
| `/restart` | Reinicia la partida |

Si no defines `ADMIN_PASSWORD`, cualquier jugador puede usar los comandos de administración.

## Variables de entorno del servidor

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | 3000 | Puerto HTTP (Render lo define solo) |
| `ADMIN_EMAIL` | elalfredonico@gmail.com | Contacto mostrado en el juego |
| `ADMIN_PASSWORD` | (vacío) | Clave para `/login` |
| `BOTS_PER_TEAM` | 4 | Tamaño mínimo de cada equipo, que se completa con bots |
| `BOT_SKILL` | 0.5 | Habilidad de los bots, de 0 a 1 |
| `MAX_PLAYERS_PER_ROOM` | 10 | Máximo de jugadores humanos por sala |
| `MAX_ROOMS` | 20 | Máximo de salas simultáneas |

## Estructura

```
index.html, style.css   Página del juego (GitHub Pages)
js/                     Cliente: render, entrada, HUD, audio, efectos
shared/                 Código compartido cliente/servidor: mapa, física, armas
server/                 Servidor: salas, rondas, economía, bots, navegación
render.yaml             Blueprint para Render
.github/workflows/      Despliegue automático en GitHub Pages
```

Proyecto de fans sin relación con Valve. No usa recursos originales de Counter-Strike: todos los modelos, texturas y sonidos se generan por código.
