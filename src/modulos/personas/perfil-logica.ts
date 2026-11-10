import { nombreRonda, ordenRonda, RONDA_TERCER_PUESTO } from "@/modulos/cuadros/logica";
import type { DatosCuadro } from "@/modulos/cuadros/tipos";
import type { DatosPoker } from "@/modulos/poker/tipos";
import type { Idioma } from "@/modulos/idioma/config";
import { ordinal, traductor, type T } from "@/modulos/idioma/traducir";
import type { PartidoPerfil, Podio } from "./tipos";

/* Perfil de una persona: cómo le va en cada cuadro o en el póker, con lo que ya se manda a las páginas (sin base de datos). */

type Recorrido = { partidos: PartidoPerfil[]; estado: string; podio: Podio };

const enMinuscula = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);

/**
 * Partidos de un equipo, pareja o participante en su cuadro, en orden de juego, y una frase de cómo va:
 * «En cuartos de final», «Fuera en octavos de final», «🏆 Ganan el torneo», «🥈 2º puesto»…
 * `plural`: equipos y parejas («Ganan»); una persona sola, en singular («Gana»).
 */
export function recorrido(d: DatosCuadro, id: number, plural: boolean, t: T = traductor("es")): Recorrido {
  const ronda = (r: number, total: number) => t(nombreRonda(r, total));
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
      ronda: ronda(p.ronda, total),
      rival: rival === null ? null : (nombre.get(rival) ?? null),
      marcador: mio === null || suyo === null ? null : `${mio}–${suyo}${extraMio !== null && extraSuyo !== null ? t(" (penaltis {marcador})", { marcador: `${extraMio}–${extraSuyo}` }) : ""}`,
      resultado: p.ganador === null ? null : p.ganador === id ? "V" : "D",
      fecha: p.fecha,
    };
  });

  if (!d.partidos.length) return { partidos, estado: t("El sorteo está por hacer"), podio: null };
  // Con los pases directos: sin ningún cruce, no está en el cuadro (p. ej. se apuntó después del sorteo).
  const todos = d.partidos.filter((p) => p.a === id || p.b === id);
  if (!todos.length) return { partidos, estado: t("Fuera del cuadro"), podio: null };
  const final = suyos.find((p) => p.ronda === total && p.ganador !== null);
  if (final) return final.ganador === id ? { partidos, estado: t(plural ? "🏆 Ganan el torneo" : "🏆 Gana el torneo"), podio: 1 } : { partidos, estado: t("🥈 2º puesto"), podio: 2 };
  const tercero = suyos.find((p) => p.ronda === RONDA_TERCER_PUESTO);
  if (tercero) {
    if (tercero.ganador === null) return { partidos, estado: t("Por el 3er puesto"), podio: null };
    return tercero.ganador === id ? { partidos, estado: t("🥉 3er puesto"), podio: 3 } : { partidos, estado: t("4º puesto"), podio: 4 };
  }
  const perdido = suyos.find((p) => p.ganador !== null && p.ganador !== id);
  if (perdido) return { partidos, estado: t("Fuera en {ronda}", { ronda: enMinuscula(ronda(perdido.ronda, total)) }), podio: null };
  // Sigue: en la ronda de su próximo cruce o, si todavía no está puesto, en la siguiente a la última que ganó.
  const sigue = (suyos.find((p) => p.ganador === null) ?? todos.find((p) => p.ganador === null))?.ronda ?? Math.max(...todos.map((p) => p.ronda)) + 1;
  if (sigue > total) return { partidos, estado: t("Fuera del cuadro"), podio: null };
  return { partidos, estado: sigue === total ? t("En la final") : t("En {ronda}", { ronda: enMinuscula(ronda(sigue, total)) }), podio: null };
}

/**
 * En el póker: su mesa clasificatoria y, si llega, la final, con su puesto. `companeros`: quien se sienta en su mesa
 * (la final, si está en ella).
 */
export function recorridoPoker(
  d: DatosPoker,
  t: T = traductor("es"),
  idioma: Idioma = "es",
): (Recorrido & { companeros: { nombre: string; perfil: string | null }[] }) | null {
  const mesa = d.clasificatorias.find((m) => m.asientos.some((a) => a.esYo));
  const final = d.final?.asientos.some((a) => a.esYo) ? d.final : null;
  if (!mesa && !final) {
    if (d.miEstado === "reserva") return { partidos: [], estado: t("En la lista de reserva"), podio: null, companeros: [] };
    if (d.miEstado === "inscrito") return { partidos: [], estado: t("Plaza confirmada · mesas por sortear"), podio: null, companeros: [] };
    return null;
  }
  const puestoEn = (m: NonNullable<typeof mesa>) => m.asientos.find((a) => a.esYo)?.puesto ?? null;
  const partidos: PartidoPerfil[] = [mesa, final]
    .filter((m): m is NonNullable<typeof mesa> => !!m)
    .map((m) => {
      const puesto = m.ganadorEsYo ? 1 : puestoEn(m);
      return {
        ronda: m.fase === "final" ? t("Mesa final") : t("Mesa {n}", { n: m.numero }),
        rival: null,
        marcador: puesto ? ordinal(puesto, idioma) : null,
        resultado: puesto === 1 ? "V" : puesto ? "D" : null,
        fecha: m.fecha,
      };
    });
  const donde = final ?? mesa!;
  const companeros = donde.asientos.filter((a) => !a.esYo).map((a) => ({ nombre: a.nombre, perfil: a.perfil }));
  if (final) {
    const puesto = final.ganadorEsYo ? 1 : puestoEn(final);
    if (puesto === 1) return { partidos, estado: t("🏆 Gana el torneo"), podio: 1, companeros };
    if (puesto)
      return {
        partidos,
        estado: `${puesto === 2 ? "🥈 " : puesto === 3 ? "🥉 " : ""}${t("{puesto} en la mesa final", { puesto: ordinal(puesto, idioma) })}`,
        podio: puesto <= 4 ? (puesto as Podio) : null,
        companeros,
      };
    return { partidos, estado: t("En la mesa final"), podio: null, companeros };
  }
  const puesto = mesa!.ganadorEsYo ? 1 : puestoEn(mesa!);
  if (puesto === 1) return { partidos, estado: t("👑 Gana la mesa {n}: a la mesa final", { n: mesa!.numero }), podio: null, companeros };
  if (puesto) return { partidos, estado: t("{puesto} en la mesa {n}", { puesto: ordinal(puesto, idioma), n: mesa!.numero }), podio: null, companeros };
  return { partidos, estado: t("Mesa {n}", { n: mesa!.numero }), podio: null, companeros };
}
