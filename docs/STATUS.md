# STATUS — MiniApps

_Actualizado: 2026-08-28_

## Qué es

Repo de minijuegos / miniapps PWA estáticas. Sin build, sin dependencias, sin backend.
Una carpeta por app en `apps/`, hub en `index.html`.

- **Repo**: https://github.com/cpinan/MiniApps (público)
- **En vivo**: https://cpinan.github.io/MiniApps/
- **App**: https://cpinan.github.io/MiniApps/apps/pokewheel/

## Estado: PokéRuleta funcionando y publicada

- Parseo flexible (coma, `;`, tab, salto de línea, CSV, viñetas; espacios solo si no hay
  otro separador, así los nombres compuestos sobreviven).
- Reglas: nº de intentos, quitar-al-seleccionado, ganador = último o todos, duración,
  sonido, dedupe, mezclar.
- Temas: 4 presets + **personalizado** con 3 colores (paleta de 8 gajos derivada en HSL).
- Móvil: ruleta primero, limitada por alto de pantalla, táctiles 44px, inputs 16px, safe-area.
- Sorteo con `crypto.getRandomValues` + rechazo de rango. Persistencia en `localStorage`.
- PWA instalable, service worker **network-first** (cache-first dejaba pegada la versión vieja).

## Bugs corregidos en esta sesión

1. **La ruleta no giraba**: al completar los intentos, `spin()` salía por `return` y el botón
   quedaba muerto; `restore()` recargaba esa ronda cerrada desde `localStorage`, así que tras
   recargar la página nacía bloqueada. Ahora un clic siempre gira (abre tanda nueva o repone
   participantes) y avisa bajo la rueda, no en el panel lateral.
2. **Service worker cache-first**: congelaba `app.js`/`styles.css` de la primera visita.
3. **Selectores de color siempre visibles**: `.colors{display:flex}` ganaba al `[hidden]`.
4. **Media queries a media hoja**: por igual especificidad ganaban las reglas base y los
   tamaños móviles no se aplicaban. Movidas al final.

## Verificado

- `npm test` → `tests/pokewheel.test.mjs` 15/15 y `tests/browser.test.mjs` 63/63 en verde.
  La suite de navegador prueba que la rueda **gira** de verdad (hash de píxeles del canvas),
  el modal del ganador, el segundo giro tras cerrar la tanda, los colores personalizados y
  que nada se desborda en 390×844 ni apaisado.
- Sitio en producción probado con Chrome headless: gira, corona ganador y registra el SW.

## Añadido después de publicar

- Celebración del ganador (anillo + confeti; final con oro, estrellas, serpentinas, trofeo,
  fanfarria larga y nombre letra a letra). `prefers-reduced-motion` la deja estática.
- Cargar lista reinicia todo: corta el giro en curso por contador de generación, cierra modal,
  limpia confeti y devuelve la rueda a rotación cero.
- Pokébola click-only con estados idle / hover / pressed / disabled + anillo de foco.
- Watchdog: si un giro se corta a medias, el botón se libera solo.
- Service worker auto-actualizable (`controllerchange` → una recarga) y sello de build visible.
- Bug corregido: en la celebración final el nombre salía invisible (`background-clip:text` en el
  `<h2>` con las letras en `<span>` hijos). Ahora es oro con brillo pulsante.

## Última tanda de cambios (build 2026-08-28.3)

- **Botón "Reparar app"** junto al sello de build: desregistra service workers, borra todas las
  cachés y recarga con `?v=` para saltar también la caché HTTP. Es la salida cuando un SW viejo
  dejó pegada una versión con bugs — justo lo que pasó en `localhost:8123` tras matar el server.
- **La celebración ya se ve**: el confeti se dibujaba en un canvas recortado a la rueda y el
  modal lo tapaba al instante. Ahora es una capa `position:fixed` a pantalla completa con
  `z-index:40` (por encima del modal, `z-index:20`), la pokébola y la flecha rebotan al coronar,
  y el modal espera 520 ms para que se vea el estallido.
- **Tema PokeMMO**: navy oscuro, paneles pizarra, acento cian, ámbar de detalle y 8 gajos con
  aire de tipos. Solo colores, sin assets ni afiliación.

## Siguiente acción

Decidir la segunda miniapp (el hub ya tiene la tarjeta "Próximamente").

## Ideas pendientes

- Compartir resultado por link/imagen.
- Sonidos y sprite de pokébola girando en el centro.
