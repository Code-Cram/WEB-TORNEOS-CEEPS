import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { exigirSesion } from "@/modulos/acceso/sesion";
import { Cabecera } from "@/modulos/compartido/cabecera";
import { Logos } from "@/modulos/compartido/logos";
import { perfilDe } from "@/modulos/personas/perfil";
import { VistaPerfil } from "@/modulos/personas/vista-perfil";

export const metadata: Metadata = { title: "Perfil" };

/** Perfil de una persona: lo ve cualquiera que haya entrado en la web (se llega tocando su nombre). */
export default async function Perfil({ params }: { params: Promise<{ id: string }> }) {
  const sesion = await exigirSesion();
  const perfil = await perfilDe((await params).id, sesion.email);
  if (!perfil) notFound();
  return (
    <>
      <Cabecera sesion={sesion} />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">
        <VistaPerfil perfil={perfil} />
      </main>
      <footer className="pb-6">
        <Logos />
      </footer>
    </>
  );
}
