import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import { db } from "@/db";
import { asistencia, pokerAsientos, pokerJugadores, pokerMesas, pokerRelevos } from "@/db/schema";
import { diaMadrid } from "@/modulos/asistencia/logica";
import { fechaCorta } from "@/modulos/compartido/formato";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { guardarReservaAutomatica } from "./acciones";
import { estadoReservaAutomatica } from "./relevos";
import { corteSiDiceNo, corteSinRespuesta, HORAS_SI_DICE_NO, HORAS_SIN_RESPUESTA } from "./reserva";

/** Panel del póker: plazas que pasan solas a la reserva. Activarlo, lo que va a pasar y lo que ya ha pasado. */
export async function ReservaAutomaticaAdmin() {
  const ahora = new Date();
  const [estado, mesas, asientos, jugadores, relevos, respuestas] = await Promise.all([
    estadoReservaAutomatica(),
    db
      .select()
      .from(pokerMesas)
      .where(and(eq(pokerMesas.fase, "clasificatoria"), isNotNull(pokerMesas.fecha), isNull(pokerMesas.ganadorEmail))),
    db.select().from(pokerAsientos),
    db.select({ email: pokerJugadores.email, nombre: pokerJugadores.nombre }).from(pokerJugadores),
    db.select().from(pokerRelevos).orderBy(desc(pokerRelevos.id)).limit(30),
    db.select().from(asistencia).where(eq(asistencia.torneo, "poker")),
  ]);
  const nombre = new Map(jugadores.map((j) => [j.email, j.nombre]));
  const numero = new Map(mesas.map((m) => [m.id, m.numero]));
  const respuesta = new Map(respuestas.map((r) => [`${r.unidad}|${r.dia}`, r.viene]));
  // Lo que viene: por hora de empezar, quién ha dicho que no y quién no ha contestado.
  const porInicio = new Map<string, typeof mesas>();
  for (const m of mesas.filter((m) => m.fecha! > ahora)) porInicio.set(m.fecha!.toISOString(), [...(porInicio.get(m.fecha!.toISOString()) ?? []), m]);
  const proximos = [...porInicio].sort(([a], [b]) => a.localeCompare(b)).map(([inicio, ms]) => {
    const deEstas = asientos.filter((a) => ms.some((m) => m.id === a.mesaId) && a.puesto === null);
    const dia = diaMadrid(inicio);
    return {
      inicio,
      mesas: ms.map((m) => m.numero).sort((a, b) => a - b),
      siNo: corteSiDiceNo(inicio),
      sinRespuesta: corteSinRespuesta(inicio),
      dicenNo: deEstas.filter((a) => respuesta.get(`${a.jugadorEmail}|${dia}`) === false).map((a) => nombre.get(a.jugadorEmail) ?? a.jugadorEmail),
      sinContestar: deEstas.filter((a) => !respuesta.has(`${a.jugadorEmail}|${dia}`)).map((a) => nombre.get(a.jugadorEmail) ?? a.jugadorEmail),
    };
  });

  return (
    <Seccion
      titulo="Plazas automáticas"
      descripcion={`Si alguien dice que no viene, su plaza pasa sola al primero de la reserva que pueda ese turno ${HORAS_SI_DICE_NO} horas antes de empezar; si no contesta, ${HORAS_SIN_RESPUESTA} horas antes. Se manda un correo a los dos y se avisa en el chat del día. La mesa final no se toca, ni las mesas que ya han empezado.`}
    >
      <FormAccion accion={guardarReservaAutomatica} boton="Guardar">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="activa" defaultChecked={estado.activa} className="size-4 accent-verde" />
          Pasar las plazas a la reserva automáticamente
        </label>
      </FormAccion>
      {estado.activa && (
        <p className="mt-2 text-xs text-tinta-suave">Activado desde el {fechaCorta(estado.desde.toISOString())}: lo que tocaba antes de esa hora se queda como estaba.</p>
      )}

      {estado.activa && proximos.length > 0 && (
        <div className="mt-4 space-y-3">
          {proximos.map((p) => {
            const cuenta = (c: Date) => c >= estado.desde;
            return (
              <div key={p.inicio} className="rounded-2xl border-2 border-linea bg-white p-3 text-sm">
                <p className="font-semibold">
                  {p.mesas.length === 1 ? `Mesa ${p.mesas[0]} · empieza` : `Mesas ${p.mesas.join(", ")} · empiezan`} el {fechaCorta(p.inicio)}
                </p>
                {!cuenta(p.siNo) && !cuenta(p.sinRespuesta) ? (
                  <p className="text-xs text-tinta-suave">Sus plazos pasaron antes de activarlo: no se cambia nada solo.</p>
                ) : (
                  <ul className="mt-1 space-y-1 text-xs">
                    {cuenta(p.siNo) && (
                      <li>
                        <strong>{fechaCorta(p.siNo.toISOString())}</strong>: pasan a la reserva los que han dicho que no
                        {p.dicenNo.length ? ` (ahora: ${p.dicenNo.join(", ")})` : " (ahora mismo, nadie)"}.
                      </li>
                    )}
                    {cuenta(p.sinRespuesta) && (
                      <li>
                        <strong>{fechaCorta(p.sinRespuesta.toISOString())}</strong>: y los que no han contestado
                        {p.sinContestar.length ? (
                          <details className="inline">
                            <summary className="inline cursor-pointer underline"> (ahora, {p.sinContestar.length})</summary>
                            <span className="block text-tinta-suave">{p.sinContestar.join(", ")}</span>
                          </details>
                        ) : (
                          " (ahora mismo, nadie)."
                        )}
                      </li>
                    )}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}

      {relevos.length > 0 && (
        <div className="mt-4">
          <h3 className="mb-1 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Lo que ya ha pasado</h3>
          <ul className="space-y-1 text-sm">
            {relevos.map((r) => (
              <li key={r.id}>
                <span className="font-mono text-xs text-tinta-suave">{fechaCorta(r.creadoEn.toISOString())}</span> · Mesa {numero.get(r.mesaId) ?? "?"}: sale{" "}
                <strong>{nombre.get(r.saleEmail) ?? r.saleEmail}</strong> ({r.motivo === "no" ? "dijo que no" : "no contestó"}) y entra <strong>{nombre.get(r.entraEmail) ?? r.entraEmail}</strong>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Seccion>
  );
}
