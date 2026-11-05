import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import { Seccion } from "@/components/admin/marco-admin";
import { bloquesCuadro } from "@/lib/cuadro";
import { fechasEnBloque } from "./acciones";

/** La misma fecha y lugar para muchos partidos a la vez: p. ej. toda la mitad izquierda del cuadro el martes. */
export function FechasEnBloque({
  torneo,
  rondas,
  conTercerPuesto,
  lugares,
}: {
  torneo: "futbol" | "mus";
  rondas: number;
  conTercerPuesto: boolean;
  /** id del <datalist> con los lugares de siempre. */
  lugares: string;
}) {
  return (
    <Seccion
      titulo="Fechas por bloques"
      descripcion="Pon la misma fecha y hora (y, si quieres, el lugar) a varios partidos de golpe: una mitad del cuadro hasta su semifinal, una ronda o la final. Después puedes cambiar cualquier partido suelto más abajo. Los pases directos no llevan fecha."
    >
      <FormAccion accion={fechasEnBloque} boton="Poner a todos">
        <input type="hidden" name="torneo" value={torneo} />
        <div className="grid gap-2 sm:grid-cols-3">
          <select name="bloque" className={estiloInput} aria-label="Qué partidos">
            {bloquesCuadro(rondas, conTercerPuesto).map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
              </option>
            ))}
          </select>
          <input type="datetime-local" name="fecha" className={estiloInput} aria-label="Fecha y hora" />
          <input name="lugar" list={lugares} placeholder="Lugar (si no, se deja el que tenga)" className={estiloInput} />
        </div>
      </FormAccion>
    </Seccion>
  );
}
