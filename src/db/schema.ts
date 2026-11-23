import { sql } from "drizzle-orm";
import { boolean, date, index, integer, jsonb, pgSchema, pgTable, primaryKey, serial, text, timestamp, unique } from "drizzle-orm/pg-core";

// Todas las tablas llevan RLS activado sin políticas: así la API pública de Supabase (PostgREST) no puede leerlas.
// La web se conecta como propietaria de las tablas, a la que RLS no afecta.

const creadoEn = () => timestamp("creado_en", { withTimezone: true }).defaultNow().notNull();

/**
 * Tabla común: cada persona inscrita en cualquier torneo, identificada por su correo.
 * Los tres esquemas de torneo referencian `usuarios.email` como clave foránea.
 */
export const usuarios = pgTable("usuarios", {
  email: text("email").primaryKey(),
  nombre: text("nombre").notNull(),
  centro: text("centro"),
  /** Identificador público de su perfil (/perfil/<id>): así se enlaza a una persona sin enseñar su correo. */
  perfil: text("perfil")
    .notNull()
    .unique()
    .default(sql`substr(md5(random()::text || clock_timestamp()::text), 1, 12)`),
  creadoEn: creadoEn(),
}).enableRLS();

/** Correcciones de correo hechas desde el panel: se aplican también al reimportar los CSV. */
export const aliasCorreos = pgTable("alias_correos", {
  antiguo: text("antiguo").primaryKey(),
  nuevo: text("nuevo").notNull(),
}).enableRLS();

/** Información de cada torneo editable desde el panel. Los campos a null usan el valor por defecto de modulos/torneos/config.ts. */
export const infoTorneos = pgTable("info_torneos", {
  /** futbol | mus | poker */
  torneo: text("torneo").primaryKey(),
  nombre: text("nombre"),
  lema: text("lema"),
  lugar: text("lugar"),
  calendario: text("calendario"),
  formato: text("formato"),
  /** Aviso destacado arriba de la página (cambios de fecha, huelgas…). */
  aviso: text("aviso"),
  /** Premios, uno por línea («1º Tarjeta regalo de 100 €»; ver modulos/torneos/premios.ts). */
  premios: text("premios"),
  /** Chuleta de reglas de la página del torneo (ver modulos/torneos/reglas.ts). Null: la de config.ts. */
  reglas: text("reglas"),
  enlaceInscripcion: text("enlace_inscripcion"),
  cierreInscripcion: timestamp("cierre_inscripcion", { withTimezone: true }),
  /** Versión en inglés de los textos (nombre, lema, lugar, calendario, formato, premios, reglas, aviso); lo vacío, el texto por defecto. */
  en: jsonb("en").$type<Record<string, string>>().notNull().default({}),
  /** Finalizado por el Consejo: lo ve todo el que entra en la web, con el ganador. */
  finalizado: boolean("finalizado").notNull().default(false),
  /** Solo póker: si la lista de reserva puede entrar en la web (si no, su correo no da acceso al póker). */
  reservaConAcceso: boolean("reserva_con_acceso").notNull().default(false),
  /** Solo póker: las plazas de quien dice que no (12 h antes) o no contesta (6 h antes) pasan solas a la reserva. */
  reservaAutomatica: boolean("reserva_automatica").notNull().default(true),
  /** Desde cuándo está activado: lo que tocaba antes no se hace de golpe al activarlo. */
  reservaAutomaticaDesde: timestamp("reserva_automatica_desde", { withTimezone: true }),
  /** Solo póker: cuántos de cada mesa clasificatoria pasan a la mesa final (1, el ganador; 2, también el segundo). */
  clasificanPorMesa: integer("clasifican_por_mesa").notNull().default(1),
  /** Solo fútbol: primer y último día en que se juega (null: los de futbol/reservas.ts). */
  reservasDesde: date("reservas_desde", { mode: "string" }),
  reservasHasta: date("reservas_hasta", { mode: "string" }),
  /** Solo fútbol: días u horas cerrados, uno por línea (ver leerCierres en futbol/reservas.ts). */
  reservasCerradas: text("reservas_cerradas"),
  /** Solo fútbol: los huecos que da Deportes, con el mismo formato; vacío, vale de lunes a viernes de 8:00 a 18:00. */
  reservasAbiertas: text("reservas_abiertas"),
}).enableRLS();

