import { desc } from "drizzle-orm";
import { db } from "@/db";
import { futbolEquipos, futbolPartidos, futbolPropuestas } from "@/db/schema";
import { diaDe } from "@/modulos/futbol/reservas";
import { fechaCorta } from "@/modulos/compartido/formato";
import { nombreRonda, ordenRonda } from "@/modulos/cuadros/logica";
import { anularPropuestaConsejo, guardarAjustesReservas, recalcularPrevistasAdmin } from "@/modulos/futbol/acciones";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { Seccion } from "@/modulos/panel/marco";
import { esPaseDirecto } from "./prevision";
import { leerMarcados } from "./prevision-datos";
import { ajustesReservas, asegurarPrevistas, equiposVivos } from "./reservas-datos";

const ESTADO: Record<string, string> = {
  pendiente: "⏳ Pendiente",
  aceptada: "✅ Aceptada",
  rechazada: "✗ Rechazada",
  anulada: "Anulada",
};

/** Panel → Fútbol: el calendario (ajustes, fechas previstas, lo que han marcado los capitanes y las propuestas). */
export async function ReservasAdmin() {
  await asegurarPrevistas();
  const [ajustes, propuestas, partidos, equipos, marcados] = await Promise.all([
    ajustesReservas(),
    db.select().from(futbolPropuestas).orderBy(desc(futbolPropuestas.creadoEn)).limit(60),
    db.select().from(futbolPartidos),
    db.select({ id: futbolEquipos.id, nombre: futbolEquipos.nombre, horario: futbolEquipos.horario }).from(futbolEquipos),
    leerMarcados(db),
  ]);
  const nombre = new Map(equipos.map((e) => [e.id, e.nombre]));
  const total = Math.max(0, ...partidos.map((p) => p.ronda));
  const jugables = partidos.filter((p) => !esPaseDirecto({ ronda: p.ronda, local: p.localId, visitante: p.visitanteId }));
  const reservados = jugables.filter((p) => p.fecha).length;
  const pendientes = propuestas.filter((x) => x.estado === "pendiente");
  const lista = [...pendientes, ...propuestas.filter((x) => x.estado !== "pendiente")];
  const hoy = diaDe(new Date());
  const marcas = (id: number | null) => (id === null ? 0 : [...(marcados.get(id) ?? [])].filter((k) => k.slice(0, 10) >= hoy).length);
  const vivos = [...equiposVivos(partidos)];
  const sinMarcar = equipos.filter((e) => vivos.includes(e.id) && !marcas(e.id));
  const porJugar = jugables
    .filter((p) => p.ganadorId === null && (p.localId !== null || p.visitanteId !== null || p.ronda > 1))
    .sort((a, b) => ordenRonda(a.ronda, total) - ordenRonda(b.ronda, total) || a.posicion - b.posicion);
  const equipo = (id: number | null) => (id === null ? "Por decidir" : `${nombre.get(id) ?? "?"}${marcas(id) ? ` (${marcas(id)} h)` : ""}`);

  return (
    <Seccion
      titulo="📅 Calendario y reservas de pista"
      descripcion={`En la página del fútbol, debajo de la clasificación, cada capitán marca las mañanas y tardes (o las horas) que le vienen bien a su equipo y la fecha prevista de cada partido sale sola de lo que marcan los dos (si un equipo no ha marcado nada, cuenta lo que puso en la inscripción). Después, un capitán la confirma (o propone otra hora) y el rival la acepta: queda reservada, se avisa en el chat del día y se prepara un correo. Lo previsto para las próximas 24 horas ya no se mueve. ${reservados} de ${jugables.length} partidos con fecha · ${pendientes.length} propuestas sin contestar. Para cambiar o quitar la fecha de un partido reservado, hazlo en «Cruces y resultados» o en 🗓 Calendario.`}
    >
      <FormAccion accion={guardarAjustesReservas} boton="Guardar">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            Primer día en que se juega
            <input type="date" name="desde" defaultValue={ajustes.desde} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
          <label className="block text-sm">
            Último día
            <input type="date" name="hasta" defaultValue={ajustes.hasta} className={`${estiloInput} mt-0.5 w-full`} />
          </label>
          <label className="block text-sm">
            Huecos que da Deportes · uno por línea: «2026-11-23 8-14» (de 8:00 a 14:00) o «2026-11-24» (todo el día). Vacío: de lunes a viernes de 8:00 a 18:00
            <textarea
              name="abiertas"
              rows={4}
              defaultValue={ajustes.textoAbiertos}
              placeholder={"2026-11-23 8-14\n2026-11-24 14-18\n2026-11-25"}
              className={`${estiloInput} mt-0.5 w-full font-mono text-xs`}
            />
          </label>
          <label className="block text-sm">
            Días u horas cerrados · uno por línea: «2026-12-08» (todo el día) o «2026-12-07 9-14»; lo de detrás es una nota
            <textarea name="cerradas" rows={4} defaultValue={ajustes.textoCierres} placeholder={"2026-12-08 Festivo\n2026-12-07 9-14 Exámenes"} className={`${estiloInput} mt-0.5 w-full font-mono text-xs`} />
          </label>
        </div>
        <p className="text-xs text-tinta-suave">
          Se juega de lunes a viernes, de 8:00 a 18:00, en huecos de una hora (mañana: de 8:00 a 14:00; tarde: de 14:00 a 18:00). Con huecos de Deportes, solo esos se
          pueden marcar, prever y reservar. La idea: cuartos antes de que acabe noviembre y todo terminado el último día.
        </p>
      </FormAccion>

      <h3 className="mt-5 mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Fechas previstas</h3>
      <ul className="space-y-1.5 text-sm">
        {porJugar.map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border-2 border-linea bg-white px-3 py-2">
            <span className="w-32 font-mono text-xs">{p.fecha ? `✅ ${fechaCorta(p.fecha.toISOString())}` : p.fechaPrevista ? `≈ ${fechaCorta(p.fechaPrevista.toISOString())}` : "sin hueco"}</span>
            <span className="min-w-0 flex-1">
              <strong>
                {equipo(p.localId)} – {equipo(p.visitanteId)}
              </strong>{" "}
              <span className="text-tinta-suave">· {nombreRonda(p.ronda, total)}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-tinta-suave">(N h): horas que ha marcado ese equipo de hoy en adelante. Las fechas previstas se recalculan solas cada vez que un capitán marca algo.</p>
      <div className="mt-2">
        <FormAccion accion={recalcularPrevistasAdmin} boton="Recalcular ahora" compacto />
      </div>

      <h3 className="mt-5 mb-2 font-mono text-xs font-bold tracking-widest text-tinta-suave uppercase">Capitanes que aún no han marcado nada ({sinMarcar.length})</h3>
      <p className="text-sm">{sinMarcar.length ? sinMarcar.map((e) => `${e.nombre}${e.horario ? ` (inscripción: ${e.horario})` : ""}`).join(" · ") : "Todos han marcado algo."}</p>

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
