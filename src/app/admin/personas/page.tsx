import type { Metadata } from "next";
import Link from "next/link";
import { BotonCopiar } from "@/components/admin/boton-copiar";
import { estiloInput } from "@/components/admin/estilos";
import { FormAccion } from "@/components/admin/form-accion";
import { MarcoAdmin, Seccion } from "@/components/admin/marco-admin";
import { listaPersonas, type PersonaFila } from "@/lib/personas";
import { exigirAdmin } from "@/lib/sesion";
import { sinTildes } from "@/lib/texto";
import { borrarSinTorneo, editarUsuario, ponerCorreo } from "../acciones";

export const metadata: Metadata = { title: "Panel · Personas" };

const FILTROS: [string, string, (p: PersonaFila) => boolean][] = [
  ["todos", "Todos", () => true],
  ["futbol", "⚽ Fútbol", (p) => !!p.futbol],
  ["mus", "🂡 Mus", (p) => !!p.mus],
  ["poker", "♠ Póker", (p) => !!p.poker && p.poker !== "baja"],
  ["actividades", "⭐ Actividades", (p) => p.actividades.length > 0],
  ["externos", "Correos no UAM", (p) => !/(^|\.)uam\.es$/.test(p.email.split("@")[1] ?? "")],
  ["sin-torneo", "Sin torneo", (p) => !p.futbol && !p.mus && !p.poker && !p.actividades.length],
];

const comparable = (s: string) => sinTildes(s).toLowerCase();

