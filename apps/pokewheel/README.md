# 🔴 PokéRuleta

Ruleta de sorteos: pegas una lista de nombres, giras y sale un ganador. Sin backend, sin cuentas,
sin dependencias — un `index.html`, un `styles.css` y un `app.js`.

**En vivo:** https://cpinan.github.io/MiniApps/apps/pokewheel/

![build](https://img.shields.io/badge/build-2026--08--28.3-informational)
![tests](https://img.shields.io/badge/tests-15%20unit%20%2B%2063%20browser-success)

---

## Cómo se usa

1. **Pega la lista** en el cuadro de participantes y pulsa *Cargar lista* (o *Demo* para probar).
2. **Ajusta las reglas** (intentos, si el seleccionado se retira, etc.).
3. **Pulsa la pokébola** — o cualquier punto de la rueda, o la barra espaciadora.

### Formatos de lista que entiende

| Pegas | Sale |
|---|---|
| `Ash, Misty, Brock` | 3 participantes |
| un nombre por línea | uno por línea |
| `Ash;Misty` · `Ash⇥Misty` | separa por `;` y por tabulador |
| `"Ash","Misty"` (CSV) | quita las comillas |
| `1. Ash` · `- Misty` · `• Brock` | quita la viñeta |
| `Ash Misty Brock` | 3 participantes |
| `Ana Maria, Jose Luis` | **2** participantes, no 4 |

La regla: si el texto trae coma, punto y coma, tabulador o salto de línea, esos mandan. Solo se
parte por espacios cuando no hay ningún otro separador — así los nombres compuestos sobreviven.

### Reglas configurables

| Opción | Qué hace |
|---|---|
| **Intentos** | Cuántas rondas de giro tiene la tanda. |
| **Quitar al seleccionado** | Tras cada giro el elegido sale de la rueda. |
| **El ganador es…** | El último seleccionado, o la lista completa de seleccionados. |
| **Duración del giro** | De 2 a 15 segundos. |
| **Sonido** | Tics durante el giro y fanfarria al ganar (WebAudio, sin archivos). |
| **Quitar repetidos** | Deduplica sin distinguir mayúsculas ni acentos de caja. |
| **Mezclar el orden** | Baraja los gajos al cargar. |

Un clic **siempre** gira: si la tanda ya terminó arranca otra, y si la rueda se quedó vacía
repone a todos los participantes.

### Temas

`Pokémon` · `PokeMMO` · `Neón` · `Pastel` · `Mono` · `Personalizado`

En *Personalizado* eliges tres colores y los 8 gajos se derivan de ellos en HSL siguiendo el arco
de tono más corto, alternando claro y oscuro para que dos gajos vecinos nunca se confundan. El
botón *Al azar* genera una tríada nueva.

### Atajos

| Tecla | Acción |
|---|---|
| `Espacio` | Girar |
| `Esc` | Cerrar el modal |

---

## Si algo se queda pegado: **Reparar app**

Abajo del panel, junto al sello de build. Desregistra todos los service workers, borra todas las
cachés y recarga con `?v=<timestamp>` para saltarse también la caché HTTP.

Es la salida cuando una versión vieja quedó cacheada y sigue mostrando un bug ya corregido.
Comprueba primero el sello de build: si no coincide con el del repo, es exactamente ese caso.

---

## Detalles de implementación

- **El sorteo es justo.** El ganador sale de `crypto.getRandomValues` con muestreo por rechazo
  (`Math.floor(0xFFFFFFFF / n) * n`), no de `Math.random()` ni de un módulo sesgado. La rueda se
  frena *en* el ganador ya elegido: se calcula la rotación destino para que el centro de ese gajo
  quede bajo la flecha, con un pequeño desvío aleatorio dentro del gajo.
- **Un solo canvas para la rueda** (`#wheel`, cuadrado, dentro de su caja) y **otro para los
  efectos** (`#fx`, `position:fixed`, toda la ventana, `z-index:40`). El segundo va por encima
  del modal a propósito: si el confeti queda debajo, parece que no hubiera animación.
- **El giro se puede abortar.** Cada giro lleva un número de generación; cargar una lista nueva
  lo incrementa y el bucle de animación se corta solo en el siguiente frame.
- **Watchdog**: si un giro no termina en `duración + 3 s` (pestaña en segundo plano, un frame que
  falla), el botón se libera solo en vez de quedarse bloqueado.
- **Service worker network-first.** La red manda y la caché es solo el respaldo offline; además
  se autoactualiza y recarga una vez cuando toma el control una versión nueva. En cache-first,
  una corrección no llegaba nunca al que ya había visitado la página.
- **`prefers-reduced-motion`** apaga rayos, trofeo, letras y rebotes; el ganador se muestra igual.

### Archivos

```
apps/pokewheel/
├── index.html            estructura y panel de configuración
├── styles.css            temas por variables CSS + responsive al final de la hoja
├── app.js                parseo, sorteo, canvas, celebración, persistencia
├── sw.js                 service worker network-first
├── manifest.webmanifest  PWA instalable
└── icons/                pokébola 192/512/maskable + favicon SVG
```

---

## Desarrollo

```bash
npm run serve   # http://localhost:8080/apps/pokewheel/
npm test        # las dos suites
```

Un service worker necesita `http://`, no `file://`. Si el puerto 8080 está ocupado, sirve en otro:
`python3 -m http.server 8181`.

**Ojo con los puertos**: el service worker vive por origen. Si un día serviste el proyecto en un
puerto y luego matas ese servidor, la pestaña vieja se sigue sirviendo a sí misma desde la caché.
Usa *Reparar app* o cambia de puerto.

### Tests

- `tests/pokewheel.test.mjs` — 15 casos de lógica pura, extraída del propio `app.js`: parseo,
  dedupe, uniformidad del sorteo y 1600 giros comprobando que la flecha cae siempre en el gajo
  elegido.
- `tests/browser.test.mjs` — 63 casos en Chrome headless por CDP: que la rueda **gira** de verdad
  (hash de píxeles del canvas cambiando), cinco giros seguidos con clics de ratón reales, la
  celebración, el botón de reparar, los temas, los estados del botón y que nada se desborda en
  390×844 ni en apaisado. Se salta solo si no encuentra Chrome.

---

## Licencia

MIT. Pokémon es marca de Nintendo / Creatures / GAME FREAK, y PokeMMO es un proyecto
independiente ajeno a este. Los temas son solo paletas de colores como guiño: sin assets ni
afiliación con ninguno de los dos.
