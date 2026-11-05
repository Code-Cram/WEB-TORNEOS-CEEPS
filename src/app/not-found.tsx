import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "No encontrado" };

export default function NoEncontrado() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 text-center">
      <p className="font-display text-7xl text-naranja">404</p>
      <h1 className="mt-2 font-display text-3xl text-verde uppercase">Esta página no existe</h1>
      <p className="mt-2 text-tinta-suave">Puede que el enlace esté mal copiado.</p>
      <Link
        href="/"
        className="mx-auto mt-6 rounded-full bg-verde px-5 py-2.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro"
      >
        Ir a los torneos
      </Link>
    </main>
  );
}
