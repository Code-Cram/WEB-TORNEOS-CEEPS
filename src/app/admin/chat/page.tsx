import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { actividades } from "@/db/schema";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { Conversacion } from "@/components/chat/conversacion";
import { grupoAsistencia, type TipoAsistencia } from "@/lib/asistencia";
import { agendaAsistencia } from "@/lib/asistencia-datos";
import { bandeja, mensajesConsejo, salasConMensajes } from "@/lib/chat";
import { diaCorto, diaLargo, fechaCorta } from "@/lib/formato";
import { canalDe, origenDe, type CanalConsejo, type OrigenChat } from "@/lib/sala-chat";
import { exigirAdmin } from "@/lib/sesion";
import { borrarMensajeConsejo, escribirConsejo, marcarLeidoConsejo } from "./acciones";

export const metadata: Metadata = { title: "Panel · Chat" };

/** La consulta de un canal, igual para la dirección del panel y para pedir sus mensajes: t=poker&d=2026-11-10… */
function consulta(o: OrigenChat, canal: CanalConsejo) {
  return new URLSearchParams({
    t: o.torneo,
    ...(o.actividadId !== null ? { a: String(o.actividadId) } : {}),
    ...("con" in canal ? { con: canal.con } : { d: "dia" in canal ? canal.dia : "todos" }),
  }).toString();
}

const estiloEnlace = (activo: boolean) =>
  `rounded-full border-2 px-3 py-1 text-xs font-semibold transition ${activo ? "border-tinta bg-tinta text-crema" : "border-linea bg-white hover:border-tinta"}`;

