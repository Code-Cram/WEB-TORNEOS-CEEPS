"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useT } from "@/modulos/idioma/cliente";

/** Si algo falla al cargar una página (p. ej. la base de datos no responde), en vez de la pantalla genérica de Next. */
export default function PaginaError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const codigo = error instanceof Error && "digest" in error ? String(error.digest) : null;
  const t = useT();
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10 text-center">
      <p className="text-5xl" aria-hidden>
        🤕
      </p>
      <h1 className="mt-3 font-display text-3xl text-verde uppercase">{t("Algo ha fallado")}</h1>
      <p className="mt-2 text-tinta-suave">{t("No hemos podido cargar esta página. Suele arreglarse volviendo a intentarlo en unos segundos.")}</p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <button onClick={() => retry()} className="rounded-full bg-verde px-5 py-2.5 font-mono text-xs font-bold text-crema uppercase hover:bg-verde-oscuro">
          {t("Reintentar")}
        </button>
        <Link href="/" className="rounded-full border-2 border-tinta px-5 py-2 font-mono text-xs font-bold uppercase hover:bg-tinta hover:text-crema">
          {t("Ir al inicio")}
        </Link>
      </div>
      {codigo && <p className="mt-6 font-mono text-[11px] text-tinta-suave">{t("Código del error: {codigo}", { codigo })}</p>}
    </main>
  );
}
