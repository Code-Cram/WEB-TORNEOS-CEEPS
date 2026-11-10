import type { Metadata } from "next";
import Link from "next/link";
import { BotonCopiar } from "@/modulos/panel/boton-copiar";
import { MarcoAdmin, Seccion } from "@/modulos/panel/marco";
import { enlaceCorreo, gruposCorreo, LARGO_MAXIMO_ENLACE, type GrupoCorreo } from "@/modulos/personas/correos";
import { leerInfoTorneos } from "@/modulos/torneos/info";
import { listaPersonas } from "@/modulos/personas/datos";
import { exigirAdmin } from "@/modulos/acceso/sesion";

export const metadata: Metadata = { title: "Panel · Correos" };

export default async function Correos() {
  await exigirAdmin();
  const [{ conCorreo, sinCorreo }, info] = await Promise.all([listaPersonas(), leerInfoTorneos()]);
  const secciones = gruposCorreo(conCorreo, info.mus.calendario);
  const futbolSinCorreo = sinCorreo.filter((p) => p.tipo === "futbol").length;

  return (
    <MarcoAdmin actual="/admin/correos" titulo="Correos">
      <p className="mb-6 max-w-3xl text-sm text-tinta-suave">
        Para escribir a los participantes. <strong>Copiar</strong> copia los correos para pegarlos en el campo <strong>CCO</strong> (copia oculta) de tu
        correo; <strong>Escribir</strong> abre tu programa de correo con todos ya en CCO. Usa siempre CCO: así nadie ve los correos de los demás. Son datos
        personales: solo para avisos de los torneos.
      </p>
      {secciones.map((s) => (
        <Seccion key={s.titulo} titulo={s.titulo}>
          <div className="space-y-2">
            {s.grupos.map((g) => (
              <Grupo key={g.id} grupo={g} />
            ))}
          </div>
        </Seccion>
      ))}
      {sinCorreo.length > 0 && (
        <p className="text-sm text-tinta-suave">
          ⚠ {sinCorreo.length} {sinCorreo.length === 1 ? "persona no tiene" : "personas no tienen"} correo y no se les puede escribir
          {futbolSinCorreo > 0 && <> ({futbolSinCorreo} del fútbol: escríbeles a través de su capitán)</>}.{" "}
          <Link href="/admin/personas#sin-correo" className="underline">
            Ponerles el correo en Personas
          </Link>
          .
        </p>
      )}
    </MarcoAdmin>
  );
}

function Grupo({ grupo }: { grupo: GrupoCorreo }) {
  const emails = grupo.personas.map((p) => p.email);
  const enlace = enlaceCorreo(emails);
  return (
    <div className="rounded-2xl border-2 border-linea bg-white p-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1 basis-52 text-sm">
          <strong>{grupo.titulo}</strong>{" "}
          <span className="text-tinta-suave">
            · {emails.length} {emails.length === 1 ? "correo" : "correos"}
          </span>
          {grupo.detalle && <p className="text-xs text-tinta-suave">{grupo.detalle}</p>}
        </div>
        <BotonCopiar texto={emails.join("; ")} etiqueta="Copiar" />
        <a href={enlace} className="rounded-full border-2 border-tinta bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase transition hover:bg-crema">
          ✉ Escribir
        </a>
      </div>
      {enlace.length > LARGO_MAXIMO_ENLACE && (
        <p className="mt-1.5 text-xs text-tinta-suave">Son muchos: si tu correo no los abre todos con «Escribir», usa «Copiar» y pégalos en CCO.</p>
      )}
      <details className="mt-2 text-xs">
        <summary className="cursor-pointer text-tinta-suave">Ver quiénes son</summary>
        <ul className="mt-1.5 gap-x-6 sm:columns-2">
          {grupo.personas.map((p) => (
            <li key={p.email} className="truncate py-0.5">
              {p.nombre} · <span className="text-tinta-suave">{p.email}</span>
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}
