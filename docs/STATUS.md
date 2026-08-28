# STATUS — MiniApps

_Actualizado: 2026-08-28_

## Qué es

Repo de minijuegos / miniapps PWA estáticas para publicar en GitHub Pages y compartir por link.
Sin build, sin dependencias, sin backend. Una carpeta por app en `apps/`, hub en `index.html`.

## Qué ya está hecho

- **Estructura del repo**: `index.html` (hub con tarjetas), `apps/`, `assets/`, `tests/`,
  `.nojekyll`, `LICENSE` (MIT), `README.md`.
- **`apps/pokewheel/` — PokéRuleta** (completa y funcional):
  - `index.html` · `styles.css` · `app.js` · `manifest.webmanifest` · `sw.js` · `icons/`
  - Parseo flexible de nombres (coma, `;`, tab, salto de línea, CSV con comillas, viñetas;
    fallback a espacios sólo si no hay ningún separador → los nombres compuestos sobreviven).
  - Reglas: nº de intentos, quitar-al-seleccionado on/off, ganador = último o todos,
    duración del giro, sonido (WebAudio, sin assets), dedupe, mezclar.
  - 4 temas (pokemon / neon / pastel / mono) por `data-theme` + variables CSS.
  - Ganador con `crypto.getRandomValues` + rechazo de rango (sin sesgo modular).
  - Persistencia en `localStorage`, historial, copiar resultados, confeti, modal.
  - PWA instalable + offline (service worker cache-first, `pokewheel-v1`).
  - Iconos pokébola generados con PIL (192, 512, maskable 512) + favicon SVG.

## Verificado

- `node tests/pokewheel.test.mjs` → 15/15 en verde (parseo, uniformidad del sorteo,
  y 1600 giros comprobando que la flecha cae en el segmento elegido).
- Cross-check: todos los `getElementById` de `app.js` existen en el HTML.
- **Pendiente**: verificación visual en navegador. La extensión de Chrome no estaba conectada
  durante la sesión, así que la UI nunca se abrió.

## Siguiente acción

Servir con `python3 -m http.server 8080`, abrir `http://localhost:8080/apps/pokewheel/`,
hacer un giro real y revisar el render (texto de segmentos con listas largas, tamaño en móvil).
Después: commit, `gh repo create MiniApps --public --source=. --push` y activar Pages.

## Preguntas abiertas

- ¿Tema "custom" con selector de colores del usuario, o bastan los 4 presets?
- ¿Segunda miniapp? El hub ya tiene el hueco de "Próximamente".
