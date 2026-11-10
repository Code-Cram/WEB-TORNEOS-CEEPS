import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { esCorreoAdmin } from "@/modulos/acceso/admins";
import { esAdmin, leerSesion } from "@/modulos/acceso/sesion";
import { FormularioAdmin } from "@/modulos/acceso/formulario-admin";

export const metadata: Metadata = { title: "Panel" };

export default async function EntrarAdmin() {
  const sesion = await leerSesion();
  // Primero hay que entrar en la web con uno de los correos de la mesa de portavoces.
  if (!sesion) redirect("/");
  if (!esCorreoAdmin(sesion.email)) redirect("/torneos");
  if (await esAdmin()) redirect("/admin");
  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-5 py-10">
      <Image src="/marca/ceeps.svg" alt="" width={72} height={72} className="mx-auto" />
      <h1 className="mt-3 text-center font-display text-2xl text-verde uppercase">Panel de la mesa</h1>
      <p className="mb-5 text-center text-sm text-tinta-suave">
        Hola, {sesion.nombre}. Introduce la contraseña del panel para <strong>{sesion.email}</strong>.
      </p>
      <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[5px_5px_0_var(--tinta)]">
        <FormularioAdmin />
      </div>
      <Link href="/torneos" className="mt-4 text-center font-mono text-xs text-tinta-suave uppercase hover:text-tinta">
        ← Volver a los torneos
      </Link>
    </main>
  );
}
