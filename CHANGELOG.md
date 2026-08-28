# Changelog

Todos los cambios relevantes de este repo. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
[SemVer](https://semver.org/lang/es/).

## [1.0.0] — 2026-08-28

Primera versión publicada. Repo de miniapps PWA estáticas + **PokéRuleta** completa,
en vivo en https://cpinan.github.io/MiniApps/

### Añadido

- **Estructura del repo**: hub en `index.html`, una carpeta autocontenida por app en `apps/`,
  `.nojekyll` para GitHub Pages, `package.json` sin dependencias, MIT.
- **PokéRuleta** (`apps/pokewheel/`): ruleta de sorteos con canvas.
  - Parseo flexible de participantes: coma, punto y coma, tab, salto de línea, CSV con comillas
    y viñetas (`1.`, `-`, `•`). Solo parte por espacios si no hay ningún otro separador, así los
    nombres compuestos sobreviven.
  - Reglas: número de intentos, quitar al seleccionado tras cada intento, ganador = el último o
    todos los seleccionados, duración del giro, sonido, quitar repetidos, mezclar al cargar.
  - Sorteo sin sesgo: `crypto.getRandomValues` con muestreo por rechazo, no `Math.random()`.
  - Historial por ronda, copiar resultados, reiniciar sorteo.
  - Persistencia completa en `localStorage`.
  - PWA instalable y offline, iconos pokébola generados a medida.
- **Temas**: Pokémon, **PokeMMO** (navy + cian + ámbar), Neón, Pastel, Mono y **Personalizado**
  con tres colores del usuario — los 8 gajos se derivan en HSL por el arco de tono más corto,
  alternando claro y oscuro para que dos vecinos no se confundan. Botón "Al azar".
- **Celebración del ganador**: anillo expansivo, confeti y el nombre entrando letra a letra.
  Al cerrar la tanda escala a oro, estrellas, serpentinas en tres oleadas, trofeo, fanfarria
  larga y título con brillo. La pokébola y la flecha rebotan. Todo se queda quieto con
  `prefers-reduced-motion`.
- **Móvil**: la ruleta va primero, limitada por alto de pantalla (también apaisado), objetivos
  táctiles de 44px, inputs de 16px para que iOS no haga zoom, y safe-area del notch.
- **Botón "Reparar app"**: desregistra service workers, borra cachés y recarga con `?v=` para
  saltarse también la caché HTTP.
- **Tests sin dependencias**: 15 casos de lógica pura y 63 de navegador (Chrome headless por CDP).

### Corregido

- **La ruleta no volvía a girar**: al completar los intentos, `spin()` salía por `return` y el
  botón quedaba muerto; `restore()` recargaba esa ronda cerrada desde `localStorage`, así que al
  recargar la página nacía bloqueada. Ahora un clic siempre gira y la ronda persistida se limita
  al restaurar.
- **Service worker cache-first**: congelaba `app.js` y `styles.css` de la primera visita, así que
  ninguna corrección llegaba al usuario. Ahora es network-first con la caché solo como respaldo,
  y se autoactualiza (`controllerchange` → una recarga).
- **La celebración no se veía**: el confeti se dibujaba en un canvas recortado a la rueda y el
  modal lo tapaba en el mismo frame. Ahora la capa es `position:fixed` a pantalla completa por
  encima del modal, y el modal espera 520 ms.
- **Nombre del ganador invisible** en la celebración final: `background-clip:text` en el `<h2>`
  mientras las letras son `<span>` hijos sin fondo. Sustituido por oro con brillo pulsante.
- **Selectores de color siempre visibles**: `.colors{display:flex}` ganaba al `[hidden]`.
- **Media queries a media hoja**: por igual especificidad ganaban las reglas base y los tamaños
  móviles no se aplicaban. Movidas al final.
- **Giro que se corta a medias** (pestaña en segundo plano, frame que falla): un watchdog libera
  el botón en vez de dejarlo bloqueado.
- **Cargar lista dejaba el sorteo anterior a medias**: ahora corta el giro en curso mediante
  contador de generación, cierra el modal, limpia el confeti y devuelve la rueda a cero.

### Cambiado

- La pokébola es solo clickeable: no arrastrable ni seleccionable, con estados idle, hover,
  pressed y disabled, más anillo de foco para teclado.
- La línea de ronda tiene aire por encima de la rueda.

[1.0.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.0.0
