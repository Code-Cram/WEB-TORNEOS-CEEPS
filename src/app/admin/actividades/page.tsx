import type { Metadata } from "next";
import { MarcoAdmin } from "@/components/admin/marco-admin";
import { TarjetasActividades } from "@/components/admin/tarjetas-actividades";
import { exigirAdmin } from "@/lib/sesion";

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
