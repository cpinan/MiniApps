# STATUS — MiniApps

_Última actualización: 2026-08-29 · rama `main` · 0 archivos sin commitear_

## Próxima acción

Construir la app de **temporizador** (`apps/timer/`) siguiendo la Fase 1 de `docs/ROADMAP.md`.

## Estado

- **Seis apps publicadas y verificadas en producción** en https://cpinan.github.io/MiniApps/ —
  `pokewheel` (ruleta), `teams` (equipos), `secretsanta` (amigo secreto), `typechart` (tabla de
  tipos), `bingo` (bolillero) y `pokeprice` (cotizador de PokeMMO). Cada una es PWA instalable y
  offline, con su service worker network-first, sello de build y botón "Reparar app".
- **`apps/pokeprice/` (💰 Cotizador PokeMMO)**: precio de entrenamiento por experiencia hasta nivel
  65 y de crianza 2×31, con tarifas editables, pedido de varias líneas y texto de cotización para
  el cliente. La lógica pura vive en `apps/pokeprice/exp.js` (seis curvas de experiencia de gen
  3+, precios y 169 especies) y los 91 checks en `tests/pokeprice.test.mjs`. La curva va amarrada a
  la especie y se nombra por su experiencia total al nivel 100, que es como la reconoce el jugador.
- **Núcleo compartido** en `assets/shared/` (`base.css` + `core.js`): temas, parseo de listas,
  azar sin sesgo, confeti, sonido y arranque PWA. `pokewheel` es la única que no lo usa: tiene su
  propio CSS/JS porque nació antes y funciona; migrarla no es urgente.
- **339 checks verdes** en siete suites (`npm test`), con chequeos de móvil obligatorios en todas.
- **Donaciones**: `FUNDING.yml`, `DONATE.md`/`DONATE_ES.md` con QR de Yape/Plin, y botón dorado
  animado arriba en el hub y en la cabecera de cada app. No hay banners ni ventanas, y las páginas
  de donación lo prometen por escrito.
- **Plan de lo que sigue**: `docs/ROADMAP.md`, escrito a partir de investigación de mercado
  (categoría de pantalla de aula, sorteos en español, daily puzzles, herramientas client-side y
  tools de PokeMMO). `docs/IDEAS.md` es la lluvia de ideas cruda.
- Tags publicados: `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1`, `v1.3.0`.

## En vuelo

Nada en vuelo. El árbol está limpio, todo está pusheado y `v1.3.0` está desplegado y comprobado
en producción con un navegador de verdad (sin errores de consola, buscador filtrando, curva
bloqueada, precio correcto).

Lo siguiente, ya especificado en `docs/ROADMAP.md` §3 (Fase 1):

- `apps/timer/` — cuenta atrás + cronómetro, presets 1/3/5/10 min, pantalla completa para
  proyector, aviso en los últimos 10 s, modo por turnos. Reutiliza WebAudio y temas de `core.js`.
- `apps/dice/` — notación `2d6+3`, d4–d100, historial y suma.
- `apps/noise/` — micrófono → semáforo con `AnalyserNode`. No graba nada; el permiso se explica
  antes de pedirlo y la app degrada si se deniega.
- Antes de diciembre: botón "enviar por WhatsApp" en `apps/secretsanta/` (`https://wa.me/?text=`).

## Verificar

```bash
tools/verify.sh          # = npm test: 7 suites, 339 checks
python3 -m http.server 8181   # y abrir http://localhost:8181/
```

## Preguntas abiertas

- **Pendiente del usuario**: activar *Settings → General → Features → Sponsorships* en
  github.com/cpinan/MiniApps. Sin ese tick, GitHub ignora `.github/FUNDING.yml` y no dibuja el
  botón *Sponsor*.
- ¿Se migra `pokewheel` al núcleo compartido, o se deja como está?
- **Decidir si se propaga el arreglo de clics a las otras seis suites.** Solo
  `tests/pokeprice.test.mjs` limpia la emulación de móvil al salir y desplaza el elemento a la
  vista antes de pulsar (`hit()`). Las otras seis siguen llamando a `clickReal` directamente y
  pueden fallar por lo mismo. El arreglo limpio sería meter el `scrollIntoView` dentro de
  `clickReal`, en `tests/lib/cdp.mjs:90`, que las cubre todas de una.
- El servidor local del 8181 se apagó al cerrar la sesión. Si una pestaña vieja de
  `localhost:8181` enseña una versión antigua, es el service worker: botón *Reparar app*.

## No repetir

- **No servir el proyecto en un puerto y luego matar el servidor**: el service worker queda
  registrado en ese origen y la pestaña se sigue sirviendo la versión vieja desde caché para
  siempre. Fue el "la ruleta no gira" que costó dos rondas de depuración. Salida: el botón
  *Reparar app*, o cambiar de puerto.
- **No apuntar `--user-data-dir` de Chrome dentro del repo**: metió 2767 archivos basura en cuatro
  commits y rompió `git add` a mitad de una escritura. Los perfiles van a `os.tmpdir()`
  (`tests/lib/cdp.mjs`).
- **No confiar en `[hidden]` sin más**: cualquier `.clase{display:…}` lo derrota por especificidad.
  `assets/shared/base.css` ya fuerza `[hidden]{display:none !important}`.
- **No poner media queries a media hoja**: por igual especificidad ganan las reglas base y los
  tamaños móviles no se aplican. Van al final del archivo.
- **No usar `background-clip:text` con el texto partido en `<span>` hijos**: heredan
  `-webkit-text-fill-color:transparent` y el texto desaparece.
- **No verificar producción con URLs construidas a mano**: un `//` de más hace medir la página
  equivocada y parece un despliegue roto que no lo está.
- **No confiar en `<datalist>` para un buscador**: Chrome esconde las sugerencias cuando el input
  lleva `autocomplete="off"` y Safari apenas filtra, así que el predictivo parece roto sin que haya
  ningún error. `apps/pokeprice/app.js` trae un combobox propio (`initCombo`) que sirve de patrón.
- **No dejar la emulación de móvil puesta al cerrar un test de navegador**: Chrome guarda esa
  ventana en su perfil y la corrida *siguiente* abre con 390 px de alto, así que `clickReal`
  pulsa fuera de pantalla y fallan checks que no tienen nada que ver. Salida:
  `Emulation.clearDeviceMetricsOverride` antes de cerrar, y desplazar el elemento a la vista antes
  de cada clic (`hit()` en `tests/pokeprice.test.mjs`).
