# Ideas para las próximas miniapps

Criterios que tiene que cumplir cualquier candidata para vivir en este repo:

- **Estática**: HTML + CSS + JS, sin build, sin dependencias, sin backend.
- **Se explica en una frase** y se entiende en 10 segundos sin tutorial.
- **Compartible por link**: sirve para que alguien la use una vez y la mande a su grupo.
- **Offline**: instalable como PWA, útil sin conexión.
- **Sin assets de terceros**: nada de sprites ni audio con dueño. Colores y estilo sí; assets no.

Esfuerzo: 🟢 una sesión · 🟡 dos o tres · 🔴 más.

---

> **Estado**: ya hechas ✅ Repartidor de equipos · Amigo secreto · Tabla de tipos · Bolillero.
>
> Este archivo es la lluvia de ideas. El plan priorizado, con la investigación de mercado detrás,
> está en [ROADMAP.md](ROADMAP.md).

## Recomendadas (reutilizan lo que ya está hecho)

### 1. 🎲 Repartidor de equipos — ✅ hecho
Pega la lista, di cuántos equipos, y reparte. Balancea por número, permite fijar capitanes,
bloquear que dos personas caigan juntas, y re-repartir sin recargar.
**Reutiliza**: el parser de listas, el sorteo sin sesgo, la persistencia, la celebración.
**Por qué**: es la petición que sigue a la ruleta en clases, torneos y pichangas. La mitad del
código ya existe.

### 2. 🎁 Amigo secreto sin servidor — ✅ hecho
Pega la lista, marca exclusiones ("estos dos ya se regalan entre ellos"), y genera **un link por
persona**: el nombre asignado va cifrado en el fragmento de la URL, que nunca viaja al servidor.
Cada uno abre el suyo y solo ve su resultado.
**Reutiliza**: parser, sorteo, temas.
**Por qué**: la versión con backend es la norma; hacerlo sin backend es el gancho. Estacional
(diciembre), así que conviene tenerlo listo antes.

### 3. 🔢 Bolillero / bingo — ✅ hecho
Saca números sin repetir de 1 a N, con historial visible, número gigante en pantalla y cartones
imprimibles. Modo "cantado" con voz del navegador (`speechSynthesis`, sin archivos de audio).
**Reutiliza**: rueda de sorteo, celebración, sonido.

### 4. ⏱️ Temporizador de turnos — 🟢
Cuenta atrás por participante para juegos de mesa, debates o exposiciones: toca la pantalla y pasa
al siguiente. Suena distinto en los últimos 10 segundos.
**Reutiliza**: WebAudio, temas, pantalla completa.
**Por qué**: es la app que la gente busca a mitad de una partida y termina usando una web con
anuncios.

---

## Para la comunidad de PokeMMO / TCG (tu público ya existente)

### 5. 🛡️ Tabla de tipos offline — ✅ hecho
Eliges tipo(s) atacante/defensor y salen los multiplicadores. Datos propios (una tabla de 18×18
que se escribe a mano), sin API, sin sprites: cero riesgo de assets ajenos.
**Por qué**: es lo que un jugador consulta a mitad de combate, y todas las webs que lo dan son
lentas y con anuncios. Enlaza natural con tu repo `pokemmostats`.

### 6. 🧮 Contador de vida / marcador TCG — 🟢
Marcador para dos jugadores: daño, contadores, cartas de premio, dado y moneda integrados,
bloqueo de pantalla para que no se apague. Horizontal, una mitad por jugador.
**Reutiliza**: temas (el de PokeMMO le queda bien), WebAudio.

### 7. 🎯 Ruleta de retos / "¿qué juego toca?" — 🟢
La misma ruleta pero con listas guardadas y compartibles por URL (la lista viaja comprimida en el
hash). Sortea el mapa, el reto, la comida, el juego.
**Reutiliza**: literalmente la ruleta; es un preset encima.

---

## Juegos cortos

### 8. 🧠 Memoria — 🟡
Parejas con emojis (sin assets con dueño), 3 tamaños de tablero, contador de movimientos y mejor
marca local. Un modo de dos jugadores por turnos en el mismo teléfono.

### 9. ⚡ Test de reflejos — 🟢
"Pulsa cuando cambie de color", 5 intentos, promedio y percentil contra tus propias marcas. Se
comparte solo: la gente reta a otro en el momento.

### 10. 🟩 Adivina la palabra (tipo Wordle) en español — 🟡
Lista de palabras local, una por día derivada de la fecha (misma palabra para todos sin servidor),
y resultado compartible en emojis.
**Ojo**: la lista de palabras hay que curarla a mano; ahí está el trabajo real.

### 11. 🏆 Tier list arrastrable — 🟡
Filas S/A/B/C/D, arrastras elementos (texto o imágenes que sube el usuario, procesadas en local) y
exportas a PNG con `canvas`. Muy compartible.
**Ojo**: arrastrar bien en móvil es la mitad del trabajo.

### 12. 🎨 Generador de paletas — 🟢
Base + armonías (complementaria, tríada, análoga), contraste WCAG calculado, exporta CSS/JSON.
**Reutiliza**: el código HSL del tema personalizado de la ruleta, que ya hace justo esto.

---

## Descartadas y por qué

- **Cualquier cosa con sprites, gritos o música de la franquicia** — assets con dueño. Los temas
  imitan colores, no contenido, y ahí está la línea.
- **Apps que necesitan API en vivo** (PokéAPI, clima, cotizaciones) — rompen el offline y añaden
  una dependencia que se cae sola con el tiempo.
- **Cualquier cosa con cuentas o ranking global** — necesita backend, y el repo entero está
  construido sobre no tenerlo.

---

## Qué sigue

Las cuatro recomendadas ya están publicadas. De las que quedan, las más rentables por
reutilización son el **temporizador de turnos** (WebAudio y temas ya están) y el **generador de
paletas** (el código HSL del tema personalizado ya hace justo eso).
