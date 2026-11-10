import "server-only";
import { and, arrayContains, desc, eq, ne, sql } from "drizzle-orm";
import { db } from "@/db";
import { actividades, actividadMiembros, actividadParticipantes, archivo, palmares, usuarios } from "@/db/schema";
import { torneosDe } from "@/modulos/acceso/inscripciones";
import { esAdmin } from "@/modulos/acceso/sesion";
import { cuadroDeActividad } from "@/modulos/actividades/datos";
import { fechaCorta } from "@/modulos/compartido/formato";
import { datosFutbol } from "@/modulos/futbol/datos";
import { datosMus } from "@/modulos/mus/datos";
import { datosPoker } from "@/modulos/poker/datos";
import { TORNEOS } from "@/modulos/torneos/config";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { recorrido, recorridoPoker } from "./perfil-logica";
import type { PerfilVista, TituloPerfil, TorneoPerfil } from "./tipos";

/** Los identificadores de perfil son 12 caracteres hexadecimales (ver sql/2026-11-10-perfiles.sql). */
export const esIdPerfil = (id: string) => /^[0-9a-f]{12}$/.test(id);

/** Perfil de una persona por su identificador: sus torneos de esta edición, cómo le va, sus títulos y ediciones anteriores. */
export async function perfilDe(id: string, quienMira: string): Promise<PerfilVista | null> {
  if (!esIdPerfil(id)) return null;
  const [u] = await db.select({ email: usuarios.email, nombre: usuarios.nombre }).from(usuarios).where(eq(usuarios.perfil, id));
  if (!u) return null;

  const [info, admin, delQueMira, futbol, mus, poker, enActividades, titulos, anteriores] = await Promise.all([
    leerInfoTorneos(),
    esAdmin(),
    torneosDe(quienMira),
    datosFutbol(u.email),
    datosMus(u.email),
    datosPoker(u.email),
    db
      .select({
        id: actividades.id,
        slug: actividades.slug,
        nombre: actividades.nombre,
        icono: actividades.icono,
        tipo: actividades.tipo,
        porEquipos: actividades.porEquipos,
        estado: actividades.estado,
        fecha: actividades.fecha,
        participanteId: actividadParticipantes.id,
        participante: actividadParticipantes.nombre,
      })
      .from(actividadMiembros)
      .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
      .innerJoin(actividades, eq(actividades.id, actividadParticipantes.actividadId))
      .where(and(eq(actividadMiembros.email, u.email), ne(actividades.estado, "borrador")))
      .orderBy(desc(actividades.creadoEn)),
    db.select().from(palmares).where(arrayContains(palmares.emails, [u.email])).orderBy(desc(palmares.fecha), desc(palmares.id)),
    // El archivo guarda cada edición cerrada tal cual: el correo entre comillas está si jugó en ella.
    db
      .select({ nombre: archivo.nombre })
      .from(archivo)
      .where(sql`strpos(${archivo.datos}::text, ${`"${u.email}"`}) > 0`)
      .orderBy(desc(archivo.creadoEn)),
  ]);

  // Quien mira solo tiene enlace a las páginas que puede ver (las suyas, las terminadas o todas si es del Consejo).
  const puedeVer = (t: "futbol" | "mus" | "poker") => admin || !!delQueMira[t] || info[t].finalizado;
  const misActividades = new Set(delQueMira.actividades.map((a) => a.id));
  const torneos: TorneoPerfil[] = [];

  const equipo = futbol.equipos.find((e) => e.esMio);
  if (equipo) {
    const r = recorrido(futbol, equipo.id, true);
    torneos.push({
      clave: "futbol",
      tema: "futbol",
      icono: TORNEOS.futbol.icono,
      nombre: info.futbol.nombre,
      href: puedeVer("futbol") ? TORNEOS.futbol.ruta : null,
      unidad: equipo.nombre,
      capitania: equipo.jugadores.some((j) => j.esYo && j.esCapitan),
      ...r,
      companeros: equipo.jugadores.filter((j) => !j.esYo).map((j) => ({ nombre: j.nombre, perfil: j.perfil })),
      tituloCompaneros: "Su equipo",
    });
  }
  const pareja = mus.equipos.find((e) => e.esMio);
  if (pareja) {
    const r = recorrido(mus, pareja.id, true);
    torneos.push({
      clave: "mus",
      tema: "mus",
      icono: TORNEOS.mus.icono,
      nombre: info.mus.nombre,
      href: puedeVer("mus") ? TORNEOS.mus.ruta : null,
      unidad: pareja.nombre,
      capitania: false,
      ...r,
      companeros: pareja.jugadores.filter((j) => !j.esYo).map((j) => ({ nombre: j.nombre, perfil: j.perfil })),
      tituloCompaneros: "Su pareja",
    });
  }
  const enPoker = recorridoPoker(poker);
  if (enPoker)
    torneos.push({
      clave: "poker",
      tema: "poker",
      icono: TORNEOS.poker.icono,
      nombre: info.poker.nombre,
      href: puedeVer("poker") ? TORNEOS.poker.ruta : null,
      unidad: null,
      capitania: false,
      ...enPoker,
      tituloCompaneros: poker.final?.asientos.some((a) => a.esYo) ? "En la mesa final" : "En su mesa",
    });

  const vistas = new Set<number>();
  for (const a of enActividades) {
    if (vistas.has(a.id)) continue;
    vistas.add(a.id);
    const href = admin || misActividades.has(a.id) || (a.estado === "terminada" && a.tipo === "torneo") ? `/actividades/${a.slug}` : null;
    const base = { clave: `actividad-${a.id}`, tema: "actividad" as const, icono: a.icono, nombre: a.nombre, href, capitania: false };
    if (a.tipo === "torneo") {
      const cuadro = await cuadroDeActividad(a.id, u.email);
      const suyo = cuadro.equipos.find((e) => e.id === a.participanteId);
      torneos.push({
        ...base,
        unidad: a.porEquipos ? a.participante : null,
        ...recorrido(cuadro, a.participanteId, a.porEquipos),
        companeros: (suyo?.jugadores ?? []).filter((j) => !j.esYo).map((j) => ({ nombre: j.nombre, perfil: j.perfil })),
        tituloCompaneros: "Su equipo",
      });
    } else
      torneos.push({
        ...base,
        unidad: null,
        estado: a.fecha ? `📅 ${fechaCorta(a.fecha.toISOString())}` : a.estado === "terminada" ? "Terminada" : "En la lista",
        podio: null,
        companeros: [],
        tituloCompaneros: "",
        partidos: [],
      });
  }

  const MEDALLA = { 1: "🏆", 2: "🥈", 3: "🥉" } as const;
  const PUESTO = { 1: "1er puesto", 2: "2º puesto", 3: "3er puesto" } as const;
  const deEstaEdicion: TituloPerfil[] = torneos
    .filter((t): t is TorneoPerfil & { podio: 1 | 2 | 3 } => t.podio === 1 || t.podio === 2 || t.podio === 3)
    .map((t) => ({ icono: MEDALLA[t.podio], texto: t.nombre, detalle: [PUESTO[t.podio], t.unidad && `con «${t.unidad}»`].filter(Boolean).join(" · ") }));
  const deOtras: TituloPerfil[] = titulos.map((p) => ({
    icono: p.icono ?? "🏆",
    texto: p.actividad,
    detalle: [p.edicion, "1er puesto", p.campeon !== u.nombre && `con «${p.campeon}»`].filter(Boolean).join(" · "),
  }));

  return {
    nombre: u.nombre,
    esYo: u.email === quienMira,
    torneos,
    titulos: [...deEstaEdicion, ...deOtras],
    anteriores: anteriores.map((a) => a.nombre),
  };
}

/** Identificador del perfil de un correo (para el enlace «Tu perfil»). */
export async function perfilDeCorreo(email: string): Promise<string | null> {
  const [u] = await db.select({ perfil: usuarios.perfil }).from(usuarios).where(eq(usuarios.email, email));
  return u?.perfil ?? null;
}
