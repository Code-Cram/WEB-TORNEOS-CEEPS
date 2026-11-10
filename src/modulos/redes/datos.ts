import "server-only";
import { asc, inArray } from "drizzle-orm";
import { db } from "@/db";
import {
  actividades,
  actividadParticipantes,
  actividadPartidos,
  futbolEquipos,
  futbolPartidos,
  musPartidas,
  musParejas,
  musPartidos,
  pokerAsientos,
  pokerJugadores,
  pokerMesas,
} from "@/db/schema";
import { diaMadrid } from "@/modulos/asistencia/logica";
import { elementosCalendario } from "@/modulos/calendario/datos";
import { diaLargo, fechaCorta } from "@/modulos/compartido/formato";
import { nombreRonda, RONDA_TERCER_PUESTO } from "@/modulos/cuadros/logica";
import { TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { campeonActividad, campeonTorneo } from "@/modulos/torneos/ediciones";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { enumerar, publicacionDeAviso, type Publicacion, type Tema } from "./publicaciones";

const hora = (d: Date | string) => fechaCorta(typeof d === "string" ? d : d.toISOString())!.split(" · ")[1];
const cuando = (d: Date | null, lugar: string | null) => [d && fechaCorta(d.toISOString()), lugar].filter(Boolean).join(" · ");

/** Un partido de cuadro (fútbol, mus o actividad) ya jugado, para contarlo. */
type Jugado = {
  clave: string;
  tema: Tema;
  icono: string;
  torneo: string;
  ronda: number;
  total: number;
  a: string;
  b: string;
  marcador: string;
  extra: string | null;
  ganador: string;
  fecha: Date | null;
  lugar: string | null;
};

function publicacionJugado(j: Jugado): Publicacion {
  const ronda = nombreRonda(j.ronda, j.total);
  const destacado =
    j.ronda === RONDA_TERCER_PUESTO
      ? `¡${j.ganador} se queda el 3er puesto!`
      : j.ronda === j.total
        ? `¡${j.ganador} gana el torneo!`
        : `¡${j.ganador} pasa a ${j.ronda + 1 === j.total ? "la final" : nombreRonda(j.ronda + 1, j.total).toLowerCase()}!`;
  return {
    clave: j.clave,
    tipo: "resultado",
    tema: j.tema,
    icono: j.icono,
    antetitulo: `${j.torneo} · ${ronda}`.toUpperCase(),
    bloques: [{ titulo: `${j.a} ${j.marcador} ${j.b}`, lineas: [j.extra, cuando(j.fecha, j.lugar)].filter((x): x is string => !!x) }],
    destacado,
    orden: j.fecha?.toISOString() ?? "",
  };
}

/**
 * Todo lo que se puede publicar ahora: lo que se juega hoy y los próximos días, los resultados, los cuadros, la mesa final
 * del póker y los campeones. Con los nombres completos (lo decidió el Consejo).
 */
export async function publicaciones(ahora = new Date()): Promise<Publicacion[]> {
  const [info, calendario, equipos, partidosF, parejas, partidosM, partidas, mesas, asientos, jugadores, acts, participantes, partidosA] = await Promise.all([
    leerInfoTorneos(),
    elementosCalendario(),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos),
    db.select().from(futbolPartidos).orderBy(asc(futbolPartidos.ronda), asc(futbolPartidos.posicion)),
    db.select({ id: musParejas.id, nombre: musParejas.nombre }).from(musParejas),
    db.select().from(musPartidos).orderBy(asc(musPartidos.ronda), asc(musPartidos.posicion)),
    db.select().from(musPartidas).orderBy(asc(musPartidas.numero)),
    db.select().from(pokerMesas).orderBy(asc(pokerMesas.numero)),
    db.select().from(pokerAsientos),
    db.select({ email: pokerJugadores.email, nombre: pokerJugadores.nombre }).from(pokerJugadores),
    db.select().from(actividades).where(inArray(actividades.estado, ["activa", "terminada"])),
    db.select({ id: actividadParticipantes.id, nombre: actividadParticipantes.nombre }).from(actividadParticipantes),
    db.select().from(actividadPartidos).orderBy(asc(actividadPartidos.ronda), asc(actividadPartidos.posicion)),
  ]);
  const lista: Publicacion[] = [];
  const nombreTorneo = (t: TorneoId) => info[t].nombre;

  /* ── Avisos destacados de cada torneo y actividad (cambios de lugar, de fecha…) ── */
  for (const t of ["futbol", "mus", "poker"] as const) {
    const p = publicacionDeAviso({ clave: `aviso-${t}`, tema: t, nombre: nombreTorneo(t), aviso: info[t].aviso });
    if (p && !info[t].finalizado) lista.push(p);
  }
  for (const a of acts.filter((x) => x.estado === "activa")) {
    const p = publicacionDeAviso({ clave: `aviso-actividad-${a.id}`, tema: "actividad", nombre: a.nombre, aviso: a.aviso ?? "" });
    if (p) lista.push(p);
  }

  /* ── Lo que se juega hoy y los próximos días (los cinco primeros días con algo) ── */
  const hoy = diaMadrid(ahora);
  const manana = diaMadrid(new Date(ahora.getTime() + 86_400_000));
  const lugarDe = (ambito: string) =>
    ambito in info ? info[ambito as TorneoId].lugar : (acts.find((a) => `actividad-${a.id}` === ambito)?.lugar ?? "");
  const proximos = Object.entries(Object.groupBy(calendario.filter((e) => e.fecha && diaMadrid(e.fecha) >= hoy), (e) => diaMadrid(e.fecha!)))
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(0, 5);
  for (const [dia, delDia = []] of proximos) {
    const bloques = Object.values(Object.groupBy(delDia, (e) => e.ambito)).map((grupo = []) => {
      const horas = [...new Set(grupo.map((e) => hora(e.fecha!)))].sort();
      const lugares = [...new Set(grupo.map((e) => e.lugar || lugarDe(e.ambito)).filter(Boolean))];
      const detalles =
        grupo[0].tipo === "poker"
          ? [`Mesas ${enumerar(grupo.map((e) => e.detalle.split(" · ")[0].replace(/^Mesa /, "")))}`]
          : grupo[0].tipo === "evento"
            ? []
            : grupo.length <= 4
              ? grupo.map((e) => e.detalle)
              : [`${grupo.length} partidos`];
      return { titulo: grupo[0].grupo, lineas: [`🕓 ${enumerar(horas)}${lugares.length ? ` · 📍 ${lugares.join(" / ")}` : ""}`, ...detalles] };
    });
    lista.push({
      clave: `dia-${dia}`,
      tipo: "dia",
      tema: "general",
      icono: "📅",
      antetitulo: `${dia === hoy ? "HOY · " : dia === manana ? "MAÑANA · " : ""}${diaLargo(dia).toUpperCase()}`,
      bloques,
      destacado: "Confirma en la web si vienes",
      orden: dia,
    });
  }

  /* ── Resultados ── */
  const nEquipo = new Map(equipos.map((e) => [e.id, e.nombre]));
  const totalF = Math.max(0, ...partidosF.map((p) => p.ronda));
  for (const p of partidosF)
    if (p.ganadorId && p.localId && p.visitanteId && p.golesLocal !== null)
      lista.push(
        publicacionJugado({
          clave: `resultado-futbol-${p.id}`,
          tema: "futbol",
          icono: TORNEOS.futbol.icono,
          torneo: nombreTorneo("futbol"),
          ronda: p.ronda,
          total: totalF,
          a: nEquipo.get(p.localId) ?? "?",
          b: nEquipo.get(p.visitanteId) ?? "?",
          marcador: `${p.golesLocal} – ${p.golesVisitante}`,
          extra: p.penaltisLocal !== null ? `Penaltis: ${p.penaltisLocal} – ${p.penaltisVisitante}` : null,
          ganador: nEquipo.get(p.ganadorId) ?? "?",
          fecha: p.fecha,
          lugar: p.lugar,
        }),
      );
  const nPareja = new Map(parejas.map((p) => [p.id, p.nombre]));
  const totalM = Math.max(0, ...partidosM.map((p) => p.ronda));
  for (const p of partidosM)
    if (p.ganadorId && p.parejaAId && p.parejaBId && p.partidasA !== null) {
      const tantos = partidas.filter((x) => x.partidoId === p.id).map((x) => `${x.tantosA}-${x.tantosB}`);
      lista.push(
        publicacionJugado({
          clave: `resultado-mus-${p.id}`,
          tema: "mus",
          icono: TORNEOS.mus.icono,
          torneo: nombreTorneo("mus"),
          ronda: p.ronda,
          total: totalM,
          a: nPareja.get(p.parejaAId) ?? "?",
          b: nPareja.get(p.parejaBId) ?? "?",
          marcador: `${p.partidasA} – ${p.partidasB}`,
          extra: tantos.length ? `Partidas: ${tantos.join(", ")}` : null,
          ganador: nPareja.get(p.ganadorId) ?? "?",
          fecha: p.fecha,
          lugar: p.lugar,
        }),
      );
    }
  const nParticipante = new Map(participantes.map((p) => [p.id, p.nombre]));
  for (const a of acts.filter((a) => a.tipo === "torneo")) {
    const deEsta = partidosA.filter((p) => p.actividadId === a.id);
    const total = Math.max(0, ...deEsta.map((p) => p.ronda));
    for (const p of deEsta)
      if (p.ganadorId && p.aId && p.bId && p.puntosA !== null)
        lista.push(
          publicacionJugado({
            clave: `resultado-actividad-${p.id}`,
            tema: "actividad",
            icono: a.icono,
            torneo: a.nombre,
            ronda: p.ronda,
            total,
            a: nParticipante.get(p.aId) ?? "?",
            b: nParticipante.get(p.bId) ?? "?",
            marcador: `${p.puntosA} – ${p.puntosB}`,
            extra: null,
            ganador: nParticipante.get(p.ganadorId) ?? "?",
            fecha: p.fecha,
            lugar: p.lugar,
          }),
        );
  }
  const nJugador = new Map(jugadores.map((j) => [j.email, j.nombre]));
  for (const m of mesas)
    if (m.ganadorEmail) {
      const ganador = nJugador.get(m.ganadorEmail) ?? "?";
      const esFinal = m.fase === "final";
      lista.push({
        clave: `resultado-poker-${m.id}`,
        tipo: "resultado",
        tema: "poker",
        icono: TORNEOS.poker.icono,
        antetitulo: `${nombreTorneo("poker")} · ${esFinal ? "Mesa final" : `Mesa ${m.numero}`}`.toUpperCase(),
        bloques: [{ titulo: `Gana ${ganador}`, lineas: [cuando(m.fecha, m.lugar)].filter(Boolean) }],
        destacado: esFinal ? `¡${ganador} gana el torneo!` : `¡${ganador} pasa a la mesa final!`,
        orden: m.fecha?.toISOString() ?? "",
      });
    }

  /* ── Cuadros: la primera ronda de cada eliminatoria ── */
  const cuadro = (clave: string, tema: Tema, icono: string, torneo: string, ronda1: { a: string | null; b: string | null }[], total: number) => {
    if (!ronda1.length) return;
    const cruces = ronda1.filter((c) => c.a && c.b).map((c) => `${c.a} – ${c.b}`);
    const pases = ronda1.filter((c) => !c.a !== !c.b).map((c) => c.a ?? c.b!);
    lista.push({
      clave,
      tipo: "cuadro",
      tema,
      icono,
      antetitulo: `${torneo} · Así queda el cuadro`.toUpperCase(),
      bloques: [
        { titulo: nombreRonda(1, total), lineas: cruces },
        ...(pases.length ? [{ titulo: `Pase directo a ${total === 2 ? "la final" : nombreRonda(2, total).toLowerCase()}`, lineas: [enumerar(pases)] }] : []),
      ],
      destacado: "Mira tu cruce en la web",
      orden: "",
    });
  };
  cuadro("cuadro-futbol", "futbol", TORNEOS.futbol.icono, nombreTorneo("futbol"), partidosF.filter((p) => p.ronda === 1).map((p) => ({ a: p.localId ? (nEquipo.get(p.localId) ?? null) : null, b: p.visitanteId ? (nEquipo.get(p.visitanteId) ?? null) : null })), totalF);
  cuadro("cuadro-mus", "mus", TORNEOS.mus.icono, nombreTorneo("mus"), partidosM.filter((p) => p.ronda === 1).map((p) => ({ a: p.parejaAId ? (nPareja.get(p.parejaAId) ?? null) : null, b: p.parejaBId ? (nPareja.get(p.parejaBId) ?? null) : null })), totalM);

  /* ── Mesa final del póker, en cuanto tiene a alguien ── */
  const final = mesas.find((m) => m.fase === "final");
  const sentados = final ? asientos.filter((a) => a.mesaId === final.id).sort((x, y) => x.asiento - y.asiento) : [];
  if (final && sentados.length)
    lista.push({
      clave: "final-poker",
      tipo: "final",
      tema: "poker",
      icono: TORNEOS.poker.icono,
      antetitulo: `${nombreTorneo("poker")} · Mesa final`.toUpperCase(),
      bloques: [{ titulo: cuando(final.fecha, final.lugar || info.poker.lugar) || "Mesa final", lineas: sentados.map((a) => `${a.asiento}. ${nJugador.get(a.jugadorEmail) ?? "?"}`) }],
      destacado: sentados.length === 8 ? "¡Ya están los 8! Mucha suerte" : `${sentados.length} de 8 ya en la mesa final`,
      orden: final.fecha?.toISOString() ?? "",
    });

  /* ── Campeones ── */
  for (const t of ["futbol", "mus", "poker"] as const)
    if (info[t].finalizado) {
      const c = await campeonTorneo(db, t);
      if (c)
        lista.push({
          clave: `campeon-${t}`,
          tipo: "campeon",
          tema: t,
          icono: "🏆",
          antetitulo: `${nombreTorneo(t)} · ¡Campeones!`.toUpperCase(),
          bloques: [{ titulo: c.campeon, lineas: c.detalle ? [c.detalle] : [] }],
          destacado: "¡Enhorabuena!",
          orden: "",
        });
    }
  for (const a of acts.filter((a) => a.tipo === "torneo" && a.estado === "terminada")) {
    const c = await campeonActividad(db, a.id);
    if (c)
      lista.push({
        clave: `campeon-actividad-${a.id}`,
        tipo: "campeon",
        tema: "actividad",
        icono: "🏆",
        antetitulo: `${a.nombre} · ¡Campeones!`.toUpperCase(),
        bloques: [{ titulo: c.campeon, lineas: c.detalle ? [c.detalle] : [] }],
        destacado: "¡Enhorabuena!",
        orden: "",
      });
  }
  return lista;
}

/** Una publicación por su clave (para sus imágenes). */
export async function publicacion(clave: string): Promise<Publicacion | null> {
  return (await publicaciones()).find((p) => p.clave === clave) ?? null;
}
