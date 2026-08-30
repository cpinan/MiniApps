# Changelog

Todos los cambios relevantes de este repo. Formato basado en
[Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y
[SemVer](https://semver.org/lang/es/).

## [1.4.0] — 2026-08-30

### Añadido

- **💰 Cotizador PokeMMO**: el mensaje al cliente sale con las **negritas de WhatsApp** puestas, y
  se elige cuáles. Cinco casillas en la pestaña *Pedido* —Pokémon, precio, total, adelanto y
  descuento—, encendidas de fábrica y guardadas junto al pedido; el subtotal se queda siempre en
  plano, porque lo que se resalta es la rebaja. La cantidad y el "c/u" quedan fuera de los
  asteriscos: WhatsApp corta la negrita cuando el marcador toca un espacio. Un asterisco escrito
  a mano en la especie o en el nombre del cliente se cae del mensaje —no hay forma de escaparlo—,
  aunque en la pantalla el nombre se sigue viendo tal cual se escribió.
- **💰 Cotizador PokeMMO**: la tabla de especies pasa de 169 escritas a mano a las **601 criables**
  del juego — el Pokédex de las cinco regiones (Kanto a Teselia) menos los legendarios, que no se
  obtienen en PokeMMO. Ya salen las preevoluciones y las especies poco pedidas: Growlithe, Gible,
  Dratini, Ralts, Feebas, Nidoran hembra/macho… Los grupos de crecimiento se sacaron de la tabla
  `personal` de la ROM de Black que carga el propio cliente (`a/0/1/6`, byte `0x15`), así que son
  exactamente los del juego. La dificultad de crianza se hereda dentro de la familia evolutiva
  (Gible es rara como Garchomp) y las especies sin género se marcan solas.

### Cambiado

- **💰 Cotizador PokeMMO**: el texto que se le pega al cliente pasa de tres líneas por servicio a
  una. Se va la experiencia, el nombre de la curva y la línea de tarifa —datos de quien cotiza, no
  del cliente— y queda "• *Arcanine* — entrenar del 1 al 100: *$131.250*". El subtotal solo aparece
  si hay descuento. El desglose completo sigue en pantalla, en la lista del pedido.
- **💰 Cotizador PokeMMO**: la línea del mensaje dice **el rango entero** — "entrenar del 1 al 100",
  no "entrenar hasta nivel 100" —, y el extra de crianza pasa de "ya entrenado a 100" a "entrenado
  del 1 al 100", que la cría también sale del huevo en el nivel 1. Sin el punto de partida, un
  trabajo desde cero y uno que se recoge en el nivel 40 se leían igual en el mensaje aunque
  cuesten la mitad el uno del otro.
- **💰 Cotizador PokeMMO**: **"entregado entrenado a 100" se cobra por experiencia**, no con una
  tarifa plana. `trainedDeliveryPrice()` aplica la tarifa de entrenamiento a la curva entera de la
  especie, así que pedir la crianza con entrega entrenada cuesta lo mismo que pedir crianza y
  entrenamiento por separado. Antes eran 40.000 para todas las curvas: un Metagross entrenado
  costaba lo mismo que un Blissey, que necesita la mitad de experiencia. **Sube lo que se le cobra
  al cliente por ese extra**, así que una cotización vieja en papel ya no cuadra con la app. El
  campo de la tarifa plana (`rates.trained`) desaparece de *Tarifas* y un guardado antiguo no
  puede revivirlo.
- **💰 Cotizador PokeMMO**: el tope del servicio pasa del **nivel 65 al nivel 100**. Afecta al
  nivel objetivo del entrenamiento (por defecto y máximo), al techo de "hasta dónde le alcanza al
  cliente", al extra de crianza "entregado entrenado a" y al texto de la cotización. El tope vive
  en una sola constante (`SERVICE_CAP` en `apps/pokeprice/exp.js`) y la pantalla lo escribe desde
  ahí, así que no queda ningún 65 a mano en el HTML.

### Corregido

- **💰 Cotizador PokeMMO**: **trece especies tenían la curva equivocada** y por tanto se cotizaban
  mal — Ampharos, Mantine, Dusclops, Dusknoir, Electivire, Magmortar, Toxicroak, Drapion,
  Jellicent, Klinklang, Golurk, Leavanny y Scolipede. Ahora cuadran con la ROM. También se marca
  Starmie como sin género (solo cruza con Ditto).

## [1.3.0] — 2026-08-29

### Añadido

- **💰 Cotizador PokeMMO** (`apps/pokeprice/`): calculadora de precios para quien vende servicios
  en PokeMMO. Dos servicios en una app:
  - **Entrenamiento por experiencia hasta nivel 65.** Tarifa *X por cada Y de experiencia*, con
    redondeo por bloque empezado o proporcional y un mínimo por Pokémon. La experiencia sale de las
    seis curvas de gen 3+ (errática, rápida, media rápida, media lenta, lenta y fluctuante)
    implementadas con las fórmulas del juego, no con una tabla copiada. Se puede partir del nivel
    actual o de la experiencia total exacta, y cambiar de modo conserva el mismo punto. Cada curva
    se nombra por su **experiencia total al nivel 100** — 1.059.860, 1.250.000… —, que es como la
    reconoce el jugador dentro de PokeMMO, no por su nombre técnico. La curva **va amarrada a la
    especie**: si el Pokémon está en la tabla, su curva es la suya y el desplegable queda
    bloqueado; solo se elige a mano cuando la especie no está en la lista.
  - **Crianza 2×31**: base más recargo por especie, y extras por naturaleza, sexo, movimientos
    huevo, IVs adicionales y entrega ya entrenado.
  - **Pedido con varias líneas**, descuento, adelanto y un texto de cotización listo para copiar o
    compartir con el cliente.
  - Extra para vender: se escribe el presupuesto del cliente y la app dice hasta qué nivel llega.
- Tabla de 169 especies, ordenada alfabéticamente, con su curva de experiencia y una dificultad de
  crianza sugerida (común / rara / sin género).
- **Buscador de especies propio** en vez de `<datalist>`: filtra según se escribe (primero las que
  empiezan igual, después las que contienen el trozo), se abre entero como catálogo, se maneja con
  flechas y Enter, y enseña la curva junto a cada nombre. El `<datalist>` nativo no servía: Chrome
  esconde sus sugerencias cuando el input lleva `autocomplete="off"` y Safari apenas filtra. La curva siempre se puede elegir a mano, así que una especie que no
  esté en la tabla no bloquea nada.
- 91 checks nuevos en `tests/pokeprice.test.mjs`, incluidos los seis totales de experiencia al
  nivel 100 y la reversibilidad nivel ⇄ experiencia en los 600 niveles de las seis curvas.

### Corregido

- Los tests de navegador que emulaban un móvil dejaban esa ventana guardada en el perfil de Chrome,
  así que la corrida siguiente abría con 390 px de alto y los clics por coordenadas caían fuera de
  pantalla. Ahora la emulación se limpia al terminar y cada clic desplaza el elemento a la vista.

## [1.2.1] — 2026-08-28

### Cambiado

- **El botón de donar se ve.** Pasa a ser un botón dorado con latido lento, brillo que lo recorre
  cada pocos segundos y la taza moviéndose; antes era un icono gris que además quedaba flotando a
  media cabecera, porque el enlace y el botón de tema se repartían el espacio libre con dos
  `margin-left:auto`. Ahora va pegado a Tema, al borde derecho.
- **En el hub sube arriba**: cabecera propia fija con la marca y el botón, en vez de un enlace de
  texto perdido en el pie.
- Con `prefers-reduced-motion` se ve igual pero sin animación, y hay tests que lo comprueban.

## [1.2.0] — 2026-08-28

### Añadido

- **Enlace de donación en la cabecera de las cinco apps**: un ☕ discreto que abre `DONATE_ES.md`
  en una pestaña nueva (`rel="noopener"`), con etiqueta accesible y área táctil de 44px en móvil.
  Nada de ventanas, banners ni recordatorios; las páginas de donación lo dejan por escrito.

## [1.1.0] — 2026-08-28

Cuatro miniapps nuevas y un núcleo compartido.

### Añadido

- **🎲 Repartidor de equipos** (`apps/teams/`): reparte una lista en equipos parejos por número de
  equipos o por tamaño. Capitanes que caen uno por equipo, parejas que no deben coincidir
  (reintentando el reparto), y aviso honesto cuando una restricción es imposible. El estado viaja
  en el fragmento de la URL, así que un link lleva la lista y la configuración.
- **🎁 Amigo secreto** (`apps/secretsanta/`): sorteo en un único ciclo — cada uno regala al
  siguiente y el último al primero —, lo que de una sola vez descarta autoregalos, gente sin
  regalo y parejas mutuas A→B/B→A. Un link por persona con **solo** su asignación en el fragmento
  de la URL, que el navegador nunca manda al servidor: ni el organizador ve quién le tocó a quién.
  Se abre como un sobre lacrado que hay que tocar.
- **🛡️ Tabla de tipos** (`apps/typechart/`): los 18 tipos en tres vistas — qué pega fuerte a qué,
  qué recibe un defensor de uno o dos tipos, y la matriz 18×18 con cabeceras fijas que scrollea
  dentro de su caja en el móvil. Tabla escrita a mano, sin API: funciona sin señal.
- **🔢 Bolillero** (`apps/bingo/`): bingo de 30/50/75/90 sin repeticiones, que canta cada número
  con la voz del propio navegador (sin archivos de audio), con tablero, historial, modo automático
  y partida que sobrevive a la recarga.
- **Núcleo compartido** (`assets/shared/`): `base.css` con los temas y el responsive, y `core.js`
  con el parseo de listas, el azar sin sesgo, los temas, el confeti, el sonido y el arranque PWA
  (sello de build, botón Reparar, service worker autoactualizable).
- **Arnés de tests compartido** (`tests/lib/cdp.mjs`) y una suite por app, todas con chequeos de
  móvil obligatorios: sin scroll horizontal, targets ≥44px, inputs ≥16px y apaisado.
- `tools/make-icons.py`: genera los iconos de cada app con PIL, sin assets de terceros.

### Corregido

- **`[hidden]` perdía por especificidad** en toda la base: cualquier `.clase{display:…}` lo
  derrotaba y el elemento seguía ocupando sitio. En el amigo secreto eso dejaba el panel del
  organizador en pantalla en modo sobre y empujaba el sobre fuera del viewport.
- **Pegar un link personal estando ya en la app** solo cambiaba el hash, así que el documento no
  se re-ejecutaba y el modo sobre nunca aparecía.
- **Número de equipo ilegible** cuando el color del equipo era casi blanco: ahora el texto del
  contador se calcula por luminancia.

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

[1.4.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.4.0
[1.3.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.3.0
[1.2.1]: https://github.com/cpinan/MiniApps/releases/tag/v1.2.1
[1.2.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.2.0
[1.1.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.1.0
[1.0.0]: https://github.com/cpinan/MiniApps/releases/tag/v1.0.0
