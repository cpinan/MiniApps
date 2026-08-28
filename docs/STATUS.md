# STATUS — MiniApps

_Última actualización: 2026-08-28 · rama `main` · 0 archivos sin commitear_

## Próxima acción

Construir la app de **temporizador** (`apps/timer/`) siguiendo la Fase 1 de `docs/ROADMAP.md`.

## Estado

- **Cinco apps publicadas y verificadas en producción** en https://cpinan.github.io/MiniApps/ —
  `pokewheel` (ruleta), `teams` (equipos), `secretsanta` (amigo secreto), `typechart` (tabla de
  tipos), `bingo` (bolillero). Cada una es PWA instalable y offline, con su service worker
  network-first, sello de build y botón "Reparar app".
- **Núcleo compartido** en `assets/shared/` (`base.css` + `core.js`): temas, parseo de listas,
  azar sin sesgo, confeti, sonido y arranque PWA. `pokewheel` es la única que no lo usa: tiene su
  propio CSS/JS porque nació antes y funciona; migrarla no es urgente.
- **252 checks verdes** en seis suites (`npm test`), con chequeos de móvil obligatorios en todas.
- **Donaciones**: `FUNDING.yml`, `DONATE.md`/`DONATE_ES.md` con QR de Yape/Plin, y botón dorado
  animado arriba en el hub y en la cabecera de cada app. No hay banners ni ventanas, y las páginas
  de donación lo prometen por escrito.
- **Plan de lo que sigue**: `docs/ROADMAP.md`, escrito a partir de investigación de mercado
  (categoría de pantalla de aula, sorteos en español, daily puzzles, herramientas client-side y
  tools de PokeMMO). `docs/IDEAS.md` es la lluvia de ideas cruda.
- Tags publicados: `v1.0.0`, `v1.1.0`, `v1.2.0`, `v1.2.1`.

## En vuelo

Nada en vuelo. El árbol está limpio y todo está pusheado.

Lo siguiente, ya especificado en `docs/ROADMAP.md` §3 (Fase 1):

- `apps/timer/` — cuenta atrás + cronómetro, presets 1/3/5/10 min, pantalla completa para
  proyector, aviso en los últimos 10 s, modo por turnos. Reutiliza WebAudio y temas de `core.js`.
- `apps/dice/` — notación `2d6+3`, d4–d100, historial y suma.
- `apps/noise/` — micrófono → semáforo con `AnalyserNode`. No graba nada; el permiso se explica
  antes de pedirlo y la app degrada si se deniega.
- Antes de diciembre: botón "enviar por WhatsApp" en `apps/secretsanta/` (`https://wa.me/?text=`).

## Verificar

```bash
tools/verify.sh          # = npm test: 6 suites, 252 checks
python3 -m http.server 8181   # y abrir http://localhost:8181/
```

## Preguntas abiertas

- **Pendiente del usuario**: activar *Settings → General → Features → Sponsorships* en
  github.com/cpinan/MiniApps. Sin ese tick, GitHub ignora `.github/FUNDING.yml` y no dibuja el
  botón *Sponsor*.
- ¿Se migra `pokewheel` al núcleo compartido, o se deja como está?

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
