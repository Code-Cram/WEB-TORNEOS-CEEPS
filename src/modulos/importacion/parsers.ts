import { createHash } from "node:crypto";
import { coincidenciaNombres, limpiarNombre, normalizarCorreo, tokensNombre } from "@/modulos/compartido/texto";
import { columna, fechaForms, type Fila } from "@/modulos/importacion/csv";

export type Torneo = "futbol" | "mus" | "poker";

export type Persona = {
  nombre: string;
  email: string | null;
  centro?: string | null;
  /** El correo viene de la cuenta con la que se rellenó el Forms (verificado por Microsoft). */
  verificado?: boolean;
};

export type EquipoImport = {
  clave: string;
  nombre: string;
  capitan: Persona;
  telefono: string | null;
  horario: string | null;
  inscritoEn: Date | null;
  jugadores: (Persona & { esCapitan: boolean })[];
  hash: string;
  avisos: string[];
};

export type ParejaImport = {
  clave: string;
  nombre: string;
  capitanEmail: string | null;
  inscritoEn: Date | null;
  integrantes: (Persona & { orden: number })[];
  hash: string;
  avisos: string[];
};

export type JugadorPokerImport = {
  email: string;
  nombre: string;
  centro: string | null;
  disponibilidad: string[];
  experiencia: string | null;
  traeFichas: boolean;
  inscritoEn: Date | null;
  hash: string;
  avisos: string[];
};

export type ResultadoParse<T> = { registros: T[]; avisos: string[]; filas: number; duplicadas: number };

/** Correcciones de correo (antiguo → nuevo) guardadas desde el panel. */
export type Alias = Map<string, string>;

function corregirCorreo(raw: string, alias: Alias) {
  const n = normalizarCorreo(raw);
  if (n.email && alias.has(n.email)) return { ...n, email: alias.get(n.email)!, institucional: true, aviso: undefined };
  return n;
}

const huella = (o: unknown) => createHash("sha1").update(JSON.stringify(o)).digest("hex").slice(0, 16);

const respondente = (f: Fila, alias: Alias) => ({
  email: corregirCorreo(columna(f, "Email"), alias).email,
  nombre: limpiarNombre(columna(f, "Name")),
  fecha: fechaForms(columna(f, "Completion time", "Hora de finalización")) ?? fechaForms(columna(f, "Start time")),
});

/**
 * Se queda con la respuesta más reciente de cada clave, completando los campos vacíos con
 * respuestas anteriores y conservando la fecha de la primera inscripción (orden de llegada).
 */
function deduplicar<T extends { clave: string; inscritoEn: Date | null }>(
  lista: T[],
  completar: (reciente: T, anterior: T) => T = (r) => r,
) {
  const ordenada = [...lista].sort((a, b) => (a.inscritoEn?.getTime() ?? 0) - (b.inscritoEn?.getTime() ?? 0));
  const porClave = new Map<string, T>();
  for (const r of ordenada) {
    const prev = porClave.get(r.clave);
    porClave.set(r.clave, prev ? { ...completar(r, prev), inscritoEn: prev.inscritoEn ?? r.inscritoEn } : r);
  }
  return { registros: [...porClave.values()], duplicadas: lista.length - porClave.size };
}

/**
 * Elige el correo de un jugador: si su nombre coincide con quien rellenó el Forms,
 * se usa el correo verificado de la cuenta; si no, el escrito a mano (normalizado).
 */
function correoJugador(
  nombre: string,
  escrito: string,
  resp: { email: string | null; nombre: string },
  avisos: string[],
  alias: Alias,
): { email: string | null; verificado: boolean } {
  const n = corregirCorreo(escrito, alias);
  const esRespondente =
    resp.email && (coincidenciaNombres(nombre, resp.nombre) > 0 || n.email === resp.email);
  if (esRespondente) {
    if (n.email && n.email !== resp.email) avisos.push(`${nombre}: se usa ${resp.email} en vez de «${escrito}»`);
    return { email: resp.email, verificado: true };
  }
  if (n.aviso) avisos.push(`${nombre || "?"}: ${n.aviso}`);
  else if (!n.email) avisos.push(`${nombre || "?"}: sin correo`);
  return { email: n.email, verificado: false };
}

