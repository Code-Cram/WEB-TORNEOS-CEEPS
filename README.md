# Torneos CEEPS

Web para organizar los torneos y actividades del Consejo de Estudiantes de la Escuela Politécnica Superior (UAM): los torneos de **fútbol sala**, **mus** y **póker** y **cualquier otra actividad** que se cree desde el panel (una chocolatada solidaria, una charla, un torneo de ping-pong…). Funciona en el móvil y en el ordenador, en **español y en inglés** (para Erasmus): cada uno la ve en el idioma de su móvil y lo cambia con los botones ES / EN. El panel del Consejo va siempre en español.

- Cada participante entra con el correo con el que se inscribió y ve lo suyo: cuadro eliminatorio, mesas de póker, horarios, lugares, premios, resultados y clasificación (se actualizan solos) y, en las actividades, la información para todos y su nota personal (p. ej. su recompensa).
- Cada persona tiene un **perfil**, que se abre tocando su nombre en un equipo, una pareja o una mesa: sus torneos y actividades del año, cómo le va (partidos, puesto en su mesa), sus compañeros, sus títulos y las ediciones anteriores en las que jugó. Lo ve cualquiera que haya entrado en la web.
- El Consejo lo gestiona todo desde el **panel de admin**: importar las inscripciones (CSV de Microsoft Forms), añadir o quitar participantes, sortear, apuntar resultados, cambiar fechas, lugares y avisos, crear actividades y cerrar ediciones.
- **Dar por finalizado** un torneo: desde ese momento lo ve todo el que entra en la web, con el ganador destacado.
- Lista de **ganadores** de cada edición y **archivo** con una copia completa de cada edición cerrada (solo para el Consejo).
- Ningún correo ni teléfono llega al navegador de los participantes.

