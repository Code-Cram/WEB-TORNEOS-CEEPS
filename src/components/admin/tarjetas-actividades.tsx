import { count } from "drizzle-orm";
import Link from "next/link";
import { db } from "@/db";
import { actividadParticipantes } from "@/db/schema";
import { listarActividades } from "@/lib/actividades";

const ESTADO: Record<string, string> = { borrador: "Borrador", activa: "Activa", terminada: "Terminada" };

/** Tarjetas de las actividades del panel, con un «+» al final para crear otra. */
export async function TarjetasActividades() {
  const [lista, cuentas] = await Promise.all([
    listarActividades(true),
    db.select({ id: actividadParticipantes.actividadId, n: count() }).from(actividadParticipantes).groupBy(actividadParticipantes.actividadId),
  ]);
  const participantes = new Map(cuentas.map((c) => [c.id, c.n]));
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {lista.map((a) => (
        <Link
          key={a.id}
          href={`/admin/actividades/${a.id}`}
          className={`rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[4px_4px_0_var(--tinta)] transition hover:-translate-y-0.5 ${a.estado === "borrador" ? "border-dashed" : ""}`}
        >
          <h2 className="font-display text-lg uppercase">
            {a.icono} {a.nombre}
          </h2>
          <p className="text-sm text-tinta-suave">
            {a.tipo === "torneo" ? (a.porEquipos ? "Torneo por equipos" : "Torneo") : "Evento"} · {participantes.get(a.id) ?? 0}{" "}
            {a.porEquipos ? "equipos" : "participantes"}
          </p>
          <span className="mt-1 inline-block rounded-full bg-linea px-2 text-xs">{ESTADO[a.estado] ?? a.estado}</span>
        </Link>
      ))}
      <Link
        href="/admin/actividades/nueva"
        aria-label="Nueva actividad"
        className="flex min-h-32 flex-col items-center justify-center gap-1 rounded-3xl border-2 border-dashed border-tinta/50 p-5 text-verde transition hover:border-tinta hover:bg-papel"
      >
        <span className="font-display text-5xl leading-none">+</span>
        <span className="font-mono text-xs font-bold uppercase">Nueva actividad</span>
      </Link>
    </div>
  );
}
