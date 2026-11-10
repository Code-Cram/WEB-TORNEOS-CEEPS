import { asc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/db";
import { pokerJugadores } from "@/db/schema";
import { BotonCopiar } from "@/components/admin/boton-copiar";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { grupoAsistencia, resumir, type Respuesta } from "@/lib/asistencia";
import { agendaAsistencia, type DiaAsistencia, type FilaAsistencia } from "@/lib/asistencia-datos";
import { enlaceCorreo, LARGO_MAXIMO_ENLACE } from "@/lib/correos";
import { leerInfoTorneos } from "@/lib/datos";
import { fechaCorta, fechaLarga } from "@/lib/formato";
import { exigirAdmin } from "@/lib/sesion";
import { MarcarAsistencia } from "./marcar";

export const metadata: Metadata = { title: "Panel · Asistencia" };

/** Primero quien no viene (hay que buscar sustituto o dar el pase), después quien no ha respondido y al final quien viene. */
const orden = (r: Respuesta | null) => (r === null ? 1 : r.viene ? 2 : 0);

export default async function AdminAsistencia() {
  await exigirAdmin();
  const [agenda, info, reserva] = await Promise.all([
    agendaAsistencia(),
    leerInfoTorneos(),
    db.select({ nombre: pokerJugadores.nombre }).from(pokerJugadores).where(eq(pokerJugadores.estado, "reserva")).orderBy(asc(pokerJugadores.inscritoEn)),
  ]);

  return (
    <MarcoAdmin actual="/admin/asistencia" titulo="Asistencia">
      <p className="mb-6 max-w-3xl text-sm text-tinta-suave">
        Cada equipo (lo confirma el capitán), cada pareja (cualquiera de los dos), cada jugador de póker y cada participante de una actividad (si es un
        equipo, cualquiera de él) confirma en su página si viene el próximo día que juega o que es el evento. Si cambia la fecha de su partido, su mesa o
        el evento, o pasa a jugar otro día (una final), se le vuelve a preguntar. Si alguien te avisa por otro lado, apúntalo con ✓ o ✗.
      </p>
      {agenda.length ? (
        agenda.map((d) => (
          <Dia
            key={`${d.torneo}-${d.actividad?.id ?? ""}-${d.dia}`}
            d={d}
            lugarTorneo={d.actividad ? (d.actividad.lugar ?? "") : d.torneo === "actividad" ? "" : info[d.torneo].lugar}
            reserva={d.torneo === "poker" ? reserva.map((j) => j.nombre) : []}
          />
        ))
      ) : (
        <p className="text-sm text-tinta-suave">
          No hay ningún partido, mesa ni evento con fecha de hoy en adelante. Las fechas se ponen en cada torneo (en el fútbol y el mus, también con «Fechas por
          bloques») y en la ficha de cada actividad.
        </p>
      )}
    </MarcoAdmin>
  );
}

function Dia({ d, lugarTorneo, reserva }: { d: DiaAsistencia; lugarTorneo: string; reserva: string[] }) {
  const g = grupoAsistencia(d.torneo, d.actividad);
  const primero = d.filas.map((f) => f.eventos[0]).sort((a, b) => a.fecha.localeCompare(b.fecha))[0];
  const lugar = primero.lugar || lugarTorneo;
  const r = resumir(d.filas.map((f) => f.respuesta));
  const sinResponder = [...new Set(d.filas.filter((f) => !f.respuesta).flatMap((f) => f.unidad.responden))];
  // En el póker, por mesas; en el mus y el fútbol, todas las parejas o equipos juntos.
  const grupos: [string, FilaAsistencia[] | undefined][] =
    d.torneo === "poker"
      ? Object.entries(Object.groupBy(d.filas, (f) => f.eventos[0].detalle)).sort(([a], [b]) => a.localeCompare(b, "es", { numeric: true }))
      : [["", d.filas]];

  return (
    <Seccion titulo={`${g.icono} ${g.nombre} · ${fechaLarga(primero.fecha)}`} descripcion={lugar ? `📍 ${lugar}` : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full bg-verde/15 px-3 py-1 text-sm font-semibold text-verde">
          ✓ {r.vienen} {r.vienen === 1 ? "viene" : "vienen"}
        </span>
        <span className="rounded-full bg-copas/10 px-3 py-1 text-sm font-semibold text-copas">✗ {r.noVienen} no</span>
        <span className="rounded-full bg-oros/20 px-3 py-1 text-sm font-semibold">⏳ {r.sinResponder} sin responder</span>
        {sinResponder.length > 0 && (
          <>
            <BotonCopiar texto={sinResponder.join("; ")} etiqueta={`Copiar correos sin responder (${sinResponder.length})`} />
            <a
              href={enlaceCorreo(sinResponder)}
              title={enlaceCorreo(sinResponder).length > LARGO_MAXIMO_ENLACE ? "Son muchos: si tu correo no los abre todos, usa «Copiar» y pégalos en CCO." : undefined}
              className="rounded-full border-2 border-tinta bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase transition hover:bg-crema"
            >
              ✉ Recordárselo
            </a>
          </>
        )}
      </div>
      {grupos.map(([titulo, filas = []]) => (
        <div key={titulo} className="mt-4">
          {titulo && (
            <h3 className="font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">
              {titulo} · {resumir(filas.map((f) => f.respuesta)).vienen}/{filas.length} vienen
            </h3>
          )}
          <ul>
            {[...filas]
              .sort((a, b) => orden(a.respuesta) - orden(b.respuesta) || a.unidad.nombre.localeCompare(b.unidad.nombre, "es"))
              .map((f) => (
                <Fila key={f.unidad.id} f={f} dia={d.dia} grupo={g.nombre} />
              ))}
          </ul>
        </div>
      ))}
      {reserva.length > 0 && (
        <p className="mt-4 text-sm text-tinta-suave">
          Lista de reserva, por orden: {reserva.join(", ")}. Para dar una plaza:{" "}
          <Link href="/admin/poker" className="underline">
            ♠ Póker
          </Link>{" "}
          → Jugadores (pásalo a inscrito) y colócalo en la mesa.
        </p>
      )}
    </Seccion>
  );
}

function Fila({ f, dia, grupo }: { f: FilaAsistencia; dia: string; grupo: string }) {
  const r = f.respuesta;
  return (
    <li className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-linea py-1.5 text-sm">
      <span aria-hidden className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${!r ? "bg-oros/25" : r.viene ? "bg-verde text-crema" : "bg-copas text-white"}`}>
        {!r ? "?" : r.viene ? "✓" : "✗"}
      </span>
      <span className="font-semibold">{f.unidad.nombre}</span>
      {f.unidad.torneo !== "poker" && f.eventos.some((e) => e.detalle) && (
        <span className="text-xs text-tinta-suave">{f.eventos.map((e) => e.detalle).filter(Boolean).join(" · ")}</span>
      )}
      {r?.comentario && <span className="italic">«{r.comentario}»</span>}
      {r && (
        <span className="text-xs text-tinta-suave">
          {r.quien ?? `Consejo (${r.email.split("@")[0]})`} · {fechaCorta(r.actualizadoEn)}
        </span>
      )}
      <MarcarAsistencia torneo={f.unidad.torneo} grupo={grupo} unidad={f.unidad.id} dia={dia} nombre={f.unidad.nombre} actual={r ? r.viene : null} />
    </li>
  );
}