export default async function AdminChat({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const admin = await exigirAdmin();
  const sp = await searchParams;
  const o = origenDe(sp.t, sp.a);
  const canal = o ? canalDe(sp.d, sp.con) : null;
  const elegido = o && canal ? consulta(o, canal) : "";
  const [conversaciones, agenda, conMensajes, activas, inicial] = await Promise.all([
    bandeja(),
    agendaAsistencia(),
    salasConMensajes(),
    db
      .select({ id: actividades.id, nombre: actividades.nombre, icono: actividades.icono, lugar: actividades.lugar, porEquipos: actividades.porEquipos })
      .from(actividades)
      .where(eq(actividades.estado, "activa")),
    o && canal ? mensajesConsejo(o, canal, admin) : Promise.resolve([]),
  ]);

  const nombreDe = (t: TipoAsistencia, a: number | null) => {
    const g = grupoAsistencia(t, activas.find((x) => x.id === a) ?? null);
    return `${g.icono} ${g.nombre}`;
  };
  // Salas de cada torneo y actividad activa: los avisos para todos y un día por cada día de juego (próximo o con mensajes).
  const salas = [
    ...(["poker", "mus", "futbol"] as const).map((t): OrigenChat => ({ torneo: t, actividadId: null })),
    ...activas.map((a): OrigenChat => ({ torneo: "actividad", actividadId: a.id })),
  ].map((origen) => {
    const deEste = (t: string, a: number | null) => t === origen.torneo && a === origen.actividadId;
    const dias = new Set([
      ...agenda.filter((d) => deEste(d.torneo, d.actividad?.id ?? null)).map((d) => d.dia),
      ...conMensajes.filter((m) => deEste(m.torneo, m.actividadId)).map((m) => m.dia!),
    ]);
    return { origen, nombre: nombreDe(origen.torneo, origen.actividadId), dias: [...dias].sort() };
  });
  const sinLeer = conversaciones.reduce((n, c) => n + c.sinLeer, 0);
  const conversacion = canal && "con" in canal ? conversaciones.find((c) => consulta(c, { con: c.con }) === elegido) : undefined;
  const titulo =
    !o || !canal
      ? ""
      : "con" in canal
        ? `🔒 ${conversacion?.nombre || canal.con}${conversacion?.unidad ? ` · ${conversacion.unidad}` : ""} · ${nombreDe(o.torneo, o.actividadId)}`
        : `${nombreDe(o.torneo, o.actividadId)} · ${"dia" in canal ? diaLargo(canal.dia) : "📢 Para todos"}`;

  return (
    <MarcoAdmin actual="/admin/chat" titulo="Chat">
      <p className="mb-5 max-w-3xl text-sm text-tinta-suave">
        Cada torneo y actividad tiene una sala por día de juego, que leen quienes juegan ese día, y cada participante os puede escribir en privado. Aquí
        contestáis los privados, escribís en las salas y mandáis avisos a todos los de un torneo. Vuestros mensajes salen como «📢 Consejo». Podéis borrar
        cualquier mensaje.
      </p>
      <div className="grid items-start gap-4 lg:grid-cols-[22rem_1fr]">
        <div>
          <Seccion titulo={`Privados${sinLeer ? ` · ${sinLeer} sin leer` : ""}`}>
            {conversaciones.length ? (
              <ul className="space-y-1.5">
                {conversaciones.map((c) => {
                  const q = consulta(c, { con: c.con });
                  return (
                    <li key={q}>
                      <Link
                        href={`/admin/chat?${q}`}
                        className={`block rounded-2xl border-2 px-3 py-2 text-sm transition ${q === elegido ? "border-tinta bg-crema" : "border-linea bg-white hover:border-tinta"}`}
                      >
                        <span className="flex items-center gap-2">
                          <strong className="truncate">{c.nombre || c.con}</strong>
                          {c.sinLeer > 0 && <span className="rounded-full bg-naranja px-2 text-xs font-bold text-white">{c.sinLeer}</span>}
                          <span className="ml-auto shrink-0 text-xs text-tinta-suave">{fechaCorta(c.cuando)}</span>
                        </span>
                        <span className="block truncate text-xs text-tinta-suave">
                          {nombreDe(c.torneo, c.actividadId)}
                          {c.unidad ? ` · ${c.unidad}` : ""} — {c.ultimo}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-sm text-tinta-suave">Nadie os ha escrito en privado todavía.</p>
            )}
          </Seccion>
          <Seccion titulo="Salas">
            <div className="space-y-3">
              {salas.map((s) => (
                <div key={`${s.origen.torneo}-${s.origen.actividadId ?? ""}`}>
                  <h3 className="mb-1.5 text-sm font-bold">{s.nombre}</h3>
                  <div className="flex flex-wrap gap-1.5">
                    {[{ todos: true } as CanalConsejo, ...s.dias.map((dia): CanalConsejo => ({ dia }))].map((c) => {
                      const q = consulta(s.origen, c);
                      return (
                        <Link key={q} href={`/admin/chat?${q}`} className={estiloEnlace(q === elegido)}>
                          {"dia" in c ? diaCorto(c.dia) : "📢 Para todos"}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Seccion>
        </div>

        <section className="overflow-hidden rounded-3xl border-2 border-tinta bg-papel lg:sticky lg:top-28">
          {o && canal ? (
            <div className="flex h-[70vh] min-h-[26rem] flex-col">
              <h2 className="border-b-2 border-linea px-4 py-3 font-display text-lg uppercase">{titulo}</h2>
              <p className="px-4 pt-2 text-xs text-tinta-suave">
                {"con" in canal
                  ? "Solo lo leéis esta persona y el Consejo."
                  : "dia" in canal
                    ? "Lo leen quienes juegan ese día."
                    : "Lo leen todos los participantes, en la sala de su día. Para avisos de todo el torneo o la actividad."}
              </p>
              <Conversacion
                key={elegido}
                fuente={`/api/chat/consejo?${elegido}`}
                campo="mensajes"
                inicial={inicial}
                enviar={escribirConsejo}
                ocultos={Object.fromEntries(new URLSearchParams(elegido))}
                borrar={borrarMensajeConsejo}
                borrarTodos
                alVer={"con" in canal ? marcarLeidoConsejo.bind(null, o.torneo, o.actividadId !== null ? String(o.actividadId) : null, canal.con) : undefined}
                placeholder="Escribe como Consejo…"
                vacio="Todavía no hay mensajes."
              />
            </div>
          ) : (
            <p className="p-6 text-sm text-tinta-suave">Elige un privado o una sala.</p>
          )}
        </section>
      </div>
    </MarcoAdmin>
  );
}
