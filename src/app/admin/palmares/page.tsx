import { desc, sql } from "drizzle-orm";
import type { Metadata } from "next";
import { db } from "@/db";
import { archivo, palmares } from "@/db/schema";
import { estiloInput } from "@/modulos/panel/estilos";
import { FormAccion } from "@/modulos/panel/form-accion";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { fechaCorta } from "@/modulos/compartido/formato";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { borrarArchivo, borrarPalmares, guardarPalmares } from "@/modulos/torneos/acciones-ediciones";

export const metadata: Metadata = { title: "Panel · Ganadores" };

export default async function AdminPalmares() {
  await exigirAdmin();
  const [entradas, copias] = await Promise.all([
    db.select().from(palmares).orderBy(desc(sql`coalesce(${palmares.fecha}, ${palmares.creadoEn})`)),
    db
      .select({ id: archivo.id, nombre: archivo.nombre, tipo: archivo.tipo, creadoPor: archivo.creadoPor, creadoEn: archivo.creadoEn })
      .from(archivo)
      .orderBy(desc(archivo.creadoEn)),
  ]);

  return (
    <MarcoAdmin actual="/admin/palmares" titulo="Ganadores">
      <Seccion
        titulo={`Ganadores (${entradas.length})`}
        descripcion="Ganador de cada edición: se apunta solo al empezar una nueva edición de un torneo. Aquí puedes corregirlo o añadir los de ediciones anteriores a la web. Solo lo ve el Consejo."
      >
        <div className="space-y-2">
          {entradas.map((e) => (
            <div key={e.id} className="rounded-2xl border-2 border-linea bg-white p-3">
              <FormularioEntrada e={e} />
              <div className="mt-2">
                <FormAccion accion={borrarPalmares} boton="Quitar" peligro compacto confirmar={`¿Quitar a «${e.campeon}» de los ganadores de ${e.actividad}?`}>
                  <input type="hidden" name="id" value={e.id} />
                </FormAccion>
              </div>
            </div>
          ))}
          <details className="rounded-2xl border-2 border-dashed border-tinta/40">
            <summary className="cursor-pointer px-4 py-2.5 font-semibold text-verde">+ Añadir un ganador a mano</summary>
            <div className="border-t border-linea px-4 py-3">
              <FormularioEntrada />
            </div>
          </details>
        </div>
      </Seccion>

      <Seccion
        titulo={`Archivo (${copias.length})`}
        descripcion="Copia completa de cada edición cerrada y de cada actividad borrada: equipos, personas con sus correos y resultados. Si se vacía algo por error, los datos siguen aquí. Son datos personales: borra las copias que ya no necesitéis."
      >
        {copias.length ? (
          <ul className="space-y-2">
            {copias.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-linea bg-white px-3 py-2 text-sm">
                <span className="font-semibold">{c.nombre}</span>
                <span className="text-xs text-tinta-suave">
                  {fechaCorta(c.creadoEn.toISOString())} · {c.creadoPor.split("@")[0]}
                </span>
                <a href={`/admin/archivo/${c.id}`} className="ml-auto rounded-full border-2 border-tinta px-3 py-1 font-mono text-xs font-bold uppercase hover:bg-crema">
                  Descargar
                </a>
                <FormAccion accion={borrarArchivo} boton="Borrar" peligro compacto confirmar={`¿Borrar la copia «${c.nombre}»? No se puede deshacer.`}>
                  <input type="hidden" name="id" value={c.id} />
                </FormAccion>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-tinta-suave">Todavía no hay copias: se crean al empezar una nueva edición o al borrar una actividad.</p>
        )}
      </Seccion>
    </MarcoAdmin>
  );
}

function FormularioEntrada({ e }: { e?: typeof palmares.$inferSelect }) {
  return (
    <FormAccion accion={guardarPalmares} boton={e ? "Guardar" : "Añadir ganador"}>
      {e && <input type="hidden" name="id" value={e.id} />}
      <div className="grid gap-2 sm:grid-cols-[4rem_1fr_8rem]">
        <input name="icono" maxLength={8} defaultValue={e?.icono ?? ""} placeholder="🏆" aria-label="Icono" className={`${estiloInput} text-center`} />
        <input name="actividad" required maxLength={120} defaultValue={e?.actividad} placeholder="Torneo de Fútbol Sala" aria-label="Actividad" className={estiloInput} />
        <input name="edicion" maxLength={60} defaultValue={e?.edicion ?? ""} placeholder="2025" aria-label="Edición" className={estiloInput} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <input name="campeon" required maxLength={200} defaultValue={e?.campeon} placeholder="Campeón" aria-label="Campeón" className={estiloInput} />
        <input name="detalle" maxLength={300} defaultValue={e?.detalle ?? ""} placeholder="Final: 3-1 contra…" aria-label="Detalle" className={estiloInput} />
      </div>
    </FormAccion>
  );
}
