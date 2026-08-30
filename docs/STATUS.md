# STATUS — MiniApps

_Última actualización: 2026-08-30 · rama `main` · 0 archivos sin commitear_

## Próxima acción

Construir la app de **temporizador** (`apps/timer/`) siguiendo la Fase 1 de `docs/ROADMAP.md`.

## Estado

- **Seis apps publicadas y verificadas en producción** en https://cpinan.github.io/MiniApps/ —
  `pokewheel` (ruleta), `teams` (equipos), `secretsanta` (amigo secreto), `typechart` (tabla de
  tipos), `bingo` (bolillero) y `pokeprice` (cotizador de PokeMMO). Cada una es PWA instalable y
  offline, con su service worker network-first, sello de build y botón "Reparar app".
- **`apps/pokeprice/` (💰 Cotizador PokeMMO)**: entrenamiento por experiencia hasta nivel 100 y
  crianza 2×31, con tarifas editables, pedido de varias líneas y texto de cotización. La lógica
  pura vive en `apps/pokeprice/exp.js` (seis curvas de gen 3+, precios y **601 especies**). La
  curva va amarrada a la especie en las dos pestañas; el tope del servicio es el nivel 100 y vive
  en una sola constante, `SERVICE_CAP`.
- **La tabla de especies sale de la ROM**, no de una lista escrita a mano: Pokédex de las cinco
  regiones (649) menos 48 legendarios/míticos, con el grupo de crecimiento tomado de la tabla
  `personal` de la ROM de Black que carga el cliente instalado
  (`~/Library/Application Support/com.pokeemu.macos/pokemmo-client-live/roms/2.nds`, narc
  `a/0/1/6`, byte `0x15`; el sexo está en `0x12`, las evoluciones en `a/0/1/9`). Esa extracción
  corrigió trece curvas que estaban mal y cotizaban mal.
- **El texto de la cotización es un mensaje de WhatsApp, no una ficha técnica**: cada línea del
  pedido guarda `detail` (técnico, para la pantalla) y `short` (para el cliente). El cliente ve
  "• *Arcanine* — entrenar del 1 al 100: *$131.250*"; la EXP, la curva y la tarifa se quedan en la
  app. El rango va siempre entero, con los dos extremos. Las negritas (asteriscos de WhatsApp)
  son cuatro casillas en la pestaña Pedido — Pokémon, precio, total y adelanto—, encendidas de
  fábrica y guardadas con el pedido. Un asterisco escrito a mano en el nombre o en el cliente se
  cae del mensaje: WhatsApp no sabe escaparlo y partiría la negrita.
- **"Entregado entrenado a 100" se cobra por experiencia**, no con tarifa plana:
  `trainedDeliveryPrice()` aplica la tarifa de entrenamiento a la curva entera. Cuesta lo mismo que
  pedir crianza y entrenamiento por separado, y eso está atado con test.
- **Núcleo compartido** en `assets/shared/` (`base.css` + `core.js`). `pokewheel` es la única que
  no lo usa: nació antes y funciona.
- **394 checks verdes** en siete suites (`npm test`), con chequeos de móvil obligatorios.
- **Donaciones**: `FUNDING.yml`, `DONATE.md`/`DONATE_ES.md` con QR de Yape/Plin, y botón dorado en
  el hub y en la cabecera de cada app.
- **Plan de lo que sigue**: `docs/ROADMAP.md`. `docs/IDEAS.md` es la lluvia de ideas cruda.

## En vuelo

Nada en vuelo. Árbol limpio y todo pusheado a `main`.

Lo siguiente, ya especificado en `docs/ROADMAP.md` §3 (Fase 1):

- `apps/timer/` — cuenta atrás + cronómetro, presets 1/3/5/10 min, pantalla completa para
  proyector, aviso en los últimos 10 s, modo por turnos. Reutiliza WebAudio y temas de `core.js`.
- `apps/dice/` — notación `2d6+3`, d4–d100, historial y suma.
- `apps/noise/` — micrófono → semáforo con `AnalyserNode`. No graba nada.
- Antes de diciembre: botón "enviar por WhatsApp" en `apps/secretsanta/` (`https://wa.me/?text=`).

## Verificar

```bash
tools/verify.sh          # = npm test: 7 suites, 394 checks
python3 -m http.server 8181   # y abrir http://localhost:8181/
```

## Preguntas abiertas

- **Falta el tag `v1.3.1`**: el último es `v1.3.0` y ya hay cuatro commits en producción sin
  versión propia — `b9b4314`, `e524836`, `464a1f5` y `4ac709d`. Decisión del usuario.
- **Los legendarios se quedaron fuera** de la tabla de especies (no se obtienen ni se crían en
  PokeMMO). Si algún cliente pide entrenar uno prestado, habría que meterlos como especies
  entrenables pero no criables.
- El precio de "entregado entrenado" (`e524836`) **sube lo que se le cobra al cliente** por ese
  extra. Una cotización vieja en papel ya no cuadra con la app.

## No repetir

- **No hay red en las sesiones de esta máquina**: `curl` a PokeAPI falla con código 000, incluso
  fuera del sandbox. Los datos de Pokémon salen de las ROMs del cliente instalado (arriba) o de
  `~/Projects/PokemonStats/pokestats-pwa/js/data.js`, que trae los nombres del 1 al 1025.
- **No hacer `grep` sin filtro sobre `pokestats-pwa/js/data.js`**: la lista es una sola línea de
  ~40 KB y se come el contexto entero. Parsearla con un script.
- **No escribir grupos de crecimiento de memoria.** Trece de los 169 escritos a mano estaban mal
  (Ampharos, Dusclops, Electivire…). La ROM es la fuente.
- **No devolver la tarifa plana de "entregado entrenado"** (`rates.trained`, campo `rtTrained`):
  cobraba lo mismo para todas las curvas. `restore()` filtra esa clave y hay test que lo prueba.
- **No comparar miles con `1.250.000` en los tests de navegador.** Chrome headless formatea
  `1,250,000`; las comparaciones van por `digits()`.
- **No escribir el tope del servicio a mano en el HTML.** Sale de `SERVICE_CAP` vía `[data-cap]`.
- **No migrar `pokewheel` al núcleo compartido** solo por uniformidad: funciona y no es urgente.
