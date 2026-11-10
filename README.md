# Torneos CEEPS

Web para organizar los torneos y actividades del Consejo de Estudiantes de la Escuela Politécnica Superior (UAM): los torneos de **fútbol sala**, **mus** y **póker** y **cualquier otra actividad** que se cree desde el panel (una chocolatada solidaria, una charla, un torneo de ping-pong…). Funciona en el móvil y en el ordenador.

- Cada participante entra con el correo con el que se inscribió y ve lo suyo: cuadro eliminatorio, mesas de póker, horarios, lugares, premios, resultados y clasificación (se actualizan solos) y, en las actividades, la información para todos y su nota personal (p. ej. su recompensa).
- El Consejo lo gestiona todo desde el **panel de admin**: importar las inscripciones (CSV de Microsoft Forms), añadir o quitar participantes, sortear, apuntar resultados, cambiar fechas, lugares y avisos, crear actividades y cerrar ediciones.
- **Dar por finalizado** un torneo: desde ese momento lo ve todo el que entra en la web, con el ganador destacado.
- Lista de **ganadores** de cada edición y **archivo** con una copia completa de cada edición cerrada (solo para el Consejo).
- Ningún correo ni teléfono llega al navegador de los participantes.

Hecha con [Next.js](https://nextjs.org), [Drizzle ORM](https://orm.drizzle.team) y PostgreSQL. Se puede alojar gratis en [Vercel](https://vercel.com) + [Supabase](https://supabase.com).

## Probarla en tu ordenador

Necesitas [Node.js](https://nodejs.org) 22 o superior y PostgreSQL.

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

Para tener datos de prueba: `npm run db:seed` importa los CSV de inscripción que haya en la carpeta superior (`../*.csv`; otra carpeta con `CSV_DIR=/ruta`) y `npm run db:demo` sortea los torneos y mete resultados inventados (solo funciona con una base de datos local). Con `npm run db:seed -- --simular` solo enseña qué cambiaría, sin escribir nada.

> Si `npm run dev` falla con «Failed to open database», para el servidor y borra la carpeta `.next`.

## Configuración

| Variable         | Qué es                                                                                           |
| ---------------- | ------------------------------------------------------------------------------------------------ |
| `DATABASE_URL`   | Cadena de conexión de PostgreSQL.                                                                |
| `SESSION_SECRET` | Secreto para firmar las sesiones. Genera uno con `openssl rand -base64 32`.                      |
| `ADMIN_EMAILS`   | Correos que pueden entrar al panel, separados por comas.                                         |
| `ADMIN_PASSWORD` | Contraseña común del panel. Además de estar en `ADMIN_EMAILS`, hay que escribirla para entrar.  |

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

Todo desde el panel (`/admin`, botón «Admin» al entrar con un correo de `ADMIN_EMAILS`):

1. **Información de cada torneo**: calendario, lugar, formato, premios, enlace y cierre de inscripción, y un aviso destacado para cambios de última hora. Los premios, uno por línea empezando por el puesto (`1º Tarjeta regalo de 100 €`, también `1º-4º`); las líneas que empiezan por `-` son detalles del premio de encima y el resto, notas para todos.
   La **chuleta de reglas** de cada torneo también se escribe ahí, una idea por línea: `Título: texto` pone el título en negrita, `- …` son viñetas, `1. …` pasos numerados en casillas, `Nota: …` va en pequeño al final y `**texto**` en negrita. Si se deja vacía, no sale.
2. **Importar** las inscripciones: el CSV de Forms (o el Excel de Forms guardado como CSV) y súbelo. Se pueden subir varios a la vez; reimportar es seguro (no duplica ni pisa tus correcciones). Las parejas de mus incompletas no se importan, y un equipo inscrito dos veces con distinto capitán (mismo nombre y casi la misma plantilla) cuenta como uno, con la inscripción más reciente.
3. **Personas**: lista completa con buscador y filtros, botón para copiar los correos (para el CCO de un email), descarga en Excel, corrección de nombres y correos y una sección con quien todavía no tiene correo para ponérselo.
   **Correos**: los correos de todos los participantes por grupos (todos, cada torneo, capitanes, cada mitad del cuadro del mus, cada día del póker, la lista de reserva y cada actividad) para escribirles en CCO: «Copiar» los copia y «Escribir» abre el programa de correo con todos en copia oculta.
4. **Equipos, parejas y jugadores**: crear, renombrar, cambiar plantillas y borrar (con confirmación). En póker, también renombrar turnos si cambia una fecha (se ordenan por fecha: «Martes 10 nov» antes que «Jueves 12 nov») y decidir si la **lista de reserva** puede entrar en la web (por defecto no: quien está en reserva no entra con su correo, salvo que juegue a otro torneo, y se le explica que está en reserva).
5. **Sortear** (hay que escribir `SORTEAR` para confirmar). Si no hay participantes para llenar el cuadro, el sorteo reparte pases directos; la web explica cómo queda (p. ej. 12 equipos → cuadro de 16 con 4 pases directos). En el mus, las parejas que pierden en semifinales juegan por el **3er y 4º puesto** (en `src/lib/config.ts`, `tercerPuesto`).
6. **Apuntar** fechas, lugares y resultados. **Fechas por bloques** pone la misma fecha y lugar a una mitad del cuadro (hasta su semifinal), a una ronda o a la final de una vez. El ganador avanza solo y la clasificación se calcula sola (campeón, subcampeón y, con 3er puesto, 3º y 4º).
7. **Asistencia**: cada equipo (lo confirma el capitán), pareja (cualquiera de los dos) o jugador de póker confirma en la página del torneo si viene el próximo día que juega, con un comentario si quiere. La respuesta vale para ese día: si cambia la fecha de su partido o su mesa, o pasa a jugar otro día (una final), se le vuelve a preguntar. Solo se pregunta por partidos y mesas con fecha. En **Asistencia** están los recuentos de cada día, los correos de quien no ha respondido (para recordárselo) y botones para apuntar a mano lo que alguien avise por otro lado.
8. **Dar por finalizado** cuando acabe: lo ve todo el que entra en la web, con el ganador arriba (se puede reabrir).
9. **Nueva edición** (con el nombre escrito para confirmar): el ganador pasa a la lista de ganadores, se guarda una copia completa en el archivo y el torneo queda vacío para la siguiente edición.

### Actividades

En el panel, **Actividades → +**. Cada actividad tiene nombre, icono, fechas, lugar, de qué va, un texto para todos los participantes (p. ej. «Tu recompensa: chocolate con bizcocho») y un estado (borrador, activa o terminada). Hay dos tipos:

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
- El panel exige estar en `ADMIN_EMAILS` **y** la contraseña. Tras 10 intentos fallidos en 15 minutos se bloquea; **cambiar `ADMIN_PASSWORD` cierra todas las sesiones de admin abiertas**. Usa una contraseña larga.
- Ningún correo ni teléfono se envía a los navegadores de los participantes. Las tablas tienen RLS activado, así que la API pública de Supabase no puede leerlas.
- Cada acción del servidor comprueba los permisos y valida los datos; la web envía cabeceras contra clickjacking y similares.

## Pruebas

```bash
npm run comprobar  # todo lo de abajo de una vez
npm test           # lógica: cuadros, sorteos, mesas, asistencia, correos, importación, migraciones, seguridad
npm run typecheck
npm run lint
```

## Adaptarla a tu asociación

- Nombres, calendario, formato, premios y chuleta de reglas por defecto, partido por el 3er puesto y número de mesas de póker: `src/lib/config.ts`. Para cualquier otra cosa no hace falta tocar código: créala como actividad desde el panel.
- Logos: `public/marca/` y `src/app/icon.svg`. Colores: `src/app/globals.css`.
- Estructura de la base de datos: `src/db/schema.ts`.

## Licencia

[MIT](LICENSE): puedes usarla, copiarla y modificarla libremente, manteniendo el aviso de copyright.
