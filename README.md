# STRIKE WEB

Shooter táctico multijugador para el navegador inspirado en **Counter-Strike 2**.
El cliente es una página estática (**GitHub Pages**) y el servidor multijugador corre en **Render** (Node.js + WebSocket).

Juega aquí: **https://lorennswaggerboi-lab.github.io/yea/**

Administrador / contacto: **elalfredonico@gmail.com**

## Características

### Cuentas y perfil
- **Registro e inicio de sesión al entrar**, como en un servidor de Minecraft: para registrarte pides usuario, contraseña y repetir contraseña; para entrar, usuario y contraseña.
- Contraseñas guardadas con hash **scrypt** y límite de intentos por IP.
- **Foto de perfil**: se recorta y comprime en el navegador. Aparece en el lobby, en el marcador y en la barra superior de la partida: **en color si estás vivo y en gris si estás muerto**, como en CS.
- **Estadísticas persistentes**: partidas, victorias, K/D, % de tiros a la cabeza, ADR, MVP y **rating Premier** que sube o baja según el resultado y tu rendimiento.

### Lobby con amigos (como en CS2)
- Grupos de hasta 5 jugadores con **código de invitación** o **enlace** (`?lobby=CÓDIGO`).
- Chat de grupo, líder del grupo (corona), expulsar miembros y salir del grupo.
- El líder pulsa **BUSCAR PARTIDA** y todo el grupo entra junto, en el mismo equipo.
- Modo **Premier** (sala pública, se completa con bots) o **Privada** (solo tu grupo y bots, con dificultad y número de bots configurables y controles de anfitrión).
- **Reconexión**: si sales o se corta la conexión, puedes volver a tu partida desde el lobby y conservas equipo, dinero y estadísticas.

### Partida competitiva
- **Veto de mapas estilo Premier**: al empezar, CT y T vetan mapas por turnos (votación por equipo) hasta que queda uno.
- **MR12**: gana el primero en llegar a 13 rondas. Cambio de bando en la ronda 12 y **prórrogas MR3** con $12 500 si hay empate a 12.
- Avisos de *última ronda de la mitad* y *punto de partida*, descanso en el medio tiempo, **MVP de cada ronda**, historial de rondas y pantalla final con estadísticas y cambio de rating.
- Economía completa: bonus por derrotas consecutivas (de $1400 a $3400), recompensas por baja según el arma, bonus por plantar, y los T que sobreviven al tiempo no cobran.
- Bomba: plantar 3,2 s, explosión a los 40 s, desactivar 10 s (5 s con kit).

### 5 mapas con ambientación
Dunas, Almacén, Pueblo, Puerto y Templo:
- **Bordes con muros bajos** desde los que se ve el exterior: dunas con palmeras y casas con cúpulas, fábricas con chimeneas humeantes, pueblo con tejados de teja y campanario, mar con barcos y grúas, y selva con ruinas.
- **Varios niveles**: escaleras, pasarelas elevadas con barandilla (por ejemplo A corto en Dunas), altares y entreplantas. Los techos de los túneles se pueden pisar.
- **Puertas dobles abiertas estilo Dust 2** (A largo, medio, túneles…) y **puertas correderas estilo Nuke** que se abren y cierran con **E**. Los bots también las usan.
- Ventanas por las que se puede disparar y ver, y zonas techadas.
- Fachadas con detalles: ventanas con contraventanas, puertas, faroles, toldos, tuberías, aires acondicionados y enredaderas. Los edificios tienen alturas variadas y los tejados llevan depósitos, antenas y cúpulas.
- Se comprueba automáticamente que no hay líneas de visión directas entre los spawns.

### Amigos
- Añade amigos por nombre de usuario y acepta o rechaza solicitudes.
- Ve su estado en tiempo real: desconectado, en el lobby o en partida.
- **Invítalos a tu grupo** con un clic; les llega una notificación para unirse.

### Armas y combate
- **21 armas**: Glock, USP-S, P250, Tec-9, Five-SeveN, Desert Eagle, MAC-10, MP9, UMP-45, MP7, P90, Nova, Galil, FAMAS, AK-47, M4A4, SG 553, AUG, SSG 08, AWP y cuchillo (ataque fuerte y puñalada por la espalda).
- **Granadas**: HE, cegadora, humo, **molotov e incendiaria**. El fuego quema y se apaga con humo.
- **Penetración**: las balas atraviesan cajas y contenedores perdiendo daño (*wallbang*).
- Disparos validados por el servidor con **compensación de lag**, hitboxes por zona, pérdida de daño por distancia, retroceso, dispersión e inspección del arma (F).
- Killfeed con iconos de headshot, wallbang, a través del humo y sin mira.
- **Anti-wallhack**: el servidor no envía la posición de los enemigos que tu equipo no puede ver.