/* ───────────────────────────── FÚTBOL ───────────────────────────── */

/** El nombre con más palabras: «Sergio Navas» → «Sergio Navas Ortiz». */
const masCompleto = (a: string, b: string) => (tokensNombre(b).length > tokensNombre(a).length ? b : a);

/** ¿Dos inscripciones del mismo equipo? Mismo nombre y al menos el 60 % de la plantilla más corta está en la otra. */
function mismoEquipo(a: EquipoImport, b: EquipoImport): boolean {
  const nombre = (e: EquipoImport) => tokensNombre(e.nombre).join(" ");
  if (!nombre(a) || nombre(a) !== nombre(b)) return false;
  const [corta, larga] = a.jugadores.length <= b.jugadores.length ? [a.jugadores, b.jugadores] : [b.jugadores, a.jugadores];
  const comunes = corta.filter((j) => larga.some((k) => coincidenciaNombres(j.nombre, k.nombre) > 0)).length;
  return corta.length > 0 && comunes >= 0.6 * corta.length;
}

/** Al juntar dos inscripciones del mismo equipo, quien no tiene correo en la última recupera el que tenía en la anterior. */
function completarCorreos(reciente: EquipoImport, anterior: EquipoImport): EquipoImport {
  const usados = new Set(reciente.jugadores.map((j) => j.email));
  const jugadores = reciente.jugadores.map((j) => {
    if (j.email) return j;
    const antes = anterior.jugadores.filter(
      (k) => k.email && !usados.has(k.email) && coincidenciaNombres(j.nombre, k.nombre) >= Math.min(2, tokensNombre(j.nombre).length, tokensNombre(k.nombre).length),
    );
    if (antes.length !== 1) return j;
    usados.add(antes[0].email);
    return { ...j, nombre: masCompleto(j.nombre, antes[0].nombre), email: antes[0].email, verificado: antes[0].verificado };
  });
  return { ...reciente, jugadores };
}

