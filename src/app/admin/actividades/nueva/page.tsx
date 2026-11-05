import type { Metadata } from "next";
import Link from "next/link";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { exigirAdmin } from "@/lib/sesion";
import { FormularioActividad } from "../formulario";

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
