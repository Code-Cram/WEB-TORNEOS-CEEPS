import { nombreRonda, ordenRonda, RONDA_TERCER_PUESTO } from "@/modulos/cuadros/logica";
import type { DatosCuadro } from "@/modulos/cuadros/tipos";
import type { DatosPoker } from "@/modulos/poker/tipos";
import type { PartidoPerfil, Podio } from "./tipos";

/* Perfil de una persona: cómo le va en cada cuadro o en el póker, con lo que ya se manda a las páginas (sin base de datos). */

type Recorrido = { partidos: PartidoPerfil[]; estado: string; podio: Podio };

const enMinuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Partidos de un equipo, pareja o participante en su cuadro, en orden de juego, y una frase de cómo va:
 * «En cuartos de final», «Fuera en octavos de final», «🏆 Ganan el torneo», «🥈 2º puesto»…
 * `plural`: equipos y parejas («Ganan»); una persona sola, en singular («Gana»).
 */
export function recorrido(d: DatosCuadro, id: number, plural: boolean): Recorrido {
  const total = Math.max(0, ...d.partidos.map((p) => p.ronda));
  const nombre = new Map(d.equipos.map((e) => [e.id, e.nombre]));
  const suyos = d.partidos
    .filter((p) => (p.a === id || p.b === id) && !(p.ronda === 1 && (p.a === null || p.b === null)))
    .sort((x, y) => ordenRonda(x.ronda, total) - ordenRonda(y.ronda, total));
  const partidos: PartidoPerfil[] = suyos.map((p) => {
    const soyA = p.a === id;
    const [mio, suyo, extraMio, extraSuyo] = soyA ? [p.marcadorA, p.marcadorB, p.extraA, p.extraB] : [p.marcadorB, p.marcadorA, p.extraB, p.extraA];
    const rival = soyA ? p.b : p.a;
    return {
      ronda: nombreRonda(p.ronda, total),
      rival: rival === null ? null : (nombre.get(rival) ?? null),
      marcador: mio === null || suyo === null ? null : `${mio}–${suyo}${extraMio !== null && extraSuyo !== null ? ` (penaltis ${extraMio}–${extraSuyo})` : ""}`,
      resultado: p.ganador === null ? null : p.ganador === id ? "V" : "D",
      fecha: p.fecha,
    };
  });

  if (!d.partidos.length) return { partidos, estado: "El sorteo está por hacer", podio: null };
  // Con los pases directos: sin ningún cruce, no está en el cuadro (p. ej. se apuntó después del sorteo).
  const todos = d.partidos.filter((p) => p.a === id || p.b === id);
  if (!todos.length) return { partidos, estado: "Fuera del cuadro", podio: null };
  const final = suyos.find((p) => p.ronda === total && p.ganador !== null);
  if (final) return final.ganador === id ? { partidos, estado: plural ? "🏆 Ganan el torneo" : "🏆 Gana el torneo", podio: 1 } : { partidos, estado: "🥈 2º puesto", podio: 2 };
  const tercero = suyos.find((p) => p.ronda === RONDA_TERCER_PUESTO);
  if (tercero) {
    if (tercero.ganador === null) return { partidos, estado: "Por el 3er puesto", podio: null };
    return tercero.ganador === id ? { partidos, estado: "🥉 3er puesto", podio: 3 } : { partidos, estado: "4º puesto", podio: 4 };
  }
  const perdido = suyos.find((p) => p.ganador !== null && p.ganador !== id);
  if (perdido) return { partidos, estado: `Fuera en ${enMinuscula(nombreRonda(perdido.ronda, total))}`, podio: null };
  // Sigue: en la ronda de su próximo cruce o, si todavía no está puesto, en la siguiente a la última que ganó.
  const ronda = (suyos.find((p) => p.ganador === null) ?? todos.find((p) => p.ganador === null))?.ronda ?? Math.max(...todos.map((p) => p.ronda)) + 1;
  if (ronda > total) return { partidos, estado: "Fuera del cuadro", podio: null };
  return { partidos, estado: ronda === total ? "En la final" : `En ${enMinuscula(nombreRonda(ronda, total))}`, podio: null };
}

/**
 * En el póker: su mesa clasificatoria y, si llega, la final, con su puesto. `companeros`: quien se sienta en su mesa
 * (la final, si está en ella).
 */
export function recorridoPoker(d: DatosPoker): Recorrido & { companeros: { nombre: string; perfil: string | null }[] } | null {
  const mesa = d.clasificatorias.find((m) => m.asientos.some((a) => a.esYo));
  const final = d.final?.asientos.some((a) => a.esYo) ? d.final : null;
  if (!mesa && !final) {
    if (d.miEstado === "reserva") return { partidos: [], estado: "En la lista de reserva", podio: null, companeros: [] };
    if (d.miEstado === "inscrito") return { partidos: [], estado: "Plaza confirmada · mesas por sortear", podio: null, companeros: [] };
    return null;
  }
  const puestoEn = (m: NonNullable<typeof mesa>) => m.asientos.find((a) => a.esYo)?.puesto ?? null;
  const partidos: PartidoPerfil[] = [mesa, final]
    .filter((m): m is NonNullable<typeof mesa> => !!m)
    .map((m) => {
      const puesto = m.ganadorEsYo ? 1 : puestoEn(m);
      return {
        ronda: m.fase === "final" ? "Mesa final" : `Mesa ${m.numero}`,
        rival: null,
        marcador: puesto ? `${puesto}º` : null,
        resultado: puesto === 1 ? "V" : puesto ? "D" : null,
        fecha: m.fecha,
      };
    });
  const donde = final ?? mesa!;
  const companeros = donde.asientos.filter((a) => !a.esYo).map((a) => ({ nombre: a.nombre, perfil: a.perfil }));
  if (final) {
    const puesto = final.ganadorEsYo ? 1 : puestoEn(final);
    if (puesto === 1) return { partidos, estado: "🏆 Gana el torneo", podio: 1, companeros };
    if (puesto) return { partidos, estado: `${puesto === 2 ? "🥈 " : puesto === 3 ? "🥉 " : ""}${puesto}º en la mesa final`, podio: puesto <= 4 ? (puesto as Podio) : null, companeros };
    return { partidos, estado: "En la mesa final", podio: null, companeros };
  }
  const puesto = mesa!.ganadorEsYo ? 1 : puestoEn(mesa!);
  if (puesto === 1) return { partidos, estado: `👑 Gana la mesa ${mesa!.numero}: a la mesa final`, podio: null, companeros };
  if (puesto) return { partidos, estado: `${puesto}º en la mesa ${mesa!.numero}`, podio: null, companeros };
  return { partidos, estado: `Mesa ${mesa!.numero}`, podio: null, companeros };
}
