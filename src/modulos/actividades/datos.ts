import "server-only";
import { and, asc, desc, eq, inArray, ne } from "drizzle-orm";
import { db } from "@/db";
import { actividades, actividadMiembros, actividadParticipantes, actividadPartidos } from "@/db/schema";
import type { Idioma } from "@/modulos/idioma/config";
import type { InfoTorneo } from "@/modulos/torneos/info";
import type { DatosCuadro } from "@/modulos/cuadros/tipos";
import { perfilesPorCorreo } from "@/modulos/personas/perfiles";

export type Actividad = typeof actividades.$inferSelect;

/** Los slugs solo tienen minúsculas, números y guiones: cualquier otra cosa en la URL no es una actividad. */
const SLUG_VALIDO = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function listarActividades(incluirBorradores: boolean) {
  return db
    .select()
    .from(actividades)
    .where(incluirBorradores ? undefined : ne(actividades.estado, "borrador"))
    .orderBy(desc(actividades.creadoEn));
}

export async function actividadPorSlug(slug: string): Promise<Actividad | null> {
  if (!SLUG_VALIDO.test(slug) || slug.length > 60) return null;
  const [a] = await db.select().from(actividades).where(eq(actividades.slug, slug));
  return a ?? null;
}

export async function actividadPorId(id: number): Promise<Actividad | null> {
  if (!Number.isSafeInteger(id)) return null;
  const [a] = await db.select().from(actividades).where(eq(actividades.id, id));
  return a ?? null;
}

/** Actividades visibles (no borradores) en las que está este correo. */
export async function actividadesDe(email: string) {
  const filas = await db
    .select({
      id: actividades.id,
      slug: actividades.slug,
      nombre: actividades.nombre,
      icono: actividades.icono,
      tipo: actividades.tipo,
      lema: actividades.lema,
      estado: actividades.estado,
      participante: actividadParticipantes.nombre,
    })
    .from(actividadMiembros)
    .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
    .innerJoin(actividades, eq(actividades.id, actividadParticipantes.actividadId))
    .where(and(eq(actividadMiembros.email, email), ne(actividades.estado, "borrador")))
    .orderBy(desc(actividades.creadoEn));
  return filas.filter((f, i) => filas.findIndex((g) => g.id === f.id) === i);
}

/** Textos de una actividad que el Consejo puede escribir también en inglés (columna `en`). */
export const CAMPOS_ACTIVIDAD_EN_INGLES = ["nombre", "lema", "lugar", "aviso", "calendario", "descripcion", "infoParticipantes"] as const;

/** La actividad con sus textos en el idioma de quien la ve: en inglés, lo que haya escrito el Consejo; lo demás, en español. */
export function enSuIdioma(a: Actividad, idioma: Idioma): Actividad {
  if (idioma === "es") return a;
  const en = a.en ?? {};
  return { ...a, ...Object.fromEntries(CAMPOS_ACTIVIDAD_EN_INGLES.filter((c) => en[c]?.trim()).map((c) => [c, en[c]])) };
}

/** La ficha de la actividad con el mismo formato que la de los torneos fijos. */
export function infoDeActividad(original: Actividad, idioma: Idioma = "es"): InfoTorneo {
  const a = enSuIdioma(original, idioma);
  return {
    nombre: a.nombre,
    lema: a.lema ?? "",
    lugar: a.lugar ?? "",
    calendario: a.calendario ?? "",
    formato: a.descripcion ?? "",
    premios: "",
    reglas: "",
    aviso: a.aviso ?? "",
    enlaceInscripcion: a.enlaceInscripcion ?? "",
    cierreInscripcion: a.cierreInscripcion?.toISOString() ?? null,
    finalizado: a.estado === "terminada",
  };
}

/** Participantes con sus personas (para el panel: incluye correos). */
export async function participantesDe(actividadId: number) {
  const participantes = await db
    .select()
    .from(actividadParticipantes)
    .where(eq(actividadParticipantes.actividadId, actividadId))
    .orderBy(asc(actividadParticipantes.nombre));
  const miembros = participantes.length
    ? await db
        .select()
        .from(actividadMiembros)
        .where(
          inArray(
            actividadMiembros.participanteId,
            participantes.map((p) => p.id),
          ),
        )
        .orderBy(asc(actividadMiembros.orden))
    : [];
  return participantes.map((p) => ({ ...p, miembros: miembros.filter((m) => m.participanteId === p.id) }));
}

/** Lo que ve un participante: su nombre o equipo, su nota personal y sus compañeros (sin correos). */
export async function miParticipacion(actividadId: number, email: string) {
  const [p] = await db
    .select({ id: actividadParticipantes.id, nombre: actividadParticipantes.nombre, nota: actividadParticipantes.nota })
    .from(actividadMiembros)
    .innerJoin(actividadParticipantes, eq(actividadParticipantes.id, actividadMiembros.participanteId))
    .where(and(eq(actividadParticipantes.actividadId, actividadId), eq(actividadMiembros.email, email)));
  if (!p) return null;
  const companeros = await db
    .select({ nombre: actividadMiembros.nombre, email: actividadMiembros.email })
    .from(actividadMiembros)
    .where(eq(actividadMiembros.participanteId, p.id))
    .orderBy(asc(actividadMiembros.orden));
  return { nombre: p.nombre, nota: p.nota, miembros: companeros.map((c) => ({ nombre: c.nombre, esYo: c.email === email })) };
}

/** Cuadro de una actividad de tipo torneo, con el formato de fútbol y mus (sin correos). */
export async function cuadroDeActividad(actividadId: number, email: string | null): Promise<DatosCuadro> {
  const [participantes, partidos, perfiles] = await Promise.all([
    participantesDe(actividadId),
    db
      .select()
      .from(actividadPartidos)
      .where(eq(actividadPartidos.actividadId, actividadId))
      .orderBy(asc(actividadPartidos.ronda), asc(actividadPartidos.posicion)),
    perfilesPorCorreo(),
  ]);
  return {
    equipos: participantes.map((p) => ({
      id: p.id,
      nombre: p.nombre,
      esMio: !!email && p.miembros.some((m) => m.email === email),
      jugadores: p.miembros.map((m) => ({ nombre: m.nombre, esCapitan: false, esYo: !!email && m.email === email, perfil: (m.email && perfiles.get(m.email)) || null })),
    })),
    partidos: partidos.map((p) => ({
      id: p.id,
      ronda: p.ronda,
      posicion: p.posicion,
      a: p.aId,
      b: p.bId,
      marcadorA: p.puntosA,
      marcadorB: p.puntosB,
      extraA: null,
      extraB: null,
      mejorDe: null,
      ganador: p.ganadorId,
      fecha: p.fecha?.toISOString() ?? null,
      lugar: p.lugar,
      notas: p.notas,
      detalle: [],
    })),
  };
}

export async function contarParticipantes(actividadId: number) {
  return db.$count(actividadParticipantes, eq(actividadParticipantes.actividadId, actividadId));
}
