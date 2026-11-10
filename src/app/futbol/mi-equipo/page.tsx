import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Cabecera } from "@/modulos/compartido/cabecera";
import { equipoDeCapitan } from "@/modulos/futbol/datos";
import { plantillaATexto } from "@/modulos/personas/plantilla";
import { exigirSesion } from "@/modulos/acceso/sesion";
import { FormularioPlantilla } from "@/modulos/futbol/formulario-plantilla";

export const metadata: Metadata = { title: "Mi equipo" };

export default async function MiEquipo() {
  const sesion = await exigirSesion();
  const equipo = await equipoDeCapitan(sesion.email);
  if (!equipo) redirect("/futbol");
  const sinCorreo = equipo.jugadores.filter((j) => !j.email).length;

  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-6">
        <Link href="/futbol" className="font-mono text-xs font-bold text-tinta-suave uppercase hover:text-tinta">
          ← Volver al torneo
        </Link>
        <h1 className="mt-2 font-display text-3xl text-verde uppercase">{equipo.nombre}</h1>
        <p className="mt-1 text-sm text-tinta-suave">Como capitán puedes corregir la plantilla y añadir el correo de cada jugador para que pueda entrar en la web.</p>

        {sinCorreo > 0 && (
          <p className="mt-4 rounded-2xl border-2 border-naranja bg-naranja/10 px-4 py-3 text-sm">
            {sinCorreo} {sinCorreo === 1 ? "jugador no tiene" : "jugadores no tienen"} correo todavía, así que no pueden entrar.
          </p>
        )}

        <div className="mt-5 rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
          <FormularioPlantilla plantilla={plantillaATexto(equipo.jugadores)} />
        </div>
      </main>
    </>
  );
}