export function parsearFutbol(filas: Fila[], alias: Alias = new Map()): ResultadoParse<EquipoImport> {
  const lista: EquipoImport[] = [];
  for (const f of filas) {
    const resp = respondente(f, alias);
    const avisos: string[] = [];
    const nombreEquipo = columna(f, "Nombre del equipo").replace(/\s+/g, " ").trim();
    if (!nombreEquipo && !resp.email) continue;
    const capNombre = limpiarNombre(columna(f, "Nombre y apellidos del capitan")) || resp.nombre;
    const cap = correoJugador(capNombre, columna(f, "Correo institucional del capitan"), resp, avisos, alias);
    const capitan: Persona = { nombre: capNombre, email: cap.email, verificado: cap.verificado };

    // Integrantes: separados por saltos de línea, comas, "|" o ";"
    const nombres = columna(f, "integrantes")
      .split(/\r?\n|\||,|;/)
      .map((s) => limpiarNombre(s))
      .filter((s) => s && tokensNombre(s).length > 0);
    const unicos: string[] = [];
    for (const n of nombres) {
      if (!unicos.some((u) => tokensNombre(u).join(" ") === tokensNombre(n).join(" "))) unicos.push(n);
    }
    // Localiza al capitán en la lista (mejor coincidencia) y elimina repeticiones suyas.
    let idxCap = -1;
    let mejor = 0;
    unicos.forEach((n, i) => {
      const c = coincidenciaNombres(n, capNombre);
      if (c > mejor) [mejor, idxCap] = [c, i];
    });
    const jugadores: EquipoImport["jugadores"] = [];
    unicos.forEach((n, i) => {
      if (i === idxCap) jugadores.push({ ...capitan, nombre: tokensNombre(n).length >= tokensNombre(capNombre).length ? n : capNombre, esCapitan: true });
      else if (idxCap >= 0 && coincidenciaNombres(n, capNombre) >= 2) return; // el capitán, repetido en la lista
      else jugadores.push({ nombre: n, email: null, esCapitan: false });
    });
    if (idxCap < 0) jugadores.unshift({ ...capitan, esCapitan: true });
    // Quien rellena el Forms sin ser el capitán suele estar en la plantilla: se le pone el correo de su cuenta.
    if (resp.email && !jugadores.some((j) => j.email === resp.email)) {
      const suyos = jugadores.filter((j) => !j.email && coincidenciaNombres(j.nombre, resp.nombre) >= Math.min(2, tokensNombre(j.nombre).length));
      if (suyos.length === 1) Object.assign(suyos[0], { nombre: masCompleto(suyos[0].nombre, resp.nombre), email: resp.email, verificado: true });
    }

    const declarados = Number.parseInt(columna(f, "Número de jugadores"), 10);
    if (Number.isFinite(declarados) && declarados !== jugadores.length)
      avisos.push(`Declaran ${declarados} jugadores y la lista tiene ${jugadores.length}`);

    const horario = columna(f, "horario")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean)
      .join(" / ");
    const datos = {
      clave: capitan.email ?? resp.email ?? `equipo:${tokensNombre(nombreEquipo).join("-")}`,
      nombre: nombreEquipo || `Equipo de ${capNombre}`,
      capitan,
      telefono: columna(f, "teléfono") || null,
      horario: horario || null,
      jugadores,
    };
    lista.push({ ...datos, inscritoEn: resp.fecha, hash: "", avisos });
  }
  // Un equipo inscrito otra vez con otro capitán sigue siendo el mismo: se junta con su primera inscripción
  // (se queda su clave, así reimportar no lo duplica) y vale la inscripción más reciente.
  const canonica = new Map<string, string>();
  const raiz = (c: string): string => (canonica.has(c) ? raiz(canonica.get(c)!) : c);
  const porFecha = [...lista].sort((a, b) => (a.inscritoEn?.getTime() ?? 0) - (b.inscritoEn?.getTime() ?? 0));
  porFecha.forEach((r, i) => {
    const previo = porFecha.slice(0, i).find((p) => raiz(p.clave) !== raiz(r.clave) && mismoEquipo(p, r));
    if (!previo) return;
    canonica.set(raiz(r.clave), raiz(previo.clave));
    r.avisos.push(`Ya estaba inscrito con ${previo.capitan.nombre} de capitán: es el mismo equipo y vale la inscripción más reciente`);
  });
  for (const r of lista) r.clave = raiz(r.clave);
  const { registros, duplicadas } = deduplicar(lista, completarCorreos);
  return {
    registros: registros.map((r) => ({ ...r, hash: huella([r.nombre, r.capitan, r.telefono, r.horario, r.jugadores]) })),
    duplicadas,
    filas: filas.length,
    avisos: [],
  };
}

/* ─────────────────────────────── MUS ─────────────────────────────── */

export function parsearMus(filas: Fila[], alias: Alias = new Map()): ResultadoParse<ParejaImport> {
  const lista: ParejaImport[] = [];
  const incompletas = new Set<string>();
  for (const f of filas) {
    const resp = respondente(f, alias);
    const avisos: string[] = [];
    const integrantes: ParejaImport["integrantes"] = [];
    for (const orden of [1, 2]) {
      const nombre = limpiarNombre(columna(f, `Nombre y apellidos (Jugador ${orden})`));
      const escrito = columna(f, `Correo institucional (Jugador ${orden})`);
      if (!nombre && !escrito) continue;
      const { email, verificado } = correoJugador(nombre, escrito, resp, avisos, alias);
      const centro = columna(f, `centro estudias? (Jugador ${orden})`, `centro (Jugador ${orden})`) || null;
      integrantes.push({ orden, nombre: nombre || email || "Sin nombre", email, verificado, centro });
    }
    if (!integrantes.length) continue;
    // Media pareja no puede jugar: no se importa (si encuentra pareja, se crea a mano desde el panel).
    if (integrantes.length < 2) {
      incompletas.add(integrantes[0].nombre);
      continue;
    }

    const emails = integrantes.map((i) => i.email).filter((e): e is string => !!e).sort();
    const sinCorreo = integrantes.filter((i) => !i.email).map((i) => tokensNombre(i.nombre).join("-"));
    const clave = [...emails, ...sinCorreo].join("+") || `pareja:${resp.email}`;
    const nombrePareja = columna(f, "Nombre de la pareja").replace(/\s+/g, " ").trim();
    lista.push({ clave, nombre: nombrePareja, capitanEmail: resp.email, integrantes, inscritoEn: resp.fecha, hash: "", avisos });
  }
  const dedup = deduplicar(lista, (r, prev) => ({ ...r, nombre: r.nombre || prev.nombre }));
  const duplicadas = dedup.duplicadas;
  const registros = dedup.registros.map((r) => {
    const nombre = r.nombre || r.integrantes.map((i) => i.nombre.split(" ")[0]).join(" y ");
    return { ...r, nombre, hash: huella([nombre, r.capitanEmail, r.integrantes]) };
  });

  const avisos = [...incompletas].map((n) => `${n}: pareja incompleta (falta el segundo jugador), no se importa`);
  const parejasDe = new Map<string, string[]>();
  for (const p of registros)
    for (const i of p.integrantes) if (i.email) parejasDe.set(i.email, [...(parejasDe.get(i.email) ?? []), p.nombre]);
  for (const [email, ps] of parejasDe)
    if (ps.length > 1) avisos.push(`${email} aparece en varias parejas: ${ps.join(", ")}`);

  return { registros, duplicadas, filas: filas.length, avisos };
}

