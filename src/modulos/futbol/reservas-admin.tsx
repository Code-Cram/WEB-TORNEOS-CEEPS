import { desc } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolPartidos, futbolPropuestas } from "@/db/schema";
import { fechaCorta } from "@/modulos/compartido/formato";
import { nombreRonda } from "@/modulos/cuadros/logica";
import { anularPropuestaConsejo, guardarAjustesReservas } from "@/modulos/futbol/acciones";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { ajustesReservas } from "./reservas-datos";

const ESTADO: Record<string, string> = {
  pendiente: "⏳ Pendiente",
  aceptada: "✅ Aceptada",
  rechazada: "✗ Rechazada",
  anulada: "Anulada",
};

/** Panel → Fútbol: las reservas de pista de los capitanes (ajustes y propuestas). */
export async function ReservasAdmin() {
  const [ajustes, propuestas, partidos, equipos] = await Promise.all([
    ajustesReservas(),
    db.select().from(futbolPropuestas).orderBy(desc(futbolPropuestas.creadoEn)).limit(60),
    db.select().from(futbolPartidos),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre }).from(futbolEquipos),
  ]);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const total = Math.max(0, ...partidos.map((p) => p.ronda));
  const jugables = partidos.filter((p) => !(p.ronda === 1 && (p.localId === null) !== (p.visitanteId === null)));
  const reservados = jugables.filter((p) => p.fecha).length;
  const pendientes = propuestas.filter((x) => x.estado === "pendiente");
  const lista = [...pendientes, ...propuestas.filter((x) => x.estado !== "pendiente")];

  return (
    <Seccion
      titulo="📅 Reservas de pista"
      descripcion={`Los capitanes proponen un hueco de una hora en el calendario de la página del fútbol (debajo de la clasificación) y el capitán rival lo acepta o lo rechaza; al aceptarlo, el partido queda con esa fecha y se avisa en el chat del día. ${reservados} de ${jugables.length} partidos con fecha · ${pendientes.length} propuestas sin contestar. Para cambiar o quitar la fecha de un partido ya reservado, hazlo en «Cruces y resultados» o en 🗓 Calendario.`}
    >
      <FormAccion accion={guardarAjustesReservas} boton="Guardar">
        <div className="grid gap-3 sm:grid-cols-[12rem_1fr]">
          <label className="block text-sm">
            Último día para reservar
            <input type="date" name="hasta" defaultValue={ajustes.hasta} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
          <label className="block text-sm">
            Días u horas cerrados · uno por línea: «2026-12-08» (todo el día) o «2026-12-07 9-14» (de 9:00 a 14:00); lo de detrás es una nota
            <textarea name="cerradas" rows={3} defaultValue={ajustes.textoCierres} placeholder={"2026-12-08 Festivo\n2026-12-07 9-14 Exámenes"} className={`${estiloInput} mt-0.5 w-full font-mono text-xs`} />
          </label>
        </div>
        <p className="text-xs text-tinta-suave">Se reserva de lunes a viernes, de 9:00 a 21:00 (huecos de una hora).</p>
      </FormAccion>

      <h3 className="mt-5 mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Propuestas de los capitanes</h3>
      {lista.length ? (
        <ul className="space-y-1.5 text-sm">
          {lista.map((x) => {
            const p = partidos.find((y) => y.id === x.partidoId);
            const cruce = p ? `${nombre.get(p.localId ?? -1) ?? "?"} – ${nombre.get(p.visitanteId ?? -1) ?? "?"}` : "?";
            return (
              <li key={x.id} className={`flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 px-3 py-2 ${x.estado === "pendiente" ? "border-oros bg-oros/10" : "border-linea bg-white"}`}>
                <span className="font-mono text-xs">{fechaCorta(x.fecha.toISOString())}</span>
                <span className="min-w-0 flex-1">
                  <strong>{cruce}</strong> <span className="text-tinta-suave">· {p ? nombreRonda(p.ronda, total) : ""} · propone {nombre.get(x.equipoId) ?? "?"}</span>
                </span>
                <span className="text-xs">{ESTADO[x.estado] ?? x.estado}</span>
                {x.estado === "pendiente" && (
                  <FormAccion accion={anularPropuestaConsejo} boton="Anular" peligro compacto confirmar="¿Anular esta propuesta? El capitán podrá proponer otro hueco.">
                    <input type="hidden" name="id" value={x.id} />
                  </FormAccion>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="text-sm text-tinta-suave">Todavía no hay propuestas.</p>
      )}
    </Seccion>
  );
}
