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
| 💰 **Cotizador PokeMMO** | Precio de entrenamiento por experiencia hasta nivel 100 y de crianza 2×31, con tus tarifas y la cotización lista para pegar. | [abrir](https://cpinan.github.io/MiniApps/apps/pokeprice/) |
| 🔢 **Bolillero** | Bingo: saca números sin repetir y los canta con la voz del navegador. | [abrir](https://cpinan.github.io/MiniApps/apps/bingo/) |

Historial de cambios en [CHANGELOG.md](CHANGELOG.md). Plan de lo que viene, con la investigación
detrás, en [docs/ROADMAP.md](docs/ROADMAP.md); la lluvia de ideas en [docs/IDEAS.md](docs/IDEAS.md).

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

## Cotizador PokeMMO

`apps/pokeprice/` — la calculadora de un vendedor de servicios de PokeMMO, no un pokédex.

- **Entrenamiento por experiencia.** La tarifa es *X por cada Y de experiencia*, configurable, con
  el bloque empezado cobrado entero o al detalle, y un mínimo por Pokémon opcional. El tope del
  servicio es el **nivel 100**.
- **La experiencia sale de la curva real** de gen 3+, la que usa PokeMMO: errática, rápida, media
  rápida, media lenta, lenta y fluctuante. Los seis totales al nivel 100 (600.000 · 800.000 ·
  1.000.000 · 1.059.860 · 1.250.000 · 1.640.000) están cubiertos por tests, porque si una curva
  está mal toda la app cobra mal.
- **Se parte del nivel o de la experiencia exacta.** Un cliente que dice "tengo 200.000 de exp"
  no paga lo mismo que uno que dice "estoy en nivel 54", y cambiar de modo conserva el punto.
- **Cuánto le alcanza al cliente**: se escribe su presupuesto y sale hasta qué nivel llega.
- **Crianza 2×31**: precio base más recargo por especie, con extras por naturaleza, sexo,
  movimientos huevo, IVs de más y entrega ya entrenado a 100.
- **La curva va amarrada al Pokémon.** La tabla trae las **601 especies criables** de PokeMMO —
  el Pokédex entero de Kanto a Teselia menos los legendarios, que no se obtienen en el juego —,
  ordenada alfabéticamente, con su curva de experiencia y una dificultad de crianza — común, rara,
  o sin género y por tanto solo criable con Ditto. Las curvas salen de la tabla `personal` de la
  ROM de Black que usa el propio cliente, no de una lista escrita a mano. Si la especie está en la tabla su curva manda y el desplegable queda
  bloqueado; solo se elige a mano cuando la especie no está. La dificultad, en cambio, es criterio
  de mercado y se edita en *Tarifas*.
- **Cada curva se nombra por su experiencia total al nivel 100** — 1.059.860, 1.250.000… —, que es
  como la reconoce el jugador dentro del juego, y no por su nombre técnico.
- **Buscador propio, no `<datalist>`**: filtra al escribir, se abre entero como catálogo, va con
  flechas y Enter y enseña la curva junto a cada nombre. El nativo no valía — Chrome esconde las
  sugerencias cuando el input lleva `autocomplete="off"`.
- **Pedido y cotización**: se acumulan entrenamientos y crianzas, se aplica descuento y adelanto,
  y sale un texto plano listo para copiar o compartir con el cliente.
- Todo vive en `localStorage`: las tarifas son tuyas y no salen del dispositivo.

## Correr en local

Un service worker necesita `http://`, no `file://`:

```bash
python3 -m http.server 8080
# abre http://localhost:8080/
```

## Verificar

```bash
tools/verify.sh          # todo: 7 suites, 339 checks
npm test                 # lo mismo
npm run test:prices      # una suite suelta
```

Sin dependencias: `node` y (para las suites de navegador) Chrome instalado. Las suites que
necesitan Chrome se saltan solas si no lo encuentran.

| Suite | Qué cubre |
|---|---|
| `tests/pokewheel.test.mjs` | Funciones puras de la ruleta: parseo, aleatoriedad y matemática del giro, con 1600 giros comprobando que la flecha cae siempre en el segmento elegido. |
| `tests/browser.test.mjs` | La ruleta en Chrome headless: que **gira** de verdad (hash de píxeles del canvas cambiando a mitad del giro), el modal, volver a girar tras cerrar una tanda con clics reales, la celebración y el botón *Reparar app*. |
| `tests/teams.test.mjs` | Reparto en equipos parejos, capitanes, parejas prohibidas y el estado que viaja en la URL. |
| `tests/secretsanta.test.mjs` | El ciclo único del sorteo y que cada link lleva solo su propia asignación. |
| `tests/typechart.test.mjs` | Exactitud de la tabla de tipos, incluidos los duales, y la matriz 18×18. |
| `tests/bingo.test.mjs` | Que no se repite ningún número, el tablero y el modo automático. |
| `tests/pokeprice.test.mjs` | Las seis curvas de experiencia contra los totales conocidos del juego, la reversibilidad nivel ⇄ experiencia en los 600 niveles, los precios, el buscador de especies y la cotización. |

**Toda suite nueva lleva chequeos de móvil**: sin scroll horizontal, targets ≥44 px, inputs ≥16 px
y apaisado.

`tests/lib/cdp.mjs` se encarga de dos trampas que ya costaron una depuración cada una, así que
ninguna suite tiene que acordarse de ellas:

- **El perfil de Chrome se borra en cada arranque.** Una suite que emula un móvil deja esa ventana
  guardada en el perfil, y la corrida *siguiente* abría con 390 px de alto: los clics por
  coordenadas caían fuera de pantalla y fallaban checks que no tenían nada que ver.
- **`clickReal` lleva el elemento a la vista antes de pulsar**, y comprueba que el punto de clic es
  suyo de verdad. Con `block:'nearest'` el elemento queda pegado al borde de arriba, que es donde
  vive la cabecera sticky de todas las apps: contaba como visible y el clic se lo comía la
  cabecera. Si el punto está tapado, se centra y se vuelve a mirar.

Y una tercera que no es del arnés:

- **No confiar en `<datalist>`** para un buscador: Chrome esconde sus sugerencias cuando el input
  lleva `autocomplete="off"` y Safari apenas filtra, así que el predictivo parece roto sin que
  haya ningún error. `apps/pokeprice/app.js` trae un combobox propio (`initCombo`) que sirve de
  patrón.

## Publicar en GitHub Pages

El repo ya está publicado: cada push a `main` despliega en
https://cpinan.github.io/MiniApps/ en un par de minutos. Settings → Pages está en *Deploy from a
branch* → `main` / `root`, y el `.nojekyll` evita que Pages procese nada.

Tras un despliegue, comprobar con la URL tal cual — un `//` de más mide la página equivocada y
parece un despliegue roto que no lo está.

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
**Reparar app**. La lógica testeable de cada una vive en su módulo puro (`split.js`, `draw.js`,
`types.js`, `exp.js`) para poder probarla sin navegador.

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
([English](DONATE.md)). El botón **☕ Donar** está arriba en el hub y en la cabecera de cada app,
y no hace nada más: ni ventanas, ni banners, ni recordatorios, ni cuenta cuántas veces la usaste.

Lo que más ayuda no cuesta nada: una estrella al repo, compartir el link, o mandar una miniapp.

## Licencia

MIT. Pokémon es marca de Nintendo / Creatures / GAME FREAK, y PokeMMO es un proyecto
independiente ajeno a este; los temas son solo paletas de colores como guiño, sin assets ni
afiliación con ninguno de los dos.
