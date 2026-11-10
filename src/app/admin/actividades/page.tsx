import type { Metadata } from "next";
import { MarcoAdmin } from "@/modulos/panel/marco";
import { TarjetasActividades } from "@/modulos/actividades/tarjetas-admin";
import { exigirAdmin } from "@/modulos/acceso/sesion";

export const metadata: Metadata = { title: "Panel · Actividades" };

export default async function AdminActividades() {
  await exigirAdmin();
  return (
    <MarcoAdmin actual="/admin/actividades" titulo="Actividades">
      <p className="mb-5 text-sm text-tinta-suave">
        Cualquier cosa del Consejo además de los tres torneos: una chocolatada solidaria, una charla, un torneo de ping-pong… Pulsa el «+» para crear una.
      </p>
      <TarjetasActividades />
    </MarcoAdmin>
  );
}
