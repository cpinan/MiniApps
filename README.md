# MiniApps

Colección de minijuegos y miniapps **PWA** (HTML + CSS + JS puro, sin build, sin backend) para
publicar en GitHub Pages y compartir con un link.

👉 **Demo:** https://cpinan.github.io/MiniApps/ *(activa GitHub Pages para que funcione)*

## Apps

| App | Qué hace | Link |
|---|---|---|
| 🔴 **PokéRuleta** | Ruleta de nombres estilo Pokémon: pega la lista, configura intentos y sortea ganadores. | [`apps/pokewheel/`](apps/pokewheel/) |

## PokéRuleta

Documentación completa en [`apps/pokewheel/README.md`](apps/pokewheel/README.md). Resumen:

- **Entrada flexible**: pega los nombres separados por coma, punto y coma, tab, salto de línea o CSV.
  Si el texto no trae ningún separador, se parte por espacios. Quita comillas y viñetas (`1.`, `-`, `•`).
- **Reglas configurables**:
  - *Intentos*: cuántas rondas de giro tiene el sorteo.
  - *Quitar al seleccionado después de cada intento* (on/off).
  - *El ganador es*: el último seleccionado, o la lista completa de seleccionados.
  - Duración del giro, sonido, y tema visual: 5 presets (Pokémon / PokeMMO / Neón / Pastel / Mono) o
    **Personalizado**, con tres colores a elección — los 8 gajos se derivan de ellos en HSL,
    alternando claro/oscuro para que dos vecinos nunca se confundan.
- **Justo**: el ganador sale de `crypto.getRandomValues` con rechazo de rango (sin sesgo modular),
  no de `Math.random()`.
- **Persistencia**: lista, configuración e historial se guardan en `localStorage`.
- **Offline**: service worker con cache del app shell.
- **Móvil**: la ruleta va primero, se ajusta al alto de pantalla (también apaisado), objetivos
  táctiles de 44px, inputs de 16px (iOS no hace zoom) y respeta el safe-area del notch.
- Un clic siempre gira: si la tanda terminó o la ruleta se vació, arranca una nueva. Cargar una
  lista reinicia el sorteo entero (corta el giro en curso, cierra el modal, rueda a cero).
- **Celebración**: anillo + confeti al ganar una ronda; al cerrar la tanda, oro, estrellas,
  serpentinas en tres oleadas, trofeo, fanfarria larga y el nombre entrando letra a letra.
  Todo se queda quieto con `prefers-reduced-motion`.
- La pokébola es solo clickeable (no arrastrable) con estados idle / hover / pressed / disabled.
- El service worker se actualiza solo: una corrección llega al recargar, sin borrar datos del sitio.
- Botón **Reparar app**: desregistra service workers, borra cachés y recarga saltándose la caché
  HTTP. La salida cuando un service worker viejo dejó pegada una versión con bugs.
- Atajos: `Espacio` gira, `Esc` cierra el modal. La rueda entera es clickable.

## Correr en local

Un service worker necesita `http://`, no `file://`:

```bash
python3 -m http.server 8080
# abre http://localhost:8080/
```

## Verificar

```bash
npm test          # las dos suites
npm run test:unit # solo lógica pura
npm run test:browser
```

Sin dependencias: `node` y (para la suite de navegador) Chrome instalado.

- **`tests/pokewheel.test.mjs`** — extrae las funciones puras de `app.js` (parseo, aleatoriedad,
  matemática del giro): 15 casos, incluidos 1600 giros comprobando que la flecha cae siempre en
  el segmento elegido.
- **`tests/browser.test.mjs`** — Chrome headless por CDP, 63 casos: que la rueda **gira** de
  verdad (hash de píxeles del canvas cambiando a mitad del giro), el modal del ganador, volver a
  girar tras cerrar una tanda (cinco giros con clics de ratón reales), la celebración del
  ganador, que cargar lista reinicia el sorteo, los estados del botón, los colores
  personalizados, y que nada se desborda en 390×844 ni en apaisado. Se salta solo si no
  encuentra Chrome.

## Publicar en GitHub Pages

1. `git init && git add -A && git commit -m "feat: MiniApps + PokéRuleta"`
2. Crea el repo y sube: `gh repo create MiniApps --public --source=. --push`
3. Settings → Pages → *Deploy from a branch* → `main` / `root`.
4. El archivo `.nojekyll` ya está en el repo para que Pages no procese nada.

## Agregar una miniapp nueva

1. `apps/<nombre>/` con su `index.html`, `manifest.webmanifest`, `sw.js` e `icons/`.
2. Rutas siempre **relativas** (`./`) — así funciona en cualquier subcarpeta de Pages.
3. Agrega una tarjeta en el `index.html` de la raíz y una fila en la tabla de arriba.

## Licencia

MIT. Pokémon es marca de Nintendo / Creatures / GAME FREAK, y PokeMMO es un proyecto
independiente ajeno a este; los temas son solo paletas de colores como guiño, sin assets ni
afiliación con ninguno de los dos.