/** Ficheros de sql/ ya aplicados en esta base de datos (los apunta scripts/migrar.mts al desplegar). */
export const migraciones = pgTable("migraciones", {
  nombre: text("nombre").primaryKey(),
  aplicadaEn: timestamp("aplicada_en", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

/**
 * Correos que manda la web sola (p. ej. al pasar una plaza a la reserva). Se guardan siempre: si el envío no está
 * configurado o falla, el Consejo los ve en el panel y los puede mandar a mano.
 */
export const correos = pgTable("correos", {
  id: serial("id").primaryKey(),
  para: text("para").notNull(),
  asunto: text("asunto").notNull(),
  texto: text("texto").notNull(),
  /** Por qué se manda, para el panel: «Póker · plaza a la reserva»… */
  motivo: text("motivo"),
  /** pendiente | enviado | error */
  estado: text("estado").notNull().default("pendiente"),
  error: text("error"),
  creadoEn: creadoEn(),
  enviadoEn: timestamp("enviado_en", { withTimezone: true }),
}).enableRLS();

/** Registro de cambios hechos desde el panel: quién y qué. */
export const registro = pgTable("registro", {
  id: serial("id").primaryKey(),
  email: text("email").notNull(),
  accion: text("accion").notNull(),
  creadoEn: creadoEn(),
}).enableRLS();

/* ───────────────────────────── LA WEB, EDITABLE DESDE EL PANEL (Panel → 🎨 Web) ───────────────────────────── */

/**
 * Ajustes de la web: una fila por apartado (marca, colores, aviso, logos), con su valor en JSON. Lo que no esté aquí usa
 * el valor por defecto de modulos/web/config.ts.
 */
export const ajustesWeb = pgTable("ajustes_web", {
  clave: text("clave").primaryKey(),
  valor: jsonb("valor").$type<Record<string, unknown>>().notNull(),
  actualizadoPor: text("actualizado_por"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

/**
 * Textos de la web cambiados desde el panel. La clave es el texto en español tal cual está en el código (la misma que
 * en modulos/idioma/en.ts); `es` y `en`, lo que sale en su lugar (null o vacío: el de siempre).
 */
export const textosWeb = pgTable("textos_web", {
  clave: text("clave").primaryKey(),
  es: text("es"),
  en: text("en"),
  actualizadoPor: text("actualizado_por"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

/** Imágenes subidas desde el panel (los logos), en base64. Se sirven en /logos/<nombre>. */
export const imagenesWeb = pgTable("imagenes_web", {
  /** principal | pie-1 | pie-2 | pie-3 */
  nombre: text("nombre").primaryKey(),
  /** image/svg+xml | image/png | image/jpeg */
  tipo: text("tipo").notNull(),
  datos: text("datos").notNull(),
  actualizadoPor: text("actualizado_por"),
  actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
}).enableRLS();

const refUsuario = { onUpdate: "cascade", onDelete: "set null" } as const;

/* ───────────────────────────── FÚTBOL SALA ───────────────────────────── */

export const futbol = pgSchema("futbol");

export const futbolEquipos = futbol.table("equipos", {
  id: serial("id").primaryKey(),
  /** Clave estable para reimportar el CSV sin duplicar: correo del capitán. */
  clave: text("clave").notNull().unique(),
  nombre: text("nombre").notNull(),
  capitanEmail: text("capitan_email").references(() => usuarios.email, refUsuario),
  telefono: text("telefono"),
  horario: text("horario"),
  inscritoEn: timestamp("inscrito_en", { withTimezone: true }),
  /** Huella de la fila del CSV: si no cambia, la reimportación respeta las ediciones manuales. */
  hashImport: text("hash_import"),
  creadoEn: creadoEn(),
}).enableRLS();

export const futbolJugadores = futbol.table(
  "jugadores",
  {
    id: serial("id").primaryKey(),
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => futbolEquipos.id, { onDelete: "cascade" }),
    nombre: text("nombre").notNull(),
    email: text("email").references(() => usuarios.email, refUsuario),
    esCapitan: boolean("es_capitan").notNull().default(false),
  },
  (t) => [unique().on(t.equipoId, t.email)],
).enableRLS();

export const futbolPartidos = futbol.table(
  "partidos",
  {
    id: serial("id").primaryKey(),
    /** 1 = primera ronda; la última ronda es la final. */
    ronda: integer("ronda").notNull(),
    posicion: integer("posicion").notNull(),
    localId: integer("local_id").references(() => futbolEquipos.id, { onDelete: "set null" }),
    visitanteId: integer("visitante_id").references(() => futbolEquipos.id, { onDelete: "set null" }),
    /** Equipo puesto a mano por el Consejo en ese lado: no lo cambian los resultados de la ronda anterior. */
    localFijo: boolean("local_fijo").notNull().default(false),
    visitanteFijo: boolean("visitante_fijo").notNull().default(false),
    golesLocal: integer("goles_local"),
    golesVisitante: integer("goles_visitante"),
    penaltisLocal: integer("penaltis_local"),
    penaltisVisitante: integer("penaltis_visitante"),
    ganadorId: integer("ganador_id").references(() => futbolEquipos.id, { onDelete: "set null" }),
    fecha: timestamp("fecha", { withTimezone: true }),
    lugar: text("lugar"),
    notas: text("notas"),
    /**
     * Fecha prevista mientras no hay fecha: sale sola de lo que marcan los capitanes (futbol/prevision.ts). Se guarda
     * para que lo previsto para las próximas 24 horas no se mueva.
     */
    fechaPrevista: timestamp("fecha_prevista", { withTimezone: true }),
  },
  (t) => [unique().on(t.ronda, t.posicion)],
).enableRLS();

/** Huecos de una hora que le vienen bien a un equipo (los marca su capitán en el calendario). */
export const futbolDisponibilidad = futbol.table(
  "disponibilidad",
  {
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => futbolEquipos.id, { onDelete: "cascade" }),
    dia: date("dia", { mode: "string" }).notNull(),
    /** Hora de inicio del hueco (8 = de 8:00 a 9:00). */
    hora: integer("hora").notNull(),
    marcadoPor: text("marcado_por").notNull(),
    creadoEn: creadoEn(),
  },
  (t) => [primaryKey({ columns: [t.equipoId, t.dia, t.hora] })],
).enableRLS();

/** Reservas de la pista: un capitán propone un hueco para su partido y el capitán rival lo acepta o lo rechaza. */
export const futbolPropuestas = futbol.table(
  "propuestas",
  {
    id: serial("id").primaryKey(),
    partidoId: integer("partido_id")
      .notNull()
      .references(() => futbolPartidos.id, { onDelete: "cascade" }),
    /** El equipo que propone (el otro es quien responde). */
    equipoId: integer("equipo_id")
      .notNull()
      .references(() => futbolEquipos.id, { onDelete: "cascade" }),
    /** Inicio del hueco de una hora. */
    fecha: timestamp("fecha", { withTimezone: true }).notNull(),
    /** pendiente | aceptada | rechazada | anulada */
    estado: text("estado").notNull().default("pendiente"),
    propuestoPor: text("propuesto_por").notNull(),
    respondidoPor: text("respondido_por"),
    respondidoEn: timestamp("respondido_en", { withTimezone: true }),
    creadoEn: creadoEn(),
  },
  (t) => [index("propuestas_partido_idx").on(t.partidoId, t.estado)],
).enableRLS();

/* ───────────────────────────────── MUS ───────────────────────────────── */

export const mus = pgSchema("mus");

export const musParejas = mus.table("parejas", {
  id: serial("id").primaryKey(),
  /** Clave estable para reimportar: correos de la pareja ordenados. */
  clave: text("clave").notNull().unique(),
  nombre: text("nombre").notNull(),
  /** Quien rellenó el formulario: hace de capitán/contacto de la pareja. */
  capitanEmail: text("capitan_email").references(() => usuarios.email, refUsuario),
  inscritoEn: timestamp("inscrito_en", { withTimezone: true }),
  hashImport: text("hash_import"),
  creadoEn: creadoEn(),
}).enableRLS();

export const musIntegrantes = mus.table(
  "integrantes",
  {
    parejaId: integer("pareja_id")
      .notNull()
      .references(() => musParejas.id, { onDelete: "cascade" }),
    /** 1 o 2 */
    orden: integer("orden").notNull(),
    nombre: text("nombre").notNull(),
    email: text("email").references(() => usuarios.email, refUsuario),
    centro: text("centro"),
  },
  (t) => [primaryKey({ columns: [t.parejaId, t.orden] })],
).enableRLS();

export const musPartidos = mus.table(
  "partidos",
  {
    id: serial("id").primaryKey(),
    /** 1 = primera ronda; la última ronda es la final; 0 = partido por el 3er y 4º puesto. */
    ronda: integer("ronda").notNull(),
    posicion: integer("posicion").notNull(),
    parejaAId: integer("pareja_a_id").references(() => musParejas.id, { onDelete: "set null" }),
    parejaBId: integer("pareja_b_id").references(() => musParejas.id, { onDelete: "set null" }),
    /** Pareja puesta a mano por el Consejo en ese lado: no la cambian los resultados de la ronda anterior. */
    parejaAFija: boolean("pareja_a_fija").notNull().default(false),
    parejaBFija: boolean("pareja_b_fija").notNull().default(false),
    /** Partidas ganadas por cada pareja (al mejor de 3, final al mejor de 5). */
    partidasA: integer("partidas_a"),
    partidasB: integer("partidas_b"),
    mejorDe: integer("mejor_de").notNull().default(3),
    ganadorId: integer("ganador_id").references(() => musParejas.id, { onDelete: "set null" }),
    fecha: timestamp("fecha", { withTimezone: true }),
    lugar: text("lugar"),
    notas: text("notas"),
  },
  (t) => [unique().on(t.ronda, t.posicion)],
).enableRLS();

/** Detalle opcional de cada partida a 40 tantos dentro de un enfrentamiento. */
export const musPartidas = mus.table(
  "partidas",
  {
    partidoId: integer("partido_id")
      .notNull()
      .references(() => musPartidos.id, { onDelete: "cascade" }),
    numero: integer("numero").notNull(),
    tantosA: integer("tantos_a").notNull(),
    tantosB: integer("tantos_b").notNull(),
  },
  (t) => [primaryKey({ columns: [t.partidoId, t.numero] })],
).enableRLS();

/* ──────────────────────────────── PÓKER ──────────────────────────────── */

export const poker = pgSchema("poker");

export const pokerJugadores = poker.table("jugadores", {
  email: text("email")
    .primaryKey()
    .references(() => usuarios.email, { onUpdate: "cascade", onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  centro: text("centro"),
  /** Turnos en los que puede jugar la fase clasificatoria, p. ej. ["Martes 13", "Miércoles 14"]. */
  disponibilidad: text("disponibilidad").array().notNull().default([]),
  experiencia: text("experiencia"),
  traeFichas: boolean("trae_fichas").notNull().default(false),
  inscritoEn: timestamp("inscrito_en", { withTimezone: true }),
  /** inscrito | reserva | baja */
  estado: text("estado").notNull().default("inscrito"),
  hashImport: text("hash_import"),
  creadoEn: creadoEn(),
}).enableRLS();

export const pokerMesas = poker.table(
  "mesas",
  {
    id: serial("id").primaryKey(),
    /** clasificatoria | final */
    fase: text("fase").notNull(),
    numero: integer("numero").notNull(),
    turno: text("turno"),
    fecha: timestamp("fecha", { withTimezone: true }),
    lugar: text("lugar"),
    ganadorEmail: text("ganador_email").references(() => pokerJugadores.email, {
      onUpdate: "cascade",
      onDelete: "set null",
    }),
  },
  (t) => [unique().on(t.fase, t.numero)],
).enableRLS();

export const pokerAsientos = poker.table(
  "asientos",
  {
    mesaId: integer("mesa_id")
      .notNull()
      .references(() => pokerMesas.id, { onDelete: "cascade" }),
    asiento: integer("asiento").notNull(),
    jugadorEmail: text("jugador_email")
      .notNull()
      .references(() => pokerJugadores.email, { onUpdate: "cascade", onDelete: "cascade" }),
    /** Puesto final en la mesa (1 = ganador). Null mientras sigue jugando. */
    puesto: integer("puesto"),
  },
  (t) => [primaryKey({ columns: [t.mesaId, t.asiento] }), unique().on(t.mesaId, t.jugadorEmail)],
).enableRLS();

/** Plazas que han pasado solas a la reserva: quién la dejó, quién la ocupa y por qué. */
export const pokerRelevos = poker.table("relevos", {
  id: serial("id").primaryKey(),
  mesaId: integer("mesa_id")
    .notNull()
    .references(() => pokerMesas.id, { onDelete: "cascade" }),
  asiento: integer("asiento").notNull(),
  saleEmail: text("sale_email").notNull(),
  entraEmail: text("entra_email").notNull(),
  /** no (dijo que no venía) | sin respuesta (no confirmó a tiempo) */
  motivo: text("motivo").notNull(),
  creadoEn: creadoEn(),
}).enableRLS();

/* ───────────────────────────── ASISTENCIA ───────────────────────────── */

/**
 * Confirmación de que se viene un día: una por equipo (la da el capitán), por pareja (cualquiera de los dos), por jugador
 * de póker o por participante de una actividad (si es un equipo, cualquiera de él). Va ligada al día: si cambia la fecha
 * del partido, la mesa o el evento, hay que volver a confirmar.
 */
export const asistencia = pgTable(
  "asistencia",
  {
    /** futbol | mus | poker | actividad */
    torneo: text("torneo").notNull(),
    /** Fútbol: id del equipo; mus: id de la pareja; póker: correo del jugador; actividad: id del participante (persona o equipo). */
    unidad: text("unidad").notNull(),
    /** Día al que se refiere, en hora de Madrid. */
    dia: date("dia", { mode: "string" }).notNull(),
    viene: boolean("viene").notNull(),
    comentario: text("comentario"),
    /** Quién respondió (un participante o alguien del Consejo desde el panel). */
    email: text("email").notNull(),
    actualizadoEn: timestamp("actualizado_en", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [primaryKey({ columns: [t.torneo, t.unidad, t.dia] })],
).enableRLS();

/* ───────────────────── ACTIVIDADES (creadas desde el panel) ───────────────────── */

/**
 * Cualquier actividad del Consejo además de los tres torneos fijos: un evento con lista de participantes
 * (chocolatada solidaria, charla…) o un torneo eliminatorio (ping-pong, ajedrez…), individual o por equipos.
 */
export const actividades = pgTable("actividades", {
  id: serial("id").primaryKey(),
  /** Parte de la dirección: /actividades/chocolatada-solidaria */
  slug: text("slug").notNull().unique(),
  nombre: text("nombre").notNull(),
  icono: text("icono").notNull().default("⭐"),
  /** evento | torneo */
  tipo: text("tipo").notNull().default("evento"),
  /** Solo torneos: cada participante es un equipo con varias personas. */
  porEquipos: boolean("por_equipos").notNull().default(false),
  lema: text("lema"),
  /** «De qué va»: un punto por línea. */
  descripcion: text("descripcion"),
  calendario: text("calendario"),
  lugar: text("lugar"),
  /** Eventos: día y hora; con ella sus participantes confirman si vienen. Los torneos usan la de cada partido. */
  fecha: timestamp("fecha", { withTimezone: true }),
  aviso: text("aviso"),
  /** Lo que ven todos los participantes (p. ej. la recompensa solidaria). */
  infoParticipantes: text("info_participantes"),
  enlaceInscripcion: text("enlace_inscripcion"),
  cierreInscripcion: timestamp("cierre_inscripcion", { withTimezone: true }),
  /** borrador (solo la ve el Consejo) | activa | terminada */
  estado: text("estado").notNull().default("activa"),
  /** Versión en inglés de los textos (nombre, lema, descripción, calendario, lugar, aviso, info para participantes). */
  en: jsonb("en").$type<Record<string, string>>().notNull().default({}),
  creadoEn: creadoEn(),
}).enableRLS();

/** Participante de una actividad: una persona o, en torneos por equipos, un equipo. */
export const actividadParticipantes = pgTable("actividad_participantes", {
  id: serial("id").primaryKey(),
  actividadId: integer("actividad_id")
    .notNull()
    .references(() => actividades.id, { onDelete: "cascade" }),
  nombre: text("nombre").notNull(),
  /** Nota personal que solo ve este participante (p. ej. «2 vales: donaste 5 €»). */
  nota: text("nota"),
  creadoEn: creadoEn(),
}).enableRLS();

/** Personas de cada participante: una si es individual, varias si es un equipo. */
export const actividadMiembros = pgTable(
  "actividad_miembros",
  {
    participanteId: integer("participante_id")
      .notNull()
      .references(() => actividadParticipantes.id, { onDelete: "cascade" }),
    orden: integer("orden").notNull(),
    nombre: text("nombre").notNull(),
    email: text("email").references(() => usuarios.email, refUsuario),
  },
  (t) => [primaryKey({ columns: [t.participanteId, t.orden] })],
).enableRLS();

/** Cuadro eliminatorio de las actividades de tipo torneo. */
export const actividadPartidos = pgTable(
  "actividad_partidos",
  {
    id: serial("id").primaryKey(),
    actividadId: integer("actividad_id")
      .notNull()
      .references(() => actividades.id, { onDelete: "cascade" }),
    ronda: integer("ronda").notNull(),
    posicion: integer("posicion").notNull(),
    aId: integer("a_id").references(() => actividadParticipantes.id, { onDelete: "set null" }),
    bId: integer("b_id").references(() => actividadParticipantes.id, { onDelete: "set null" }),
    puntosA: integer("puntos_a"),
    puntosB: integer("puntos_b"),
    ganadorId: integer("ganador_id").references(() => actividadParticipantes.id, { onDelete: "set null" }),
    fecha: timestamp("fecha", { withTimezone: true }),
    lugar: text("lugar"),
    notas: text("notas"),
  },
  (t) => [unique().on(t.actividadId, t.ronda, t.posicion)],
).enableRLS();

/* ──────────────────────────────── CHAT ──────────────────────────────── */

/**
 * Chat de cada torneo y actividad. Lo público va a la sala de un día de juego (la leen quienes juegan ese día) o, si es
 * un aviso del Consejo para todos, sin día. Lo privado es una conversación entre un participante y el Consejo.
 */
export const mensajes = pgTable(
  "mensajes",
  {
    id: serial("id").primaryKey(),
    /** futbol | mus | poker | actividad */
    torneo: text("torneo").notNull(),
    actividadId: integer("actividad_id").references(() => actividades.id, { onDelete: "cascade" }),
    /** Sala del día, en hora de Madrid. Null: aviso del Consejo para todos o conversación privada. */
    dia: date("dia", { mode: "string" }),
    /** Conversación privada con el Consejo: el correo del participante. Null: público. */
    privadoCon: text("privado_con"),
    /** Quién lo escribe: un participante o alguien del Consejo. */
    email: text("email").notNull(),
    /** Nombre que se enseña: el de la inscripción o «Consejo». */
    nombre: text("nombre").notNull(),
    /** Equipo, pareja o mesa de quien escribe. */
    unidad: text("unidad"),
    deConsejo: boolean("de_consejo").notNull().default(false),
    texto: text("texto").notNull(),
    /** Privados: ya lo ha leído la otra parte. */
    leido: boolean("leido").notNull().default(false),
    creadoEn: creadoEn(),
    borradoEn: timestamp("borrado_en", { withTimezone: true }),
  },
  (t) => [index("mensajes_sala_idx").on(t.torneo, t.actividadId, t.dia, t.id), index("mensajes_privado_idx").on(t.privadoCon, t.id)],
).enableRLS();

/* ───────────────────────── GANADORES Y ARCHIVO ───────────────────────── */

/** Campeones de cada edición (de los torneos fijos y de las actividades). Se rellena al cerrar una edición o a mano. */
export const palmares = pgTable("palmares", {
  id: serial("id").primaryKey(),
  actividad: text("actividad").notNull(),
  icono: text("icono"),
  edicion: text("edicion"),
  campeon: text("campeon").notNull(),
  detalle: text("detalle"),
  /** Correos de quienes ganaron (el equipo, la pareja o el jugador), para su perfil. Vacío en lo apuntado a mano. */
  emails: text("emails").array().notNull().default([]),
  fecha: timestamp("fecha", { withTimezone: true }),
  creadoEn: creadoEn(),
}).enableRLS();

/** Copia completa de cada edición cerrada: si se vacía algo por error, los datos siguen aquí. */
export const archivo = pgTable("archivo", {
  id: serial("id").primaryKey(),
  nombre: text("nombre").notNull(),
  /** futbol | mus | poker | actividad */
  tipo: text("tipo").notNull(),
  datos: jsonb("datos").notNull(),
  creadoPor: text("creado_por").notNull(),
  creadoEn: creadoEn(),
}).enableRLS();
