# Plan de las próximas MiniApps

Escrito el 2026-08-28 a partir de investigación de lo que la gente usa y busca hoy, no de
intuición. Las cinco apps actuales (ruleta, equipos, amigo secreto, tabla de tipos, bolillero)
salieron de una lista de ideas; esto ordena lo que sigue y dice por qué.

---

## 1. Lo que dice la investigación

### 1.1 El nicho de aula es el más denso y el más rentable en uso diario

Hay una categoría entera de "pantalla de clase": un mismo sitio con temporizador, selector de
nombres, medidor de ruido, dados, generador de grupos, semáforo y bingo, pensado para proyectar.
[Classroomscreen](https://classroomscreen.com/) cobra ~36 USD/año por su plan Pro;
[MyClassScreen](https://myclassscreen.org/) responde con 40+ widgets gratis y sin cuentas de
alumno, [MinuteBell](https://www.minutebell.com/for-teachers) con el mismo argumento ("sin cuenta,
sin setup, cierras la pestaña"), y hay medidores de ruido sueltos en
[GoTimer](https://gotimer.org/classroom/noise-meter),
[KiwiBee](https://kiwibee.io/en/tools/sound/noise-meter) y hasta
[ClassDojo](https://www.classdojo.com/toolkit/noisemeter/).

**Lectura**: el mercado ya validó que estas herramientas se usan a diario y que el modelo gratis
sin cuentas es el que gana usuarios. MiniApps ya tiene 3 de esos widgets (ruleta = selector de
nombres, equipos = generador de grupos, bolillero). Faltan los tres más usados: **temporizador**,
**dados** y **medidor de ruido**.

### 1.2 Sorteos en español: volumen enorme, competencia que pide datos

[drawnames](https://www.drawnames.com/es) declara **42 millones de nombres sorteados en 2025**.
[Amigo Secreto Online](https://amigosecretoonline.com/) se vende como multicanal (WhatsApp,
Telegram, correo) y "sin registro"; [PiliApp](https://es.piliapp.com/random/wheel/) y
[sorteados.online](https://lat.sorteados.online/) cubren la ruleta genérica.

**Lectura**: la demanda es estacional pero brutal, y casi todos piden correo o mandan los datos a
un servidor. Nuestro amigo secreto ya es el argumento contrario (la asignación viaja en el
fragmento de la URL). Lo que falta no es otra app: es **hacer que se encuentre** antes de
diciembre y añadir el reparto por WhatsApp, que es como se organiza esto en LATAM.

### 1.3 Los daily puzzle son un ritual, no un one-hit

La categoría maduró: NYT Connections desplazó a Wordle como el primero que se juega, y en 2026 no
hubo un nuevo éxito rompedor; el patrón es "varios puzzles cortos al día"
([análisis de la categoría](https://www.summerengine.com/blog/games-like-wordle),
[lista de variantes](https://github.com/rarelygoeshere/WordleWeb)).

**Lectura**: entrar con un clon genérico en inglés es tarde. Entrar con **un puzzle diario en
español**, con palabra derivada de la fecha (misma para todos, sin servidor) y resultado
compartible en emojis, sigue teniendo hueco — el trabajo real es curar la lista de palabras.

### 1.4 "Se procesa en tu navegador" ya es un argumento de venta

Hay sitios enteros construidos solo sobre eso: compresión de imágenes, QR, contraseñas,
conversores JSON/CSV, todo client-side y sin subir nada
([ZeroUpload](https://zeroupload.net/), [Runtime Hub](https://runtime-hub.com/),
[OffCloud](https://www.offcloud.tools/),
[24 herramientas sin subida](https://xueboyang1985.github.io/free-browser-tools/)). El mercado de
generadores de QR pasó de 6.790 a 7.830 millones de USD en un año.

**Lectura**: es exactamente lo que MiniApps ya es por arquitectura. Un par de utilidades de este
tipo aprovechan la promesa que ya cumplimos, y son las que más fácil se comparten en un chat de
trabajo.

### 1.5 En PokeMMO lo que se usa son calculadoras, no listas

Lo que la comunidad tiene abierto mientras juega:
[catch calculator](https://pokemmohub.com/tools/catch-calculator/) y
[breeding simulator](https://pokemmohub.com/tools/breeding/) de PokeMMO Hub,
[CatchCalc](https://c4vv.github.io/CatchCalc/), [pokemmo-breeding](https://www.pokemmo-breeding.com/)
y [pokemmo.help](https://pokemmo.help/capture-chance).

**Lectura**: la tabla de tipos que ya publicamos cubre la consulta más frecuente. El siguiente
escalón real es una **calculadora de captura offline** — todas las existentes son webs con red, y
se consulta justo cuando el Pokémon ya está en pantalla.

---

## 2. Cómo se decide qué entra

Además de los criterios del repo (estática, offline, compartible, sin assets ajenos), cada
candidata se puntúa 1–5 en:

| Criterio | Qué mide |
|---|---|
| **Uso** | ¿Se abre a diario o una vez al año? |
| **Reutilización** | ¿Cuánto de `assets/shared` y de las apps ya hechas aprovecha? |
| **Diferencial** | ¿Por qué la nuestra y no la que ya existe? Casi siempre: sin cuenta, sin red, sin anuncios |
| **Esfuerzo** | 🟢 una sesión · 🟡 dos o tres · 🔴 más |
| **Riesgo** | Permisos, datos con dueño, curación manual, mantenimiento |

| Candidata | Uso | Reutil. | Diferencial | Esfuerzo | Riesgo |
|---|:--:|:--:|:--:|:--:|---|
| Temporizador de aula | 5 | 4 | 4 | 🟢 | ninguno |
| Dados | 4 | 4 | 3 | 🟢 | ninguno |
| Medidor de ruido | 4 | 3 | 4 | 🟡 | permiso de micrófono |
| Marcador TCG | 3 | 4 | 4 | 🟢 | ninguno |
| Calculadora de captura | 4 | 3 | 5 | 🟡 | datos de especies |
| QR sin subida | 4 | 2 | 4 | 🟡 | ninguno |
| Compresor de imágenes | 4 | 2 | 4 | 🟡 | rendimiento en móvil |
| Puzzle diario en español | 5 | 3 | 3 | 🔴 | curar palabras |

---

## 3. Roadmap

### Fase 1 — Completar la pantalla de clase (lo que más se usa)

1. **⏱️ Temporizador** 🟢 — cuenta atrás y cronómetro, presets (1/3/5/10 min), pantalla completa
   con números gigantes para proyector, aviso sonoro y visual en los últimos 10 s, y modo
   "por turnos" que pasa al siguiente participante al tocar. Reutiliza WebAudio, temas y el shell
   PWA; comparte lista de participantes con la ruleta.
2. **🎲 Dados** 🟢 — notación `2d6+3`, dados de 4/6/8/10/12/20/100, tirada con animación, historial
   y suma. Reutiliza el azar sin sesgo y la celebración.
3. **🔊 Medidor de ruido** 🟡 — micrófono → semáforo verde/ámbar/rojo con umbral ajustable.
   **Nada se graba ni se sube**: solo se lee el nivel RMS con `AnalyserNode`. El permiso se pide al
   pulsar, se explica antes, y la app funciona (en gris) si se deniega.

Con estas tres, MiniApps cubre el set completo que venden los sitios de pago.

### Fase 2 — Mesa y gaming

4. **🧮 Marcador TCG** 🟢 — dos jugadores, daño, contadores, cartas de premio, dado y moneda,
   pantalla en horizontal y bloqueo de apagado (`WakeLock`). El tema PokeMMO le queda natural.
5. **🎯 Calculadora de captura (PokeMMO)** 🟡 — fórmula de captura de gen 3/4 con ball, estado y
   HP restante. Los datos de especies se limitan a una tabla propia de *catch rate* de las especies
   más buscadas, con entrada manual como alternativa: así no dependemos de ninguna API ni de
   dataset ajeno.

### Fase 3 — Utilidades "no sube nada"

6. **🔳 QR sin subida** 🟡 — texto, URL, wifi y vCard; genera en canvas, descarga PNG/SVG, sin red.
7. **🖼️ Compresor de imágenes** 🟡 — redimensiona y recomprime a WebP/AVIF con `canvas` +
   `createImageBitmap`, comparación antes/después y peso ahorrado. Todo local.
8. **🎨 Generador de paletas** 🟢 — armonías y contraste WCAG; el código HSL del tema personalizado
   ya hace la mitad.

### Fase 4 — Retención

9. **🟩 Puzzle diario en español** 🔴 — palabra derivada de la fecha (misma para todos sin
   servidor), teclado en pantalla, racha local y resultado en emojis. El trabajo está en curar
   ~2.000 palabras de cinco letras sin tildes raras.

### Transversal, antes de diciembre

- **Amigo secreto**: botón "enviar por WhatsApp" por persona (`https://wa.me/?text=`), que es como
  se reparte esto en LATAM, y una portada explicando el modelo sin servidor.
- **Descubribilidad**: `<title>`/`description` propios por app (ya están), `sitemap.xml`,
  Open Graph con imagen por app, y una línea en el hub explicando qué es MiniApps.

---

## 4. Lo que no vamos a hacer

- **Nada con cuentas, ranking global ni backend.** Todo el repo se apoya en no tenerlo.
- **Nada que dependa de una API en vivo** (PokéAPI, precios de mercado, clima): rompe el offline y
  se cae sola con el tiempo.
- **Nada con sprites, gritos ni música de la franquicia.** Los temas imitan colores; ahí está la
  línea.
- **Nada que grabe audio o vídeo.** El medidor de ruido lee el nivel y no guarda ni un byte.
- **Ni un banner de donación.** El botón de la cabecera es todo lo que va a haber.

## 5. Definición de "hecha" (igual para todas)

1. Carpeta propia en `apps/`, con `sw.js` network-first, manifest, iconos y sello de build.
2. Lógica sin DOM en su módulo, importable desde los tests.
3. Suite propia con `tests/lib/cdp.mjs`, **incluyendo siempre** los chequeos de móvil: sin scroll
   horizontal, targets ≥44px, inputs ≥16px, apaisado.
4. Tarjeta en el hub, fila en el README y entrada en el CHANGELOG.
5. Verificada en producción, no solo en local.

## 6. Orden recomendado

**Temporizador → Dados → Medidor de ruido** cierra el set de aula, que es donde la investigación
muestra uso diario y competencia de pago. Después **WhatsApp en el amigo secreto** (llega antes de
diciembre) y **marcador TCG**. Las utilidades sin subida y el puzzle diario, después.