/* ────────────────────────────── PÓKER ────────────────────────────── */

export function parsearPoker(filas: Fila[], alias: Alias = new Map()): ResultadoParse<JugadorPokerImport> {
  const lista: (JugadorPokerImport & { clave: string })[] = [];
  for (const f of filas) {
    const resp = respondente(f, alias);
    const avisos: string[] = [];
    const escrito = corregirCorreo(columna(f, "Correo institucional"), alias);
    const email = resp.email ?? escrito.email;
    if (!email) continue;
    if (resp.email && escrito.email && escrito.email !== resp.email)
      avisos.push(`Se usa ${resp.email} en vez de «${columna(f, "Correo institucional")}»`);
    const datos = {
      email,
      nombre: resp.nombre || limpiarNombre(columna(f, "Nombre y apellidos")),
      centro: columna(f, "centro") || null,
      disponibilidad: columna(f, "Disponibilidad")
        .split(";")
        .map((s) => s.trim())
        .filter(Boolean),
      experiencia: columna(f, "experiencia") || null,
      traeFichas: /^s[ií]/i.test(columna(f, "fichas")),
    };
    lista.push({ ...datos, clave: email, inscritoEn: resp.fecha, hash: huella(datos), avisos });
    // (la huella no incluye la fecha: reinscribirse con los mismos datos no cuenta como cambio)
  }
  const { registros, duplicadas } = deduplicar(lista);
  return {
    registros: registros.map(({ clave, ...r }) => (void clave, r)),
    duplicadas,
    filas: filas.length,
    avisos: [],
  };
}

/* ─────────────────────── ACTIVIDADES (cualquier Forms) ─────────────────────── */

export type ParticipanteImport = { nombre: string; email: string | null; aviso?: string };

/**
 * Participantes de una actividad desde el CSV de cualquier Forms: usa el correo y el nombre de la cuenta que
 * respondió y, si no los hay, las columnas «correo» y «nombre». Una fila por persona; los correos repetidos se juntan.
 */
export function parsearParticipantes(filas: Fila[], alias: Alias = new Map()): ResultadoParse<ParticipanteImport> {
  const porClave = new Map<string, ParticipanteImport>();
  for (const f of filas) {
    const resp = respondente(f, alias);
    const escrito = corregirCorreo(columna(f, "Correo institucional", "Correo electrónico", "Correo"), alias);
    const email = resp.email ?? escrito.email;
    const nombre = resp.nombre || limpiarNombre(columna(f, "Nombre y apellidos", "Nombre completo", "Nombre"));
    if (!email && !nombre) continue;
    const clave = email ?? `nombre:${tokensNombre(nombre).join("-")}`;
    const aviso = !resp.email ? escrito.aviso : undefined;
    porClave.set(clave, { nombre: nombre || email!, email, ...(aviso ? { aviso } : {}) });
  }
  const registros = [...porClave.values()];
  return { registros, duplicadas: filas.length - registros.length, filas: filas.length, avisos: [] };
}
