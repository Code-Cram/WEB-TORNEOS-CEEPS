import "server-only";
import { asc, ne } from "drizzle-orm";
import { db } from "@/db";
import { actividades, actividadParticipantes, actividadPartidos, futbolEquipos, futbolPartidos, musParejas, musPartidos, pokerMesas } from "@/db/schema";
import { TORNEOS } from "@/modulos/torneos/config";
import { nombreRonda } from "@/modulos/cuadros/logica";

/** Lo que tiene fecha y lugar: partidos de fútbol y mus, mesas de póker, eventos y partidos de las actividades. */
export type TipoCita = "futbol" | "mus" | "poker" | "evento" | "actividad";

export type ElementoCalendario = {
  tipo: TipoCita;
  id: number;
  /** «⚽ Fútbol Sala», «🍫 Chocolatada solidaria»… */
  grupo: string;
  /** Para mover un día solo de un torneo o actividad: futbol | mus | poker | actividad-<id>. */
  ambito: string;
  /** «Octavos de final · Los Ases – Vodka Juniors», «Mesa 3 · Martes 10 nov»… */
  detalle: string;
  fecha: Date | null;
  lugar: string | null;
  /** Página del panel con todo lo demás de ese torneo o actividad. */
  enlace: string;
};

/** Pases directos: no se juegan, así que no llevan fecha. */
const esPaseDirecto = (ronda: number, a: number | null, b: number | null) => ronda === 1 && (a === null) !== (b === null);

/** Todo lo que se puede fechar, con fecha primero (por orden) y sin fecha al final. Sin las actividades terminadas. */
export async function elementosCalendario(): Promise<ElementoCalendario[]> {
  const [equipos, partidosF, parejas, partidosM, mesas, acts, participantes, partidosA] = await Promise.all([
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
    db.select({ id: musParejas.id, nombre: musParejas.nombre }).from(musParejas),
    db.select().from(musPartidos).orderBy(asc(musPartidos.ronda), asc(musPartidos.posicion)),
    db.select().from(pokerMesas).orderBy(asc(pokerMesas.fase), asc(pokerMesas.numero)),
    db.select().from(actividades).where(ne(actividades.estado, "terminada")),
    db.select({ id: actividadParticipantes.id, nombre: actividadParticipantes.nombre }).from(actividadParticipantes),
    db.select().from(actividadPartidos).orderBy(asc(actividadPartidos.ronda), asc(actividadPartidos.posicion)),
  ]);
  const cruce = (nombres: Map<number, string>, ronda: number, total: number, a: number | null, b: number | null) =>
    `${nombreRonda(ronda, total)} · ${a ? (nombres.get(a) ?? "?") : "Por decidir"} – ${b ? (nombres.get(b) ?? "?") : "Por decidir"}`;

  const elementos: ElementoCalendario[] = [];
  const nEquipos = new Map(equipos.map((e) => [e.id, e.nombre]));
  const totalF = Math.max(0, ...partidosF.map((p) => p.ronda));
  for (const p of partidosF)
    if (!esPaseDirecto(p.ronda, p.localId, p.visitanteId))
      elementos.push({
        tipo: "futbol",
        id: p.id,
        grupo: `${TORNEOS.futbol.icono} ${TORNEOS.futbol.corto}`,
        ambito: "futbol",
        detalle: cruce(nEquipos, p.ronda, totalF, p.localId, p.visitanteId),
        fecha: p.fecha,
        lugar: p.lugar,
        enlace: "/admin/futbol",
      });
  const nParejas = new Map(parejas.map((p) => [p.id, p.nombre]));
  const totalM = Math.max(0, ...partidosM.map((p) => p.ronda));
  for (const p of partidosM)
    if (!esPaseDirecto(p.ronda, p.parejaAId, p.parejaBId))
      elementos.push({
        tipo: "mus",
        id: p.id,
        grupo: `${TORNEOS.mus.icono} ${TORNEOS.mus.corto}`,
        ambito: "mus",
        detalle: cruce(nParejas, p.ronda, totalM, p.parejaAId, p.parejaBId),
        fecha: p.fecha,
        lugar: p.lugar,
        enlace: "/admin/mus",
      });
  for (const m of mesas)
    elementos.push({
      tipo: "poker",
      id: m.id,
      grupo: `${TORNEOS.poker.icono} ${TORNEOS.poker.corto}`,
      ambito: "poker",
      detalle: `${m.fase === "final" ? "Mesa final" : `Mesa ${m.numero}`}${m.turno ? ` · ${m.turno}` : ""}`,
      fecha: m.fecha,
      lugar: m.lugar,
      enlace: "/admin/poker",
    });
  const nParticipantes = new Map(participantes.map((p) => [p.id, p.nombre]));
  for (const a of acts) {
    const base = { grupo: `${a.icono} ${a.nombre}`, ambito: `actividad-${a.id}`, enlace: `/admin/actividades/${a.id}` };
    if (a.tipo === "evento") elementos.push({ ...base, tipo: "evento", id: a.id, detalle: "Evento", fecha: a.fecha, lugar: a.lugar });
    else {
      const deEsta = partidosA.filter((p) => p.actividadId === a.id);
      const total = Math.max(0, ...deEsta.map((p) => p.ronda));
      for (const p of deEsta)
        if (!esPaseDirecto(p.ronda, p.aId, p.bId))
          elementos.push({ ...base, tipo: "actividad", id: p.id, detalle: cruce(nParticipantes, p.ronda, total, p.aId, p.bId), fecha: p.fecha, lugar: p.lugar });
    }
  }
  return elementos.sort(
    (a, b) => (a.fecha?.getTime() ?? Infinity) - (b.fecha?.getTime() ?? Infinity) || a.grupo.localeCompare(b.grupo, "es") || a.detalle.localeCompare(b.detalle, "es", { numeric: true }),
  );
}