### Interfaz estilo CS2
Barra superior con avatares, radar giratorio, vida y blindaje, munición, inventario con iconos, menú de compra con iconos, marcador con ADR, HS%, MVP, puntos, rating e historial de rondas, informe de daño al morir, banner de ronda con MVP y modo espectador.

### Rendimiento
- Geometría fusionada por material (menos de 80 llamadas de dibujo por mapa).
- Conjunto fijo de luces reutilizables, para que no haya tirones al disparar.
- Sombras que se actualizan cada pocos fotogramas.
- Escala de resolución y tres niveles de calidad. La calidad baja quita sombras, fachadas detalladas y escenario exterior.

### Mira configurable
**Dinámica** (se abre al moverte y disparar) **o estática**. Se puede ajustar longitud, grosor, separación, punto central, contorno, opacidad y color, con vista previa.

### Bots
- Nivel ajustado para que no maten al instante: necesitan verte un momento (más si estás lejos o agachado), reaccionan con retraso, apuntan peor al principio y fallan más al rociar. Su habilidad se ajusta con `BOT_SKILL` (0,35 por defecto) o desde la sala privada.
- Navegan por el mapa con A* y evitan el fuego.
- Compran según la economía.
- Los T se agrupan antes de entrar a un sitio y los CT rotan según lo que ve su equipo.
- Plantan, desactivan y lanzan granadas.

## Controles

| Acción | Tecla |
|---|---|
| Moverse / caminar / agacharse / saltar | WASD / Shift / Ctrl o C / Espacio |
| Disparar / mira o ataque fuerte | Clic izquierdo / clic derecho |
| Armas | 1-5, rueda del ratón, Q (arma anterior) |
| Recargar / soltar / inspeccionar | R / G / F |
| Plantar, desactivar o recoger | E (mantener) |
| Comprar / marcador / equipo | B / Tab / M |
| Chat / chat de equipo | Y / U |

## Despliegue

### 1. Servidor en Render
1. En [Render](https://render.com) crea un **Web Service** desde este repositorio:
   - Build Command: `npm install`
   - Start Command: `npm start`
   - O usa **New + → Blueprint** con `render.yaml`.
2. **Importante, para que las cuentas no se borren:** el disco de Render gratis se borra en cada reinicio. Crea una base de datos PostgreSQL gratis (por ejemplo en [neon.tech](https://neon.tech) o en Render → New → Postgres) y pon su URL en la variable de entorno `DATABASE_URL` del servicio web. Sin ella, las cuentas se guardan en un archivo que se pierde al reiniciar.
3. Copia la URL del servicio, por ejemplo `https://strike-web-xxxx.onrender.com`.

### 2. Cliente en GitHub Pages
1. Edita `js/config.js` y pon tu URL de Render en `DEFAULT_SERVER`:
   ```js
   export const DEFAULT_SERVER = 'wss://strike-web-xxxx.onrender.com/ws';
   ```
2. En GitHub, ve a **Settings → Pages → Source: Deploy from a branch → `main` → `/ (root)`**.

También puedes indicar el servidor desde la pantalla de inicio de sesión (sección «Servidor») o con `?server=strike-web-xxxx.onrender.com` en la URL. Los enlaces de invitación ya incluyen el servidor.

> El plan gratuito de Render se duerme tras unos 15 minutos sin uso. La primera conexión tarda cerca de 1 minuto y el juego lo avisa en pantalla.

## Desarrollo local

```bash
npm install
npm start
# abre http://localhost:3000
```

## Variables de entorno del servidor

| Variable | Por defecto | Descripción |
|---|---|---|
| `PORT` | 3000 | Puerto HTTP (Render lo define solo) |
| `DATABASE_URL` | (vacío) | PostgreSQL para guardar las cuentas de forma permanente |
| `ADMIN_EMAIL` | elalfredonico@gmail.com | Contacto mostrado en el juego |
| `ADMIN_PASSWORD` | (vacío) | Clave para `/rcon <clave>` en el chat |
| `BOTS_PER_TEAM` | 5 | Tamaño de cada equipo en partidas públicas, completado con bots |
| `BOT_SKILL` | 0.35 | Habilidad de los bots, de 0 a 1 |
| `MAX_ROOMS` | 20 | Máximo de partidas simultáneas |

## Comandos de chat
`/help`, `/admin`, `/rcon <clave>`, y con permisos de administrador `/bots <0-5>`, `/restart` y `/kick <nombre>`. En las salas privadas, el anfitrión tiene estos controles en el menú de pausa (Esc).

## Estructura

```
index.html, style.css   Página del juego (GitHub Pages)
js/                     Cliente: app y lobby (main), partida (game), HUD, iconos, mundo 3D, audio, efectos
shared/                 Código compartido: mapas (cuadrícula), física, armas
server/                 Servidor: cuentas (store), lobby y grupos, salas y reglas, bots, navegación A*
render.yaml             Blueprint para Render
```

Proyecto de fans sin relación con Valve. No usa recursos originales de Counter-Strike: todos los modelos, texturas, iconos y sonidos se generan por código.