export default async function Personas({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  await exigirAdmin();
  const sp = await searchParams;
  // Los parámetros de la URL pueden venir repetidos o manipulados: solo se aceptan textos sencillos.
  const q = typeof sp.q === "string" ? sp.q.slice(0, 100) : "";
  const filtro = typeof sp.filtro === "string" && FILTROS.some(([id]) => id === sp.filtro) ? sp.filtro : "todos";
  const corregido = sp.corregido === "1";

  const { conCorreo, sinCorreo } = await listaPersonas();
  const [, , pasa] = FILTROS.find(([id]) => id === filtro)!;
  const lista = conCorreo.filter((p) => pasa(p) && (!q || comparable(`${p.nombre} ${p.email}`).includes(comparable(q))));
  const sinTorneo = conCorreo.filter(FILTROS.find(([id]) => id === "sin-torneo")![2]).length;
  const enlace = (f: string) => `/admin/personas?${new URLSearchParams({ ...(q ? { q } : {}), ...(f !== "todos" ? { filtro: f } : {}) })}`;

  return (
    <MarcoAdmin actual="/admin/personas" titulo="Personas">
      <Seccion
        titulo={`Con correo (${conCorreo.length})`}
        descripcion="Todas las personas que pueden entrar en la web con su correo (si siguen inscritas en algún torneo). Si corriges un nombre o un correo, el cambio se aplica en todos sus torneos y actividades (equipos, parejas, mesas), y el correo se recuerda al reimportar los CSV."
      >
        <form className="flex flex-wrap gap-2">
          {filtro !== "todos" && <input type="hidden" name="filtro" value={filtro} />}
          <input name="q" defaultValue={q} placeholder="Buscar por nombre o correo" className={`${estiloInput} min-w-0 flex-1`} />
          <button className="rounded-full bg-verde px-4 py-1.5 font-mono text-xs font-bold text-crema uppercase">Buscar</button>
        </form>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {FILTROS.map(([id, txt, f]) => (
            <Link
              key={id}
              href={enlace(id)}
              className={`shrink-0 rounded-full border-2 border-tinta px-3 py-1 text-xs font-semibold ${filtro === id ? "bg-tinta text-crema" : "bg-white"}`}
            >
              {txt} <span className="opacity-60">{conCorreo.filter(f).length}</span>
            </Link>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <BotonCopiar texto={lista.map((p) => p.email).join("; ")} etiqueta={`Copiar ${lista.length} ${lista.length === 1 ? "correo" : "correos"}`} />
          <a
            href="/admin/personas/csv"
            className="rounded-full border-2 border-tinta bg-white px-4 py-1.5 font-mono text-xs font-bold uppercase transition hover:bg-crema"
          >
            Descargar Excel (todos)
          </a>
          {sinTorneo > 0 && (
            <FormAccion
              accion={borrarSinTorneo}
              boton={`Borrar ${sinTorneo} sin torneo`}
              peligro
              compacto
              confirmar={`¿Borrar a ${sinTorneo === 1 ? "la persona que ya no está" : `las ${sinTorneo} personas que ya no están`} en ningún torneo? Se borran su nombre y su correo. No se puede deshacer.`}
            />
          )}
          {(q || filtro !== "todos") && (
            <span className="text-xs text-tinta-suave">
              {lista.length} de {conCorreo.length} · <Link href="/admin/personas" className="underline">quitar filtros</Link>
            </span>
          )}
        </div>
      </Seccion>

      {corregido && (
        <p className="mb-3 rounded-2xl bg-verde/15 px-4 py-2 text-sm font-semibold text-verde">
          ✓ Correo corregido en los tres torneos. Se recordará al reimportar los CSV.
        </p>
      )}
      <div className="mb-8 space-y-2">
        {lista.map((p) => (
          <div key={p.email} className="rounded-2xl border-2 border-linea bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-1.5 text-xs">
              {p.futbol && (
                <span className="rounded-full bg-verde/15 px-2">
                  ⚽ {p.futbol}
                  {p.capitan ? " · capitán" : ""}
                </span>
              )}
              {p.mus && <span className="rounded-full bg-copas/10 px-2">🂡 {p.mus}</span>}
              {p.poker && (
                <span className="rounded-full bg-tapete/15 px-2">
                  ♠ {p.poker}
                  {p.mesa ? ` · mesa ${p.mesa}` : ""}
                </span>
              )}
              {p.actividades.map((a) => (
                <span key={a} className="rounded-full bg-oros/20 px-2">
                  ⭐ {a}
                </span>
              ))}
              {!p.futbol && !p.mus && !p.poker && !p.actividades.length && <span className="rounded-full bg-linea px-2">sin torneo</span>}
            </div>
            <FormAccion accion={editarUsuario} compacto>
              <input type="hidden" name="email" value={p.email} />
              {/* En el móvil, nombre y correo en líneas separadas para que se lean enteros. */}
              <input name="nombre" defaultValue={p.nombre} className={`${estiloInput} min-w-0 flex-1 basis-full sm:basis-0`} aria-label="Nombre" />
              <input name="nuevoEmail" type="email" defaultValue={p.email} className={`${estiloInput} min-w-0 flex-[1.4] basis-full sm:basis-0`} aria-label="Correo" />
            </FormAccion>
          </div>
        ))}
        {!lista.length && <p className="text-sm text-tinta-suave">Nadie coincide con la búsqueda.</p>}
      </div>

      <div id="sin-correo" />
      <Seccion
        titulo={`Sin correo (${sinCorreo.length})`}
        descripcion="Personas de torneos y actividades que no pueden entrar porque no tenemos su correo. Escríbelo y pulsa Guardar: desde ese momento ya pueden entrar. No lo adivines: pídeselo a su capitán o pareja."
      >
        {sinCorreo.length ? (
          <div className="space-y-2">
            {sinCorreo.map((p) => (
              <FormAccion
                key={p.tipo === "futbol" ? `f${p.id}` : p.tipo === "mus" ? `m${p.parejaId}-${p.orden}` : `a${p.participanteId}-${p.orden}`}
                accion={ponerCorreo}
                boton="Guardar"
                compacto
              >
                <input type="hidden" name="tipo" value={p.tipo} />
                {p.tipo === "futbol" && <input type="hidden" name="id" value={p.id} />}
                {p.tipo === "mus" && (
                  <>
                    <input type="hidden" name="parejaId" value={p.parejaId} />
                    <input type="hidden" name="orden" value={p.orden} />
                  </>
                )}
                {p.tipo === "actividad" && (
                  <>
                    <input type="hidden" name="participanteId" value={p.participanteId} />
                    <input type="hidden" name="orden" value={p.orden} />
                  </>
                )}
                <span className="w-full text-sm sm:w-64">
                  <strong>{p.nombre}</strong>{" "}
                  <span className="text-xs text-tinta-suave">
                    · {p.tipo === "futbol" ? "⚽" : p.tipo === "mus" ? "🂡" : "⭐"} {p.equipo}
                  </span>
                </span>
                <input
                  name="correo"
                  type="email"
                  required
                  placeholder="correo@estudiante.uam.es"
                  aria-label={`Correo de ${p.nombre}`}
                  className={`${estiloInput} min-w-0 flex-1`}
                />
              </FormAccion>
            ))}
          </div>
        ) : (
          <p className="text-sm text-tinta-suave">Todo el mundo tiene correo. 🎉</p>
        )}
      </Seccion>
    </MarcoAdmin>
  );
}
