# MiniApps

Colección de minijuegos y miniapps **PWA** (HTML + CSS + JS puro, sin build, sin backend) para
publicar en GitHub Pages y compartir con un link.

👉 **Demo:** https://cpinan.github.io/MiniApps/ *(activa GitHub Pages para que funcione)*

## Apps

| App | Qué hace | Link |
|---|---|---|
| 🔴 **PokéRuleta** | Ruleta de nombres estilo Pokémon: pega la lista, configura intentos y sortea ganadores. | [`apps/pokewheel/`](apps/pokewheel/) |

## PokéRuleta

- **Entrada flexible**: pega los nombres separados por coma, punto y coma, tab, salto de línea o CSV.
  Si el texto no trae ningún separador, se parte por espacios. Quita comillas y viñetas (`1.`, `-`, `•`).
- **Reglas configurables**:
  - *Intentos*: cuántas rondas de giro tiene el sorteo.
  - *Quitar al seleccionado después de cada intento* (on/off).
  - *El ganador es*: el último seleccionado, o la lista completa de seleccionados.
  - Duración del giro, sonido, y tema visual (Pokémon / Neón / Pastel / Mono).
- **Justo**: el ganador sale de `crypto.getRandomValues` con rechazo de rango (sin sesgo modular),
  no de `Math.random()`.
- **Persistencia**: lista, configuración e historial se guardan en `localStorage`.
- **Offline**: service worker con cache del app shell.
- Atajos: `Espacio` gira, `Esc` cierra el modal.

## Correr en local

Un service worker necesita `http://`, no `file://`:

```bash
python3 -m http.server 8080
# abre http://localhost:8080/
```

## Verificar

```bash
node tests/pokewheel.test.mjs
```

Extrae las funciones puras de `app.js` (parseo, aleatoriedad, matemática del giro) y las prueba
sin navegador: 15 casos, incluidos 1600 giros comprobando que la flecha cae siempre en el
segmento elegido.

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

MIT. Pokémon es marca de Nintendo / Creatures / GAME FREAK; este proyecto es fan-art
no oficial y solo usa colores y estilo, sin assets de la franquicia.
