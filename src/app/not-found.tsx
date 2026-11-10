import type { Metadata } from "next";
import Link from "next/link";
import { traduccion } from "@/modulos/idioma/servidor";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await traduccion();
  return { title: t("No encontrado") };
}

export default async function NoEncontrado() {
  const { t } = await traduccion();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 text-center">
      <p className="font-display text-7xl text-naranja">404</p>
      <h1 className="mt-2 font-display text-3xl text-verde uppercase">{t("Esta página no existe")}</h1>
      <p className="mt-2 text-tinta-suave">{t("Puede que el enlace esté mal copiado.")}</p>
      <Link
        href="/"
        className="mx-auto mt-6 rounded-full bg-verde px-5 py-2.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro"
      >
        {t("Ir a los torneos")}
      </Link>
    </main>
  );
}
