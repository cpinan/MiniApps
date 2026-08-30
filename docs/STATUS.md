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
  pura vive en `apps/pokeprice/exp.js` (seis curvas de gen 3+, precios y 169 especies). La curva va
  amarrada a la especie **en las dos pestañas** y se nombra por su experiencia total al nivel 100,
  que es como la reconoce el jugador. El tope del servicio es el **nivel 100** y vive en una sola
  constante, `SERVICE_CAP` en `exp.js`.
- **"Entregado entrenado a 100" se cobra por experiencia**, no con tarifa plana: la cría nace en el
  nivel 1 con 0 EXP, así que `trainedDeliveryPrice()` aplica la tarifa de entrenamiento a la curva
  entera (Lento 125.000 vs Errático 60.000 con 5.000/50.000). Cuesta exactamente lo mismo que pedir
  crianza y entrenamiento por separado, y eso está atado con test.
- **Núcleo compartido** en `assets/shared/` (`base.css` + `core.js`): temas, parseo de listas,
  azar sin sesgo, confeti, sonido y arranque PWA. `pokewheel` es la única que no lo usa: tiene su
  propio CSS/JS porque nació antes y funciona; migrarla no es urgente.
- **368 checks verdes** en siete suites (`npm test`), con chequeos de móvil obligatorios en todas.
- **El arnés de navegador es de fiar**: `tests/lib/cdp.mjs` borra el perfil de Chrome en cada
  arranque y `clickReal` lleva el elemento a la vista y comprueba que el clic es suyo.
- **Donaciones**: `FUNDING.yml`, `DONATE.md`/`DONATE_ES.md` con QR de Yape/Plin, y botón dorado
  animado arriba en el hub y en la cabecera de cada app. No hay banners ni ventanas.
- **Plan de lo que sigue**: `docs/ROADMAP.md`. `docs/IDEAS.md` es la lluvia de ideas cruda.

## En vuelo

Nada en vuelo. Árbol limpio y `e524836` (crianza entrenada cobrada por experiencia) pusheado a
`main`; el build de Pages salió `built` para ese commit el 2026-08-30 00:54 UTC.

Lo siguiente, ya especificado en `docs/ROADMAP.md` §3 (Fase 1):

- `apps/timer/` — cuenta atrás + cronómetro, presets 1/3/5/10 min, pantalla completa para
  proyector, aviso en los últimos 10 s, modo por turnos. Reutiliza WebAudio y temas de `core.js`.
- `apps/dice/` — notación `2d6+3`, d4–d100, historial y suma.
- `apps/noise/` — micrófono → semáforo con `AnalyserNode`. No graba nada; el permiso se explica
  antes de pedirlo y la app degrada si se deniega.
- Antes de diciembre: botón "enviar por WhatsApp" en `apps/secretsanta/` (`https://wa.me/?text=`).

## Verificar

```bash
tools/verify.sh          # = npm test: 7 suites, 368 checks
python3 -m http.server 8181   # y abrir http://localhost:8181/
```

## Preguntas abiertas

- **Falta el tag `v1.3.1`**: el último es `v1.3.0` y ya hay dos commits en producción sin versión
  propia — `b9b4314` (tope del cotizador a nivel 100) y `e524836` (crianza entrenada por
  experiencia). Crearlo cierra el ciclo; decisión del usuario.
- El cambio de precio de `e524836` **sube lo que se le cobra al cliente** por ese extra (de 40.000
  fijos a 60.000–165.000 según curva). Si algún cliente tenía una cotización vieja en la mano, ya
  no cuadra con la app.

## No repetir

- **No devolver la tarifa plana de "entregado entrenado"** (`rates.trained`, campo `rtTrained`).
  Estaba mal por diseño: cobraba lo mismo para todas las curvas. `restore()` filtra las claves de
  tarifas que ya no existen justo para que un guardado viejo no la reviva; hay test que lo prueba.
- **No comparar miles con `1.250.000` en los tests de navegador.** Chrome headless formatea
  `1,250,000` y el Chrome del usuario `1.250.000`; las comparaciones van por `digits()`.
- **No escribir el tope del servicio a mano en el HTML.** Sale de `SERVICE_CAP` vía `[data-cap]` y
  `fillStatic()`, y hay un check que falla si aparece un número suelto.
- **No migrar `pokewheel` al núcleo compartido** solo por uniformidad: funciona y no es urgente.