Hecha con [Next.js](https://nextjs.org), [Drizzle ORM](https://orm.drizzle.team) y PostgreSQL. Se puede alojar gratis en [Vercel](https://vercel.com) + [Supabase](https://supabase.com).

## Probarla en tu ordenador

La forma rápida, con datos inventados: `npm install` y `npm run preparar` (crea `.env.local`, las tablas, las migraciones y los participantes de prueba; usa el PostgreSQL del sistema o el de Docker, `npm run db:up`), y después `npm run dev`. Sin instalar nada, en GitHub Codespaces. Todo esto, y cómo proponer cambios, en [CONTRIBUTING.md](CONTRIBUTING.md).

Paso a paso: necesitas [Node.js](https://nodejs.org) 22 o superior y PostgreSQL.

1. Instala las dependencias y crea tu configuración:

   ```bash
   npm install
   cp .env.example .env.local
   ```

   Rellena `.env.local` (ver [Configuración](#configuración)).

2. Crea la base de datos, una sola vez. Con el PostgreSQL del sistema (en Ubuntu, `sudo apt install postgresql`):

   ```bash
   sudo -u postgres psql -c "CREATE ROLE ceeps LOGIN PASSWORD 'ceeps'" -c "CREATE DATABASE torneos OWNER ceeps"
   ```

   O con Docker: `npm run db:up` y cambia el puerto de `DATABASE_URL` a 5433.

3. Crea las tablas y arranca:

   ```bash
   npm run db:push   # crea las tablas
   npm run dev       # http://localhost:3000
   ```

Para tener datos de prueba: `npm run db:inventar` mete participantes inventados (correos `@example.com`) en una base de datos vacía; `npm run db:seed` importa los CSV de inscripción que haya en la carpeta superior (`../*.csv`; otra carpeta con `CSV_DIR=/ruta`) y `npm run db:demo` sortea los torneos y mete resultados inventados (solo funciona con una base de datos local). Con `npm run db:seed -- --simular` solo enseña qué cambiaría, sin escribir nada.

> Si `npm run dev` falla con «Failed to open database», para el servidor y borra la carpeta `.next`.

## Configuración

| Variable         | Qué es                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | Cadena de conexión de PostgreSQL.                                                                |
| `SESSION_SECRET` | Secreto para firmar las sesiones. Genera uno con `openssl rand -base64 32`.                      |
| `ADMIN_EMAILS`   | Correos que pueden entrar siempre al panel, separados por comas. El resto de admins se añaden desde el propio panel (🔑 Acceso). |
| `ADMIN_PASSWORD` | Contraseña común del panel. Además de ser admin, hay que escribirla para entrar.                 |

Opcional, para que los correos automáticos (las plazas de la reserva del póker) salgan solos: `SMTP_HOST`, `SMTP_PUERTO` (587 por defecto), `SMTP_USUARIO`, `SMTP_CLAVE` y `CORREO_REMITENTE` (por defecto `consejo.estudiantes.eps@uam.es`). Sin ellas, los correos esperan en **Panel → Correos** con un botón para mandarlos a mano.

Nunca subas tus ficheros `.env` ni los CSV de inscripción: tienen datos personales y ya están en `.gitignore`.

## Ponerla en internet (gratis)

1. **Base de datos en Supabase.** Crea un proyecto. En *Connect* copia la cadena del **Session pooler** y guárdala en `.env.supabase` (copia `.env.supabase.example`). Después:

   ```bash
   npm run supabase:push   # crea las tablas
   npm run supabase:seed   # opcional: importa los CSV
   ```

2. **Web en Vercel.** Sube el código a GitHub, impórtalo en Vercel (*Add New → Project*) y añade las variables de [Configuración](#configuración). En `DATABASE_URL` usa la cadena del **Transaction pooler** (puerto 6543). Si la contraseña tiene símbolos, codifícalos (`@` → `%40`, `#` → `%23`, `$` → `%24`…).

3. Cada `git push` a `main` vuelve a desplegar la web. **Si cambias una variable en Vercel, vuelve a desplegar** (*Deployments → Redeploy*) para que se aplique.

Los cambios de la base de datos van en `sql/`, un fichero por cambio que empieza por la fecha. **Se aplican solos al desplegar en producción**, antes de compilar (`scripts/migrar.mts`, dentro de `npm run build`), y quedan apuntados en la tabla `migraciones`: un push publica a la vez el código y la base de datos. Si uno falla, no se publica nada y sigue la versión anterior. Tienen que poder repetirse sin problema (`IF NOT EXISTS`, rellenar solo lo vacío…) y no borrar nada: lo que borra datos va en `sql/a-mano/` y se pega a mano en el *SQL Editor* de Supabase. En local, `npm run db:migrar` aplica los que falten en la base de `.env.local`.

Las funciones se ejecutan en Dublín (`vercel.json`), cerca de la base de datos de Supabase en `eu-west-1`.

## Uso durante el torneo

Todo desde el panel (`/admin`, botón «Admin» al entrar con el correo de un admin):

1. **Información de cada torneo**: calendario, lugar, formato, premios, enlace y cierre de inscripción, y un aviso destacado para cambios de última hora. En «🇬🇧 Versión en inglés» se escribe lo que ve quien tiene la web en inglés; lo que se deja vacío sale con el texto por defecto en inglés (mientras no se cambie el español) o, si no, en español. Los premios, uno por línea empezando por el puesto (`1º Tarjeta regalo de 100 €`, también `1º-4º`); las líneas que empiezan por `-` son detalles del premio de encima y el resto, notas para todos.
   La **chuleta de reglas** de cada torneo también se escribe ahí, una idea por línea: `Título: texto` pone el título en negrita, `- …` son viñetas, `1. …` pasos numerados en casillas, `Nota: …` va en pequeño al final y `**texto**` en negrita. Si se deja vacía, no sale.
2. **Importar** las inscripciones: el CSV de Forms (o el Excel de Forms guardado como CSV) y súbelo. Se pueden subir varios a la vez; reimportar es seguro (no duplica ni pisa tus correcciones). Las parejas de mus incompletas no se importan, y un equipo inscrito dos veces con distinto capitán (mismo nombre y casi la misma plantilla) cuenta como uno, con la inscripción más reciente.
3. **Personas**: **añadir personas** con su correo, una a una o pegando una lista (vale copiar dos columnas de un Excel), a un equipo de fútbol, a la lista de reserva o a las plazas del póker (si hay un asiento libre en una mesa de su día, se sienta sola) o a una actividad; se guardan al momento, pueden entrar en la web en cuanto se apuntan y, si se marca, reciben un correo con el enlace. Lista completa con buscador y filtros, botón para copiar los correos (para el CCO de un email), descarga en Excel, corrección de nombres y correos (el nombre cambia también en sus equipos, parejas, mesas y actividades) y una sección con quien todavía no tiene correo para ponérselo.
   **Correos**: los correos de todos los participantes por grupos (todos, cada torneo, capitanes, cada mitad del cuadro del mus, cada día del póker, la lista de reserva y cada actividad) para escribirles en CCO: «Copiar» los copia y «Escribir» abre el programa de correo con todos en copia oculta.
4. **Equipos, parejas y jugadores**: crear, renombrar, cambiar plantillas y borrar (con confirmación). **⇄ Intercambiar** cambia de sitio a dos equipos, parejas o participantes del cuadro, o a dos jugadores de póker entre mesas, sin volver a sortear (si uno no estaba, ocupa el sitio del otro; esos cruces pierden el resultado y el resto se recalcula). En **Cruces y resultados** (fútbol y mus) hay libertad total: en cualquier cruce de cualquier ronda, también en la final y en el del 3er puesto, se puede poner a mano a cualquier equipo o pareja (o a nadie); lo puesto a mano sale en naranja y se queda aunque cambien los resultados, hasta que se vuelve a elegir «Automático» (el ganador del cruce anterior). En póker, también renombrar turnos si cambia una fecha (se ordenan por fecha: «Martes 10 nov» antes que «Jueves 12 nov») y decidir si la **lista de reserva** puede entrar en la web (por defecto no: quien está en reserva no entra con su correo, salvo que juegue a otro torneo, y se le explica que está en reserva).
   **Plazas automáticas** (póker, activado por defecto): si un jugador dice que no viene, 12 horas antes de su mesa la plaza pasa al primero de la lista de reserva que pueda ese día; si no ha contestado, 6 horas antes. Los dos reciben un correo, sale un aviso en el chat de ese día y queda en el registro. No se aplica a la mesa final ni a mesas ya empezadas, y se puede apagar en **Póker → Plazas automáticas**.
   **Mesa final** (póker): en *Póker → Mesas*, «A la mesa final pasan» el ganador de cada mesa o, si se juegan menos mesas, los dos primeros: el segundo de cada mesa se marca con un 2 en «Puesto» y se sienta en los asientos de las mesas que no se juegan (con 4 mesas, del 5 al 8), sin cambiar de sitio aunque los resultados se apunten en otro orden.
5. **Sortear** (hay que escribir `SORTEAR` para confirmar). Si no hay participantes para llenar el cuadro, el sorteo reparte pases directos; la web explica cómo queda (p. ej. 12 equipos → cuadro de 16 con 4 pases directos). En el mus, las parejas que pierden en semifinales juegan por el **3er y 4º puesto** (se activa o se quita para cada torneo en su «Información del torneo»; vale para el siguiente sorteo).
6. **Apuntar** fechas, lugares y resultados. **Fechas por bloques** pone la misma fecha y lugar a una mitad del cuadro (hasta su semifinal), a una ronda o a la final de una vez. El ganador avanza solo y la clasificación se calcula sola (campeón, subcampeón y, con 3er puesto, 3º y 4º).
   **Calendario** junta en una página, por días, todos los partidos, mesas y eventos para cambiar fecha, hora y lugar en la misma lista, y **mueve un día entero** a otro (huelgas, cambios de aula) manteniendo las horas.
   **Calendario** (fútbol): en la página del fútbol, debajo de la clasificación (y con un botón arriba), un calendario por semanas con la mañana (hasta las 14:00) y la tarde de cada día, dentro del horario de la pista (por defecto de 8:00 a 18:00, lo que da Deportes; se cambia en el panel), de lunes a viernes, entre el primer y el último día que ponga el Consejo. El capitán de cada equipo marca las mañanas y tardes que le vienen bien, o abre «Horas concretas» y marca una hora; se guarda solo. La **fecha prevista** de cada partido sale sola de lo que marcan los dos equipos (si uno no ha marcado nada, cuenta lo que puso en la inscripción; si aún no se sabe el rival, lo de todos los que pueden llegar): cada ronda después de la anterior, como mucho dos partidos por día y con la idea de jugar cuartos y semifinales antes del día objetivo (se pone en el panel). Se recalcula cada vez que alguien marca algo o cambia el cuadro, salvo lo previsto para las próximas 24 horas, que ya no se mueve. Después, un capitán confirma la fecha prevista (o propone otra hora) y el capitán rival la acepta, la rechaza o propone otra (y entonces la primera queda rechazada y el otro capitán recibe la nueva: solo hay una propuesta viva por partido); al aceptarla, el partido queda con esa fecha, se avisa en el chat del día y se prepara un correo para los dos. En *Fútbol → 📅 Calendario y reservas de pista*: el primer y el último día, el horario de la pista, el día objetivo, los **huecos que da Deportes** (si se apuntan, solo esos se pueden marcar, prever y reservar), los días u horas cerrados, las fechas previstas, los capitanes que aún no han marcado nada y las propuestas (se pueden anular).
7. **Asistencia**: cada equipo (lo confirma el capitán), pareja (cualquiera de los dos), jugador de póker o participante de una actividad (si es un equipo, cualquiera de él) confirma en su página si viene el próximo día que juega o que es el evento, con un comentario si quiere. La respuesta vale para ese día: si cambia la fecha de su partido, su mesa o el evento, o pasa a jugar otro día (una final), se le vuelve a preguntar. Solo se pregunta por lo que tiene fecha: partidos, mesas y, en los eventos, la «Fecha y hora» de su ficha. En **Asistencia** están los recuentos de cada día, los correos de quien no ha respondido (para recordárselo) y botones para apuntar a mano lo que alguien avise por otro lado.
8. **Chat**: cada torneo y actividad tiene un botón «💬 Chat» en su página. Lo público va por días: cada uno lee y escribe en la sala del próximo día que juega (la final, los finalistas). En privado se escribe al Consejo. En **Chat** del panel contestáis los privados (primero los que tienen algo sin leer), escribís en la sala de un día o a todos los de un torneo, y podéis borrar cualquier mensaje (queda en el registro). Los mensajes llegan solos cada pocos segundos y nadie puede mandar más de 8 por minuto.
   Los **cambios se avisan solos**: al cambiar una fecha, un lugar, un cruce o una mesa, sale un mensaje del Consejo (🔔) en la sala de cada día afectado.
9. **Redes**: publicaciones que se preparan solas con lo que pasa en los torneos: el aviso destacado de cada torneo y actividad (un cambio de lugar o de fecha), qué se juega hoy y los próximos días, cada resultado, cómo queda cada cuadro, la mesa final del póker y los campeones. Cada una trae el texto para el canal de WhatsApp (con negritas y el enlace), el de X (cabe en 280 caracteres) y el pie de Instagram con sus hashtags, y su imagen para historia (1080 × 1920) y para post (1080 × 1350). Copiar, descargar y publicar.
10. **Dar por finalizado** cuando acabe: lo ve todo el que entra en la web, con el ganador arriba (se puede reabrir).
11. **Nueva edición** (con el nombre escrito para confirmar): el ganador pasa a la lista de ganadores, se guarda una copia completa en el archivo y el torneo queda vacío para la siguiente edición.
12. **🔑 Acceso**: quién es admin. Cualquier admin añade a otros con su correo (aunque no jueguen a nada pueden entrar en la web) y los quita; quien se quita pierde el acceso al momento. Los de `ADMIN_EMAILS` lo son siempre y no se quitan desde aquí. Todos entran con la misma contraseña del panel.
    **Acceso para IA**: cada admin crea una clave y conecta el asistente de IA que use (cualquiera que admita servidores MCP o «conectores personalizados») a `https://…/api/mcp`, con la cabecera `Authorization: Bearer <clave>` (o, si solo admite una dirección, `…/api/mcp/<clave>`). Desde ahí el asistente consulta (resumen, cuadros, mesas, agenda, asistencia, la web y sus textos) y cambia lo de todos los días (fechas y lugares, resultados de fútbol y mus, avisos de cada torneo y para todos, textos, páginas y mensajes en el chat) con las mismas acciones del panel: mismas comprobaciones, avisos en el chat y registro, que apunta «con IA» y el nombre de la clave. No ve correos ni teléfonos ni puede sortear, borrar o gestionar personas. Es gratis para el Consejo (cada uno usa su asistente); la clave solo se enseña al crearla, se revoca en el momento y deja de valer si su dueño deja de ser admin.
13. **🎨 Web**: lo que se ve en toda la web de los participantes, sin tocar código (todo queda en el registro):
    - **Aviso para todos**, arriba de cada página y de la portada (en español y, si se quiere, en inglés).
    - **Textos**: cualquier texto de la web de los participantes (botones, explicaciones, avisos de error…), en español y en inglés. Se busca tal como sale en la web y se escribe el nuevo; lo que va entre llaves (`{fecha}`, `{n}`…) es donde la web pone el dato y no se puede quitar. Vacío, vuelve el de siempre. Son los de `en.ts` (todo lo que pasa por `t()`).
    - **Páginas** libres (normas generales, contacto, preguntas frecuentes…) en `/p/…`: públicas, solo para quien ha entrado o en borrador (solo el Consejo). Mismo formato que la chuleta de reglas, más `# Título` para los apartados; las webs y los correos salen como enlaces. Se enlazan en la portada (las públicas) y en el inicio de cada participante.
    - **Nombre** («Torneos» + «CEEPS» destacado) y **quién organiza**: portada, cabeceras, pestaña del navegador, asunto y firma de los correos e imágenes y etiquetas para redes.
    - **Logos**: el principal y los tres del pie (SVG, PNG o JPG de hasta 500 KB; los SVG con código se rechazan), con su texto alternativo; los del pie se pueden esconder.
    - **Colores** de toda la web, con aviso si un texto se va a leer mal. El panel se queda siempre con los colores de siempre.

### Actividades

En el panel, **Actividades → +**. Cada actividad tiene nombre, icono, fechas, lugar, fecha y hora (con ella, en los eventos, sus participantes confirman si vienen), de qué va, un texto para todos los participantes (p. ej. «Tu recompensa: chocolate con bizcocho») y un estado (borrador, activa o terminada), con su versión en inglés si se quiere. Hay dos tipos:

- **Evento con lista**: se apunta a la gente uno a uno (pensado para hacerlo desde el móvil en el propio evento), pegando una lista o con el CSV de un Forms. Cada persona puede tener una **nota personal** que solo ve ella.
- **Torneo eliminatorio**, individual o por equipos: con sorteo, cuadro, resultados por puntos y clasificación, como el fútbol y el mus.

Quien está en una actividad puede entrar en la web con su correo aunque no juegue a ningún torneo, y solo ve las actividades en las que está.

En el resumen del panel quedan los **últimos cambios**: quién hizo qué, incluidos los cambios de plantilla de los capitanes, las descargas de datos y los intentos fallidos de contraseña.

Formato de plantillas y parejas: una persona por línea, con el correo entre `< >` si lo tiene.

```
Nombre Apellido <nombre.apellido@estudiante.uam.es>
Otro Nombre
```

## Seguridad

- Se entra con el correo de inscripción, **sin código de verificación**: quien sepa el correo de otra persona puede entrar como ella y, si es capitán, cambiar su plantilla (queda registrado en el panel). Es un equilibrio buscado entre comodidad y riesgo para un torneo entre estudiantes.
- El panel exige ser admin (estar en `ADMIN_EMAILS` o haber sido añadido en 🔑 Acceso) **y** la contraseña. Tras 10 intentos fallidos en 15 minutos se bloquea; **cambiar `ADMIN_PASSWORD` cierra todas las sesiones de admin abiertas**. Usa una contraseña larga.
- En el chat sale el nombre de la inscripción, no el que cada uno escribe al entrar. Aun así, con el acceso solo por correo, quien sepa el correo de otra persona podría escribir en su nombre: el Consejo puede borrar cualquier mensaje.
- Ningún correo ni teléfono se envía a los navegadores de los participantes: los perfiles se enlazan con un identificador al azar (`usuarios.perfil`), nunca con el correo. Las tablas tienen RLS activado, así que la API pública de Supabase no puede leerlas.
- Cada acción del servidor comprueba los permisos y valida los datos; la web envía cabeceras contra clickjacking y similares.
- El acceso para IA (`/api/mcp`) solo responde con una clave válida de un admin. De cada clave se guarda solo su huella (sha256). Lo que devuelve no lleva correos ni teléfonos, y lo que cambia queda en el registro como «con IA».
- Los logos subidos se comprueban por su contenido (SVG, PNG o JPG; los SVG con código se rechazan) y se sirven con una política que no deja ejecutar nada.

## Pruebas

En GitHub, cada pull request y cada push a `main` pasan solas estas comprobaciones y, además, una base de datos desde cero con todas las migraciones y datos inventados, y el build (`.github/workflows/comprobar.yml`).

```bash
npm run comprobar  # todo lo de abajo de una vez
npm test           # lógica: cuadros, sorteos, mesas, asistencia, correos, importación, migraciones, seguridad
npm run typecheck
npm run lint
```

## Cómo está organizado el código

- `src/app/`: solo las rutas (páginas, API y diseño general). Cada página junta lo de su apartado; la lógica está en `src/modulos/`.
- `src/modulos/<apartado>/`: todo lo de una parte de la web en su carpeta. Dentro, cada fichero tiene un papel fijo:
  - `config.ts`: valores fijos (nombres, cupos…).
  - `logica.ts` y similares (`sala.ts`, `mesas.ts`…): lógica sin base de datos; es lo que prueban los tests de `tests/`.
  - `datos.ts`: consultas a la base de datos (solo en el servidor).
  - `operaciones.ts`: cambios que usan varias acciones o los scripts (sorteos, recálculos…).
  - `acciones.ts`: acciones del servidor que usan los participantes; `acciones-consejo.ts` / `acciones-admin.ts`, las del panel.
  - `tipos.ts`: los datos tal como se mandan al navegador (sin correos ni teléfonos).
  - `*.tsx`: las piezas de pantalla de ese apartado.
- `src/db/`: tablas (`schema.ts`), conexión y reglas de las migraciones de `sql/`.

| Apartado | Qué hace |
| --- | --- |
| `acceso` | Entrar con el correo, sesiones, panel con contraseña y en qué está inscrito cada uno. |
| `torneos` | Lo común a los tres torneos: configuración, ficha, premios, chuleta de reglas, página del torneo, sorteo, finalizar y nuevas ediciones. |
| `cuadros` | Eliminatorias (fútbol, mus y torneos de actividades): sorteo, avance, 3er puesto, fechas por bloques, intercambiar y la vista del cuadro. |
| `futbol`, `mus`, `poker` | Lo propio de cada torneo: datos, sorteos y recálculos, acciones del panel; en el fútbol, el calendario: huecos (`reservas.ts`), fechas previstas (`prevision*.ts`), lo que marcan y reservan los capitanes (`acciones-reservas.ts`, `reservas-datos.ts`) y la pantalla (`calendario-reservas.tsx`); en el póker, mesas, mesa final, reserva, plazas automáticas y su vista. |
| `actividades` | Actividades creadas desde el panel (eventos con lista y torneos). |
| `asistencia` | Confirmación de asistencia por días: la tarjeta, sus respuestas y el panel. |
| `chat` | Salas por día, privados con el Consejo, avisos y avisos automáticos de cambios. |
| `calendario` | Todas las fechas en una página y mover un día entero. |
| `personas` | Personas y correos (añadir, lista, correcciones, grupos para escribir en CCO, descarga en Excel), el formato de plantillas y el perfil de cada una. |
| `correo` | Bandeja de correos automáticos: se guardan y se mandan por SMTP (o a mano desde el panel). |
| `redes` | Publicaciones para WhatsApp, X e Instagram y sus imágenes (las fuentes, con licencia OFL, en `fuentes/`). |
| `importacion` | Leer los CSV de Forms e importarlos sin duplicar ni pisar correcciones. |
| `ia` | Acceso para IA: servidor MCP en `/api/mcp` (protocolo en `protocolo.ts`, sin base de datos; herramientas en `herramientas.ts`, que llaman a las acciones del panel), claves (solo se guarda su huella) y su sección del panel. |
| `panel` | Piezas comunes del panel: marco, formularios con resultado, intercambiar y validación de lo que llega del navegador. |
| `idioma` | Español e inglés: el idioma de cada uno, los botones ES / EN y las traducciones (`en.ts`), con los textos cambiados desde el panel por delante. |
| `web` | La web editable desde el panel (🎨 Web): aviso para todos, textos, páginas libres (`/p/…`), nombre, logos (se sirven en `/logos/…`) y colores. Sin nada guardado, todo sale como siempre (`config.ts`). |
| `compartido` | Utilidades de toda la web: fechas, textos, cabecera, ventanas y refresco. |

## Adaptarla a tu asociación

- Desde el panel, sin código: nombre, logos, colores, aviso para todos y cualquier texto (**🎨 Web**), la información de cada torneo (su página del panel) y cualquier otra competición o evento (créalo como actividad).
- También desde el panel: el horario de la pista del fútbol y el día objetivo para cuartos y semifinales (Fútbol → Calendario), el partido por el 3er puesto (fútbol y mus) y las mesas y jugadores por mesa del póker (Información de cada torneo).
- En el código, solo los valores por defecto: los de cada torneo (`src/modulos/torneos/config.ts`), las mesas del póker (`src/modulos/poker/config.ts`), el horario de la pista (`src/modulos/futbol/reservas.ts`), el icono de la pestaña (`src/app/icon.svg`) y los logos y colores (`public/marca/`, `src/app/globals.css` y `src/modulos/web/config.ts`).
- Textos en inglés: `src/modulos/idioma/en.ts` (la clave es el texto en español tal cual; `npm test` avisa si alguno se queda sin traducir) y los textos por defecto de cada torneo en `src/modulos/torneos/config-en.ts`.
- Estructura de la base de datos: `src/db/schema.ts`.

## Licencia

[MIT](LICENSE): puedes usarla, copiarla y modificarla libremente, manteniendo el aviso de copyright.
