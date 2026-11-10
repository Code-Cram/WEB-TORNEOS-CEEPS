import Image from "next/image";
import { redirect } from "next/navigation";
import { Logos } from "@/modulos/compartido/logos";
import { TORNEOS, type TorneoId } from "@/modulos/torneos/config";
import { infoDeActividad, listarActividades } from "@/modulos/actividades/datos";
import { inscripcionAbierta, leerInfoTorneos } from "@/modulos/torneos/info";
import { fechaLarga } from "@/modulos/compartido/formato";
import { leerSesion } from "@/modulos/acceso/sesion";
import { FormularioEntrar } from "@/modulos/acceso/formulario-entrar";
import { traduccion } from "@/modulos/idioma/servidor";
import { SelectorIdioma } from "@/modulos/idioma/selector";

export default async function Inicio() {
  if (await leerSesion()) redirect("/torneos");
  const { t, idioma } = await traduccion();
  // Si la base de datos no responde, la portada se sigue viendo (sin el bloque de inscripciones).
  const [info, actividades] = await Promise.all([leerInfoTorneos(idioma), listarActividades(false)]).catch((e) => {
    console.error(e);
    return [null, []] as const;
  });
  // Torneos y actividades con la inscripción abierta, para quien todavía no se ha apuntado.
  const abiertas = [
    ...(info
      ? (Object.keys(TORNEOS) as TorneoId[])
          .filter((id) => inscripcionAbierta(info[id]))
          .map((id) => ({ clave: id, etiqueta: `${TORNEOS[id].icono} ${t(TORNEOS[id].corto)}`, ...info[id] }))
      : []),
    ...actividades
      .filter((a) => a.estado === "activa")
      .map((a) => {
        const info = infoDeActividad(a, idioma);
        return { clave: a.slug, etiqueta: `${a.icono} ${info.nombre}`, ...info };
      })
      .filter((a) => inscripcionAbierta(a)),
  ];
  const cierres = [...new Set(abiertas.map((a) => a.cierreInscripcion))];

  return (
    <main className="relative flex flex-1 flex-col overflow-hidden">
      {/* Bloques de color como en los carteles */}
      <div aria-hidden className="absolute -top-12 -left-20 h-36 w-56 rounded-br-[4rem] bg-naranja sm:h-48 sm:w-80" />
      <div aria-hidden className="absolute top-[42%] -right-24 h-40 w-56 rounded-l-full bg-verde sm:-right-10 sm:w-72" />
      <div aria-hidden className="absolute -bottom-20 -left-16 h-48 w-48 rounded-full bg-verde-oscuro sm:h-64 sm:w-64" />

      <div className="absolute top-3 right-3 z-20">
        <SelectorIdioma idioma={idioma} />
      </div>
      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-10">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/marca/ceeps.svg" alt={t("Consejo de Estudiantes EPS")} width={120} height={120} priority className="drop-shadow-sm" />
          <h1 className="mt-4 font-display text-5xl leading-none tracking-tight text-verde uppercase sm:text-6xl">
            Torneos
            <span className="titulo-contorno block text-naranja">CEEPS</span>
          </h1>
          <p className="mt-3 font-mono text-sm text-tinta-suave">{t("Consejo de Estudiantes · Escuela Politécnica Superior")}</p>
        </div>

        <div className="rounded-3xl border-2 border-tinta bg-papel p-5 shadow-[6px_6px_0_var(--tinta)] sm:p-6">
          <FormularioEntrar />
        </div>

        {abiertas.length > 0 ? (
          <div className="mt-6 rounded-3xl border-2 border-dashed border-tinta/40 bg-papel/80 p-4 text-center">
            <p className="font-display text-sm text-verde uppercase">{t("¿Aún no te has apuntado?")}</p>
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              {abiertas.map((a) => (
                <a
                  key={a.clave}
                  href={a.enlaceInscripcion}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border-2 border-tinta bg-white px-3 py-1 text-sm font-semibold transition hover:bg-crema"
                >
                  {a.etiqueta} ↗
                </a>
              ))}
            </div>
            <p className="mt-2 text-xs text-tinta-suave">
              {cierres.length === 1 && cierres[0] ? `${t("Inscripciones abiertas hasta el {fecha}.", { fecha: fechaLarga(cierres[0], idioma) ?? "" })} ` : ""}
              {t("Podrás entrar con tu correo en cuanto el Consejo actualice la lista de inscritos.")}
            </p>
          </div>
        ) : (
          <div className="mt-8 flex justify-center gap-2 font-mono text-xs text-tinta-suave">
            <span>⚽ {t("Fútbol Sala")}</span>·<span>🂡 {t("Mus")}</span>·<span>♠ {t("Póker")}</span>
          </div>
        )}
      </div>

      <footer className="relative z-10 pb-6">
        <Logos />
      </footer>
    </main>
  );
}
