import type { Metadata } from "next";
import Link from "next/link";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { exigirAdmin } from "@/modulos/acceso/sesion";
import { FormularioActividad } from "@/modulos/actividades/formulario";

export const metadata: Metadata = { title: "Panel · Nueva actividad" };

export default async function NuevaActividad() {
  await exigirAdmin();
  return (
    <MarcoAdmin actual="/admin/actividades" titulo="Nueva actividad">
      <Link href="/admin/actividades" className="mb-4 inline-block font-mono text-xs font-bold text-tinta-suave uppercase hover:text-tinta">
        ← Actividades
      </Link>
      <Seccion
        titulo="¿De qué va?"
        descripcion="Solo el nombre es obligatorio; todo se puede cambiar después. Al crearla, podrás añadir a los participantes."
      >
        <FormularioActividad />
      </Seccion>
    </MarcoAdmin>
  );
}
