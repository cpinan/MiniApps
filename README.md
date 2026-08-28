# MiniApps

Colección de minijuegos y miniapps **PWA** (HTML + CSS + JS puro, sin build, sin backend) para
publicar en GitHub Pages y compartir con un link.

👉 **En vivo:** https://cpinan.github.io/MiniApps/

## Apps

| App | Qué hace | Link |
|---|---|---|
| 🔴 **PokéRuleta** | Ruleta de nombres: pega la lista, configura intentos y sortea ganadores. | [abrir](https://cpinan.github.io/MiniApps/apps/pokewheel/) · [docs](apps/pokewheel/README.md) |
| 🎲 **Equipos** | Reparte una lista en equipos parejos, con capitanes fijos y parejas que no deben coincidir. | [abrir](https://cpinan.github.io/MiniApps/apps/teams/) |
| 🎁 **Amigo secreto** | Sortea y da un link por persona; la asignación viaja en la URL, sin servidor. | [abrir](https://cpinan.github.io/MiniApps/apps/secretsanta/) |
| 🛡️ **Tabla de tipos** | Efectividad de los 18 tipos: ataque, defensa dual y matriz completa, offline. | [abrir](https://cpinan.github.io/MiniApps/apps/typechart/) |
| 🔢 **Bolillero** | Bingo: saca números sin repetir y los canta con la voz del navegador. | [abrir](https://cpinan.github.io/MiniApps/apps/bingo/) |

Historial de cambios en [CHANGELOG.md](CHANGELOG.md). Ideas pendientes en [docs/IDEAS.md](docs/IDEAS.md).

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

## Cómo está armado

```
index.html              hub con las tarjetas
apps/<nombre>/          una carpeta por app: index.html, styles.css, app.js, sw.js, manifest, icons/
assets/shared/base.css  temas, panel, botones, modal y responsive compartidos
assets/shared/core.js   parseo de listas, azar sin sesgo, temas, confeti, sonido y arranque PWA
tests/                  una suite por app + tests/lib/cdp.mjs (arnés de Chrome headless)
tools/make-icons.py     genera los iconos PNG de cada app con PIL
```

Cada app trae su propio service worker (network-first) y su sello de build con botón
**Reparar app**. La lógica sorteable de cada una vive en su módulo puro (`split.js`, `draw.js`,
`types.js`) para poder testearla sin navegador.

## Agregar una miniapp nueva

1. `apps/<nombre>/` con su `index.html`, `styles.css`, `app.js`, `sw.js`, `manifest.webmanifest`
   e `icons/`. Enlaza `../../assets/shared/base.css` y `core.js`.
2. Rutas siempre **relativas** (`./`) — así funciona en cualquier subcarpeta de Pages.
3. La lógica que se pueda probar sin DOM, en su propio módulo.
4. Una suite en `tests/` con `tests/lib/cdp.mjs`, **incluyendo los chequeos de móvil**
   (sin scroll horizontal, targets ≥44px, inputs ≥16px, apaisado).
5. Tarjeta en el `index.html` de la raíz, fila en la tabla de arriba y línea en el CHANGELOG.

## Donar

Todo esto es gratis, MIT, sin anuncios ni rastreo, y así se queda. Si te sirvió:

[![Sponsor](https://img.shields.io/badge/GitHub-Sponsors-ea4aaa?logo=githubsponsors)](https://github.com/sponsors/cpinan)
[![Ko-fi](https://img.shields.io/badge/Ko--fi-invitar%20un%20café-ff5e5b?logo=kofi&logoColor=white)](https://ko-fi.com/carlospinan)
[![PayPal](https://img.shields.io/badge/PayPal-donar-00457c?logo=paypal&logoColor=white)](https://paypal.me/carlospinan)

Desde Perú, sin comisión para nadie: **Yape y Plin por QR** en [DONATE_ES.md](DONATE_ES.md)
([English](DONATE.md)). Cada app lleva un ☕ en la cabecera que abre esa misma página — y nada
más: ni ventanas, ni banners, ni recordatorios.

Lo que más ayuda no cuesta nada: una estrella al repo, compartir el link, o mandar una miniapp.

## Licencia

MIT. Pokémon es marca de Nintendo / Creatures / GAME FREAK, y PokeMMO es un proyecto
independiente ajeno a este; los temas son solo paletas de colores como guiño, sin assets ni
afiliación con ninguno de los dos.
